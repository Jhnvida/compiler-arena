import * as THREE from "three";
import type { ArenaConfig } from "../simulation/types.ts";

export class ArenaMeshController {
    public readonly group: THREE.Group;

    constructor(config: ArenaConfig) {
        this.group = new THREE.Group();
        this.group.name = "arena_environment";

        const width = config.width;
        const depth = config.height;
        const halfW = width / 2;
        const halfD = depth / 2;

        this.createArenaFloor(width, depth);
        this.createBoundaryWalls(halfW, halfD);
    }

    private createArenaFloor(width: number, depth: number): void {
        const cols = 10;
        const rows = 10;
        const tileW = width / cols;
        const tileD = depth / rows;
        const tileGap = 1.2;
        const grassH = 3.5;

        const grassColors = [0x82d41b, 0x76c415, 0x8ce022, 0x6eb812, 0x7ecc1c];

        const slabMat = new THREE.MeshStandardMaterial({
            color: 0x4a7c1b,
            roughness: 0.9,
            metalness: 0.05,
            flatShading: true,
        });
        const slabGeo = new THREE.BoxGeometry(width, 2, depth);
        const slabMesh = new THREE.Mesh(slabGeo, slabMat);
        slabMesh.position.set(0, -grassH - 1, 0);
        slabMesh.receiveShadow = true;
        this.group.add(slabMesh);

        const startX = -width / 2 + tileW / 2;
        const startZ = -depth / 2 + tileD / 2;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const posX = startX + c * tileW;
                const posZ = startZ + r * tileD;

                const colorIdx = (r * 3 + c * 5) % grassColors.length;
                const grassMat = new THREE.MeshStandardMaterial({
                    color: grassColors[colorIdx],
                    roughness: 0.8,
                    metalness: 0.05,
                    flatShading: true,
                });

                const grassGeo = new THREE.BoxGeometry(tileW - tileGap, grassH, tileD - tileGap);
                const grassMesh = new THREE.Mesh(grassGeo, grassMat);
                grassMesh.position.set(posX, -grassH / 2, posZ);
                grassMesh.receiveShadow = true;
                this.group.add(grassMesh);
            }
        }
    }

    private createBoundaryWalls(halfW: number, halfD: number): void {
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0xded8c9,
            roughness: 0.85,
            metalness: 0.1,
            flatShading: true,
        });

        const topCopingMat = new THREE.MeshStandardMaterial({
            color: 0x78350f,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true,
        });

        const pillarMat = new THREE.MeshStandardMaterial({
            color: 0xa88d6b,
            roughness: 0.85,
            metalness: 0.15,
            flatShading: true,
        });

        const wallHeight = 14;
        const wallThickness = 8;
        const totalW = halfW * 2;
        const totalD = halfD * 2;

        const wallNGeo = new THREE.BoxGeometry(totalW, wallHeight, wallThickness);
        const wallN = new THREE.Mesh(wallNGeo, wallMat);
        wallN.position.set(0, wallHeight / 2, -halfD);
        wallN.castShadow = true;
        wallN.receiveShadow = true;
        this.group.add(wallN);

        const capNGeo = new THREE.BoxGeometry(totalW + 2, 2.5, wallThickness + 2);
        const capN = new THREE.Mesh(capNGeo, topCopingMat);
        capN.position.set(0, wallHeight + 1.25, -halfD);
        capN.castShadow = true;
        this.group.add(capN);

        const wallS = new THREE.Mesh(wallNGeo, wallMat);
        wallS.position.set(0, wallHeight / 2, halfD);
        wallS.castShadow = true;
        wallS.receiveShadow = true;
        this.group.add(wallS);

        const capS = new THREE.Mesh(capNGeo, topCopingMat);
        capS.position.set(0, wallHeight + 1.25, halfD);
        capS.castShadow = true;
        this.group.add(capS);

        const wallWGeo = new THREE.BoxGeometry(wallThickness, wallHeight, totalD);
        const wallW = new THREE.Mesh(wallWGeo, wallMat);
        wallW.position.set(-halfW, wallHeight / 2, 0);
        wallW.castShadow = true;
        wallW.receiveShadow = true;
        this.group.add(wallW);

        const capWGeo = new THREE.BoxGeometry(wallThickness + 2, 2.5, totalD + 2);
        const capW = new THREE.Mesh(capWGeo, topCopingMat);
        capW.position.set(-halfW, wallHeight + 1.25, 0);
        capW.castShadow = true;
        this.group.add(capW);

        const wallE = new THREE.Mesh(wallWGeo, wallMat);
        wallE.position.set(halfW, wallHeight / 2, 0);
        wallE.castShadow = true;
        wallE.receiveShadow = true;
        this.group.add(wallE);

        const capE = new THREE.Mesh(capWGeo, topCopingMat);
        capE.position.set(halfW, wallHeight + 1.25, 0);
        capE.castShadow = true;
        this.group.add(capE);

        const cornerPillarGeo = new THREE.BoxGeometry(12, wallHeight + 6, 12);
        const corners = [
            { x: -halfW, z: -halfD },
            { x: halfW, z: -halfD },
            { x: halfW, z: halfD },
            { x: -halfW, z: halfD },
        ];

        for (const c of corners) {
            const pillar = new THREE.Mesh(cornerPillarGeo, pillarMat);
            pillar.position.set(c.x, (wallHeight + 6) / 2, c.z);
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            this.group.add(pillar);
        }

        const perimeterPillars = [
            { x: 0, z: -halfD },
            { x: -halfW / 2, z: -halfD },
            { x: halfW / 2, z: -halfD },
            { x: 0, z: halfD },
            { x: -halfW / 2, z: halfD },
            { x: halfW / 2, z: halfD },
            { x: -halfW, z: 0 },
            { x: -halfW, z: -halfD / 2 },
            { x: -halfW, z: halfD / 2 },
            { x: halfW, z: 0 },
            { x: halfW, z: -halfD / 2 },
            { x: halfW, z: halfD / 2 },
        ];

        const perimeterPillarGeo = new THREE.BoxGeometry(10, wallHeight + 3, 10);
        for (const p of perimeterPillars) {
            const pillar = new THREE.Mesh(perimeterPillarGeo, pillarMat);
            pillar.position.set(p.x, (wallHeight + 3) / 2, p.z);
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            this.group.add(pillar);
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
