import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ParticleSystemManager } from "../graphics/particles.ts";
import { TankMeshController } from "../graphics/tankMesh.ts";
import { DEFAULT_ARENA_CONFIG } from "../simulation/arena.ts";
import { createProjectile } from "../simulation/projectile.ts";
import { createSimulatedTank } from "../simulation/tank.ts";
import type { SimulatedTank } from "../simulation/types.ts";

function createDummyTank(angle = 0): SimulatedTank {
    return createSimulatedTank(
        "tank-combat-test",
        "CombatTester",
        "#10b981",
        { robotName: "CombatTester", instructions: [], variableNames: [] },
        450,
        450,
        angle,
        DEFAULT_ARENA_CONFIG,
    );
}

describe("Combat VFX & Particle Overhaul Tests", () => {
    describe("1. Tank Muzzle World Transform", () => {
        it("computes accurate muzzle tip world position and forward direction", () => {
            const tank = createDummyTank(0);
            const ctrl = new TankMeshController(tank, 900, 900);

            const muzzle = ctrl.getMuzzleWorldTransform();

            expect(muzzle.position).toBeDefined();
            expect(muzzle.direction).toBeDefined();

            expect(muzzle.direction.length()).toBeCloseTo(1.0, 4);

            expect(muzzle.direction.x).toBeGreaterThan(0.9);
            expect(Math.abs(muzzle.direction.z)).toBeLessThan(0.1);

            expect(muzzle.position.x).toBeGreaterThan(0);
            expect(muzzle.position.y).toBeGreaterThan(10);

            ctrl.dispose();
        });

        it("rotates muzzle forward vector synchronously with turret rotation", () => {
            const tank = createDummyTank(90);
            const ctrl = new TankMeshController(tank, 900, 900);

            const dummyCamera = new THREE.PerspectiveCamera();
            ctrl.update(tank, dummyCamera, 900, 900, 0.016, false);

            const muzzle = ctrl.getMuzzleWorldTransform();
            expect(muzzle.direction.length()).toBeCloseTo(1.0, 4);

            expect(Math.abs(muzzle.direction.z)).toBeGreaterThan(0.3);

            ctrl.dispose();
        });
    });

    describe("2. Particle System Manager & Object Pooling", () => {
        it("initializes object pools with pre-allocated meshes and no initial active particles", () => {
            const pm = new ParticleSystemManager();

            expect(pm.group.children.length).toBeGreaterThan(250);

            let visibleCount = 0;
            pm.group.traverse((c) => {
                if (c instanceof THREE.Mesh && c.visible) visibleCount++;
            });
            expect(visibleCount).toBe(0);

            pm.dispose();
        });

        it("spawns directional muzzle blasts with custom powers and activates pooled particles", () => {
            const pm = new ParticleSystemManager();
            const forward = new THREE.Vector3(1, 0, 0);

            pm.spawnMuzzleBlast(0, 12, 0, forward, 1);

            let activeCount = 0;
            pm.group.traverse((c) => {
                if (c instanceof THREE.Mesh && c.visible) activeCount++;
            });
            expect(activeCount).toBeGreaterThanOrEqual(4);

            pm.clear();
            pm.spawnMuzzleBlast(0, 12, 0, forward, 3);

            let heavyCount = 0;
            pm.group.traverse((c) => {
                if (c instanceof THREE.Mesh && c.visible) heavyCount++;
            });
            expect(heavyCount).toBeGreaterThan(activeCount);

            pm.dispose();
        });

        it("spawns surface-dependent impacts for tanks and walls with directional vectors", () => {
            const pm = new ParticleSystemManager();

            const hitDir = new THREE.Vector3(1, 0, 0);
            pm.spawnTankImpact(10, 12, 10, hitDir, 2);

            let tankImpactMeshes = 0;
            pm.group.traverse((c) => {
                if (c instanceof THREE.Mesh && c.visible) tankImpactMeshes++;
            });
            expect(tankImpactMeshes).toBeGreaterThan(10);

            pm.clear();

            const wallNormal = new THREE.Vector3(0, 0, 1);
            pm.spawnWallImpact(0, 10, -450, wallNormal, 1);

            let wallImpactMeshes = 0;
            pm.group.traverse((c) => {
                if (c instanceof THREE.Mesh && c.visible) wallImpactMeshes++;
            });
            expect(wallImpactMeshes).toBeGreaterThan(8);

            pm.dispose();
        });

        it("spawns multi-phase explosions and simulates lifetime decay through update()", () => {
            const pm = new ParticleSystemManager();

            pm.spawnExplosion(0, 5, 0, 1.2);

            let initialActive = 0;
            pm.group.traverse((c) => {
                if (c instanceof THREE.Mesh && c.visible) initialActive++;
            });
            expect(initialActive).toBeGreaterThan(25);

            pm.update(0.12);

            let remainingAfterFlash = 0;
            pm.group.traverse((c) => {
                if (c instanceof THREE.Mesh && c.visible) remainingAfterFlash++;
            });
            expect(remainingAfterFlash).toBeLessThan(initialActive);

            pm.update(2.5);

            let fullyExpired = 0;
            pm.group.traverse((c) => {
                if (c instanceof THREE.Mesh && c.visible) fullyExpired++;
            });
            expect(fullyExpired).toBe(0);

            pm.dispose();
        });

        it("safely recycles particles under intense stress without memory allocation blowup", () => {
            const pm = new ParticleSystemManager();

            for (let i = 0; i < 40; i++) {
                pm.spawnExplosion(i * 10, 5, i * 10, 1.5);
            }

            const totalGroupChildren = pm.group.children.length;
            expect(totalGroupChildren).toBeLessThan(400);

            for (let f = 0; f < 30; f++) {
                pm.update(0.016);
            }

            expect(pm.group.children.length).toBe(totalGroupChildren);

            pm.clear();
            let visibleCount = 0;
            pm.group.traverse((c) => {
                if (c instanceof THREE.Mesh && c.visible) visibleCount++;
            });
            expect(visibleCount).toBe(0);

            pm.dispose();
        });

        it("ensures winning tank does not trigger mid-air overhead flashes or sparks", () => {
            const pm = new ParticleSystemManager();
            pm.clear();
            let visibleCount = 0;
            pm.group.traverse((c) => {
                if (c instanceof THREE.Mesh && c.visible) visibleCount++;
            });
            expect(visibleCount).toBe(0);
            pm.dispose();
        });
    });

    describe("3. Projectiles and Dynamic Kinetic Trails", () => {
        it("renders oriented kinetic projectiles and cleans them up upon termination", () => {
            const pm = new ParticleSystemManager();

            const p1 = createProjectile("tank1", 450, 450, 0, 1, 12);
            const p2 = createProjectile("tank2", 400, 400, 90, 3, 10);

            pm.syncProjectiles([p1, p2], 900, 900);

            const projGroup1 = pm.group.getObjectByName(`proj_${p1.id}`);
            const projGroup2 = pm.group.getObjectByName(`proj_${p2.id}`);

            expect(projGroup1).toBeDefined();
            expect(projGroup2).toBeDefined();

            expect(projGroup1!.rotation.y).not.toBeCloseTo(projGroup2!.rotation.y);

            pm.syncProjectiles([p2], 900, 900);
            expect(pm.group.getObjectByName(`proj_${p1.id}`)).toBeUndefined();
            expect(pm.group.getObjectByName(`proj_${p2.id}`)).toBeDefined();

            pm.clear();
            expect(pm.group.getObjectByName(`proj_${p2.id}`)).toBeUndefined();

            pm.dispose();
        });

        it("ensures winning tank does not trigger mid-air overhead flashes or sparks", () => {
            const pm = new ParticleSystemManager();
            pm.clear();
            let visibleCount = 0;
            pm.group.traverse((c) => {
                if (c instanceof THREE.Mesh && c.visible) visibleCount++;
            });
            expect(visibleCount).toBe(0);
            pm.dispose();
        });
    });
});
