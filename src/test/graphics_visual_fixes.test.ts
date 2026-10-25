import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ArenaMeshController } from "../graphics/arenaMesh.ts";
import { TankMeshController } from "../graphics/tankMesh.ts";
import { DEFAULT_ARENA_CONFIG } from "../simulation/arena.ts";
import { createSimulatedTank } from "../simulation/tank.ts";
import type { SimulatedTank } from "../simulation/types.ts";

function createDummyTank(): SimulatedTank {
    return createSimulatedTank(
        "tank-alpha",
        "AlphaTank",
        "#3b82f6",
        { robotName: "AlphaTank", instructions: [], variableNames: [] },
        450,
        450,
        0,
        DEFAULT_ARENA_CONFIG,
    );
}

describe("Graphics & Visual Fixes Validation", () => {
    describe("1. Tank 3D Model Geometrical Integrity", () => {
        it("does not have protruding pyramid vertices or apex cutting through the hull", () => {
            const tank = createDummyTank();
            const ctrl = new TankMeshController(tank, 900, 900);

            const box = new THREE.Box3();
            ctrl.group.updateMatrixWorld(true);
            box.setFromObject(ctrl.group);

            const height = box.max.y - box.min.y;
            expect(height).toBeGreaterThan(12);
            expect(box.max.y).toBeLessThan(19);

            ctrl.group.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    const meshBox = new THREE.Box3().setFromObject(child);
                    expect(meshBox.max.y).toBeLessThanOrEqual(18.5);
                }
            });

            ctrl.dispose();
        });

        it("preserves barrel assembly, recoil mechanics and aligns muzzle brake", () => {
            const tank = createDummyTank();
            const ctrl = new TankMeshController(tank, 900, 900);

            expect(ctrl.barrelMesh).toBeDefined();
            expect(ctrl.barrelMesh.position.x).toBe(13);

            const children = ctrl.barrelMesh.children;
            expect(children.length).toBeGreaterThanOrEqual(2);

            ctrl.triggerRecoil();
            const dummyCamera = new THREE.PerspectiveCamera();
            ctrl.update(tank, dummyCamera, 900, 900, 0.016, false);

            expect(ctrl.barrelMesh.position.x).toBeLessThan(13);

            ctrl.reset(tank, 900, 900);
            expect(ctrl.barrelMesh.position.x).toBe(13);

            ctrl.dispose();
        });

        it("handles alive/death material transitions without leaking memory", () => {
            const tank = createDummyTank();
            const ctrl = new TankMeshController(tank, 900, 900);
            const dummyCamera = new THREE.PerspectiveCamera();

            expect(ctrl.armorMaterials.length).toBeGreaterThanOrEqual(2);

            tank.isAlive = false;
            ctrl.update(tank, dummyCamera, 900, 900, 0.016, false);

            expect(ctrl.group.rotation.z).toBeCloseTo(0.14);
            expect(ctrl.group.rotation.x).toBeCloseTo(-0.08);

            tank.isAlive = true;
            ctrl.reset(tank, 900, 900);
            expect(ctrl.group.rotation.z).toBe(0);
            expect(ctrl.group.rotation.x).toBe(0);

            ctrl.dispose();
        });
    });

    describe("2. Elimination of Floating Victory Beacon Triangle", () => {
        it("ensures no floating victory beacon or octahedron mesh exists on winning tank", () => {
            const tank = createDummyTank();
            const ctrl = new TankMeshController(tank, 900, 900);
            const dummyCamera = new THREE.PerspectiveCamera();

            ctrl.update(tank, dummyCamera, 900, 900, 0.016, true);

            let foundBeacon = false;
            let foundOctahedron = false;

            ctrl.group.traverse((child) => {
                if (child.name.includes("beacon") || child.name.includes("victory")) {
                    foundBeacon = true;
                }
                if (child instanceof THREE.Mesh && child.geometry instanceof THREE.OctahedronGeometry) {
                    foundOctahedron = true;
                }
            });

            expect(foundBeacon).toBe(false);
            expect(foundOctahedron).toBe(false);

            ctrl.dispose();
        });
    });

    describe("3. Arena Walls and Z-Fighting Elimination", () => {
        it("has 12 unique, non-duplicated perimeter pillar locations", () => {
            const arena = new ArenaMeshController(DEFAULT_ARENA_CONFIG);

            const pillarPositions: string[] = [];
            arena.group.traverse((child) => {
                if (child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry) {
                    const p = child.geometry.parameters;
                    if (Math.abs(p.width - 11.6) < 0.1 && Math.abs(p.height - 17.5) < 0.1) {
                        const key = `${child.position.x.toFixed(1)},${child.position.z.toFixed(1)}`;
                        pillarPositions.push(key);
                    }
                }
            });

            expect(pillarPositions.length).toBe(12);
            const uniquePositions = new Set(pillarPositions);
            expect(uniquePositions.size).toBe(12);

            expect(uniquePositions.has("-450.0,-225.0")).toBe(true);
            expect(uniquePositions.has("-450.0,225.0")).toBe(true);

            arena.dispose();
        });

        it("ensures pillar faces have strictly positive clearance over coping caps (no coplanar Z-fighting)", () => {
            const arena = new ArenaMeshController(DEFAULT_ARENA_CONFIG);

            let capThickness = 0;
            let perimeterPillarThickness = 0;

            arena.group.traverse((child) => {
                if (child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry) {
                    const p = child.geometry.parameters;
                    if (Math.abs(p.height - 2.4) < 0.1) {
                        capThickness = Math.max(capThickness, p.width === 9.4 ? p.width : p.depth);
                    }
                    if (Math.abs(p.height - 17.5) < 0.1) {
                        perimeterPillarThickness = p.width;
                    }
                }
            });

            expect(capThickness).toBeCloseTo(9.4, 1);
            expect(perimeterPillarThickness).toBeCloseTo(11.6, 1);

            const clearance = (perimeterPillarThickness - capThickness) / 2;
            expect(clearance).toBeGreaterThanOrEqual(1.0);

            arena.dispose();
        });
    });
});
