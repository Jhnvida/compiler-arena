import * as THREE from "three";
import type { ArenaConfig, Obstacle } from "../simulation/types.ts";
import { simToWorld } from "./types.ts";

export class ArenaMeshController {
    public readonly group: THREE.Group;
    private readonly obstacleMeshes: THREE.Mesh[] = [];

    constructor(config: ArenaConfig) {
        this.group = new THREE.Group();
        this.group.name = "arena_environment";

        const width = config.width;
        const depth = config.height;
        const halfW = width / 2;
        const halfD = depth / 2;

        const floorGeo = new THREE.PlaneGeometry(width, depth, 16, 12);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x0b0f19,
            roughness: 0.85,
            metalness: 0.2,
            flatShading: true,
        });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.receiveShadow = true;
        this.group.add(floorMesh);

        const grid = new THREE.GridHelper(Math.max(width, depth), 32, 0x2563eb, 0x1e293b);
        grid.position.y = 0.15;
        grid.scale.set(width / Math.max(width, depth), 1, depth / Math.max(width, depth));
        this.group.add(grid);

        const outerFloorGeo = new THREE.PlaneGeometry(3500, 3500);
        const outerFloorMat = new THREE.MeshBasicMaterial({ color: 0x030712 });
        const outerFloor = new THREE.Mesh(outerFloorGeo, outerFloorMat);
        outerFloor.rotation.x = -Math.PI / 2;
        outerFloor.position.y = -0.5;
        this.group.add(outerFloor);

        const wallHeight = 22;
        const wallThick = 8;
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x111827,
            roughness: 0.7,
            metalness: 0.4,
            flatShading: true,
        });
        const neonBarMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.9,
            roughness: 0.2,
        });

        const createWallSegment = (w: number, h: number, d: number, posX: number, posY: number, posZ: number) => {
            const wallGeo = new THREE.BoxGeometry(w, h, d);
            const wallMesh = new THREE.Mesh(wallGeo, wallMat);
            wallMesh.position.set(posX, posY, posZ);
            wallMesh.castShadow = true;
            wallMesh.receiveShadow = true;
            this.group.add(wallMesh);

            const stripGeo = new THREE.BoxGeometry(w > d ? w : 1.2, 1.5, d > w ? d : 1.2);
            const stripMesh = new THREE.Mesh(stripGeo, neonBarMat);
            stripMesh.position.set(posX, posY + h / 2 + 0.8, posZ);
            this.group.add(stripMesh);
        };

        createWallSegment(width + wallThick * 2, wallHeight, wallThick, 0, wallHeight / 2, -halfD - wallThick / 2);
        createWallSegment(width + wallThick * 2, wallHeight, wallThick, 0, wallHeight / 2, halfD + wallThick / 2);

        createWallSegment(wallThick, wallHeight, depth, -halfW - wallThick / 2, wallHeight / 2, 0);
        createWallSegment(wallThick, wallHeight, depth, halfW + wallThick / 2, wallHeight / 2, 0);

        const pylonGeo = new THREE.CylinderGeometry(6, 8, wallHeight + 10, 6);
        const pylonMat = new THREE.MeshStandardMaterial({
            color: 0x1f2937,
            roughness: 0.6,
            metalness: 0.5,
            flatShading: true,
        });
        const pylonGlowMat = new THREE.MeshStandardMaterial({
            color: 0x06b6d4,
            emissive: 0x06b6d4,
            emissiveIntensity: 1.2,
            roughness: 0.1,
        });

        const corners = [
            { x: -halfW - 2, z: -halfD - 2 },
            { x: halfW + 2, z: -halfD - 2 },
            { x: halfW + 2, z: halfD + 2 },
            { x: -halfW - 2, z: halfD + 2 },
        ];

        for (const c of corners) {
            const pylon = new THREE.Mesh(pylonGeo, pylonMat);
            pylon.position.set(c.x, (wallHeight + 10) / 2, c.z);
            pylon.castShadow = true;
            this.group.add(pylon);

            const beaconGeo = new THREE.OctahedronGeometry(3.5, 0);
            const beacon = new THREE.Mesh(beaconGeo, pylonGlowMat);
            beacon.position.set(c.x, wallHeight + 12, c.z);
            this.group.add(beacon);
        }

        this.createObstacles(config.obstacles, width, depth);
    }

    private createObstacles(obstacles: Obstacle[], arenaWidth: number, arenaHeight: number): void {
        const crateMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            roughness: 0.7,
            metalness: 0.3,
            flatShading: true,
        });

        const metalTrimMat = new THREE.MeshStandardMaterial({
            color: 0x64748b,
            roughness: 0.4,
            metalness: 0.7,
            flatShading: true,
        });

        const hazardMat = new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            roughness: 0.5,
            metalness: 0.2,
        });

        for (const obs of obstacles) {
            const world = simToWorld(obs.x, obs.y, arenaWidth, arenaHeight);
            const obsHeight = 24;

            const obsGroup = new THREE.Group();
            obsGroup.position.set(world.x, 0, world.z);

            const bodyGeo = new THREE.BoxGeometry(obs.width, obsHeight, obs.height);
            const bodyMesh = new THREE.Mesh(bodyGeo, crateMat);
            bodyMesh.position.y = obsHeight / 2;
            bodyMesh.castShadow = true;
            bodyMesh.receiveShadow = true;
            obsGroup.add(bodyMesh);

            const capGeo = new THREE.BoxGeometry(obs.width - 6, 2.5, obs.height - 6);
            const capMesh = new THREE.Mesh(capGeo, metalTrimMat);
            capMesh.position.y = obsHeight + 1.25;
            capMesh.castShadow = true;
            obsGroup.add(capMesh);

            const hazardGeo = new THREE.BoxGeometry(obs.width + 0.4, 2, obs.height + 0.4);
            const hazardMesh = new THREE.Mesh(hazardGeo, hazardMat);
            hazardMesh.position.y = obsHeight * 0.6;
            obsGroup.add(hazardMesh);

            this.group.add(obsGroup);
            this.obstacleMeshes.push(bodyMesh);
        }
    }

    public dispose(): void {
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach((m) => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
}
