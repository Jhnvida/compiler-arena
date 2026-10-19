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

        this.createModularIsland(width, depth);
        this.createNaturalObstacles(config.obstacles, width, depth);
        this.createPerimeterFences(halfW, halfD);
        this.createSceneryDetails(halfW, halfD);
    }

    private createModularIsland(width: number, depth: number): void {
        const cols = 8;
        const rows = 6;
        const tileW = width / cols;
        const tileD = depth / rows;
        const tileGap = 2.5;
        const grassH = 3.5;
        const dirtH = 14;

        const grassColors = [0x82d41b, 0x76c415, 0x8ce022, 0x6eb812, 0x7ecc1c];
        const dirtMat = new THREE.MeshStandardMaterial({
            color: 0x4d3219,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true,
        });

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

                const dirtGeo = new THREE.BoxGeometry(tileW - tileGap - 1, dirtH, tileD - tileGap - 1);
                const dirtMesh = new THREE.Mesh(dirtGeo, dirtMat);
                dirtMesh.position.set(posX, -grassH - dirtH / 2, posZ);
                dirtMesh.receiveShadow = true;
                this.group.add(dirtMesh);

                if ((r + c) % 3 === 0) {
                    const clumpGeo = new THREE.ConeGeometry(1.6, 2.8, 4);
                    const clumpMesh = new THREE.Mesh(clumpGeo, grassMat);
                    clumpMesh.position.set(posX + (Math.sin(r + c) * 18), 1.2, posZ + (Math.cos(r * c) * 18));
                    clumpMesh.rotation.y = (r + c) * 0.8;
                    this.group.add(clumpMesh);
                }
            }
        }

        const cliffMat = new THREE.MeshStandardMaterial({
            color: 0x3e2916,
            roughness: 0.95,
            metalness: 0.15,
            flatShading: true,
        });

        const cliffGeo = new THREE.ConeGeometry(Math.max(width, depth) * 0.58, 90, 8);
        const cliffMesh = new THREE.Mesh(cliffGeo, cliffMat);
        cliffMesh.position.set(0, -62, 0);
        cliffMesh.rotation.x = Math.PI;
        cliffMesh.rotation.y = Math.PI / 8;
        cliffMesh.receiveShadow = true;
        this.group.add(cliffMesh);
    }

    private createNaturalObstacles(obstacles: Obstacle[], arenaWidth: number, arenaHeight: number): void {
        const stoneMat = new THREE.MeshStandardMaterial({
            color: 0xded8c9,
            roughness: 0.85,
            metalness: 0.1,
            flatShading: true,
        });

        const baseStoneMat = new THREE.MeshStandardMaterial({
            color: 0xa88d6b,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true,
        });

        const woodMat = new THREE.MeshStandardMaterial({
            color: 0x78350f,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true,
        });

        const roofMat = new THREE.MeshStandardMaterial({
            color: 0xb91c1c,
            roughness: 0.65,
            metalness: 0.1,
            flatShading: true,
        });

        const cannonMat = new THREE.MeshStandardMaterial({
            color: 0x475569,
            roughness: 0.5,
            metalness: 0.6,
            flatShading: true,
        });

        for (let i = 0; i < obstacles.length; i++) {
            const obs = obstacles[i];
            const world = simToWorld(obs.x, obs.y, arenaWidth, arenaHeight);
            const obsGroup = new THREE.Group();
            obsGroup.position.set(world.x, 0, world.z);

            const isTower = Math.abs(obs.width - obs.height) < 15;

            if (isTower) {
                const towerHeight = 36;
                const isSquareTower = i % 2 === 0;

                if (isSquareTower) {
                    const baseW = obs.width * 0.65;
                    const flaredGeo = new THREE.CylinderGeometry(baseW * 0.8, baseW * 1.05, 10, 4);
                    const flaredMesh = new THREE.Mesh(flaredGeo, baseStoneMat);
                    flaredMesh.position.y = 5;
                    flaredMesh.rotation.y = Math.PI / 4;
                    flaredMesh.castShadow = true;
                    flaredMesh.receiveShadow = true;
                    obsGroup.add(flaredMesh);

                    const towerGeo = new THREE.BoxGeometry(baseW * 0.75, towerHeight - 10, baseW * 0.75);
                    const towerMesh = new THREE.Mesh(towerGeo, stoneMat);
                    towerMesh.position.y = 5 + (towerHeight - 10) / 2;
                    towerMesh.castShadow = true;
                    towerMesh.receiveShadow = true;
                    obsGroup.add(towerMesh);

                    const roofGeo = new THREE.ConeGeometry(baseW * 0.85, 12, 4);
                    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
                    roofMesh.position.y = towerHeight + 4;
                    roofMesh.rotation.y = Math.PI / 4;
                    roofMesh.castShadow = true;
                    obsGroup.add(roofMesh);

                    this.obstacleMeshes.push(towerMesh);
                } else {
                    const towerRadius = obs.width * 0.32;
                    const baseGeo = new THREE.CylinderGeometry(towerRadius * 0.95, towerRadius * 1.15, towerHeight, 8);
                    const baseMesh = new THREE.Mesh(baseGeo, stoneMat);
                    baseMesh.position.y = towerHeight / 2;
                    baseMesh.castShadow = true;
                    baseMesh.receiveShadow = true;
                    obsGroup.add(baseMesh);

                    const balconyGeo = new THREE.BoxGeometry(obs.width * 0.82, 4, obs.height * 0.82);
                    const balconyMesh = new THREE.Mesh(balconyGeo, woodMat);
                    balconyMesh.position.y = towerHeight + 2;
                    balconyMesh.castShadow = true;
                    obsGroup.add(balconyMesh);

                    const roofGeo = new THREE.ConeGeometry(towerRadius * 1.45, 18, 8);
                    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
                    roofMesh.position.y = towerHeight + 13;
                    roofMesh.castShadow = true;
                    obsGroup.add(roofMesh);

                    this.obstacleMeshes.push(baseMesh);
                }

                const cannonGroup = new THREE.Group();
                cannonGroup.position.set(0, towerHeight + 14, 0);

                const cannonBaseGeo = new THREE.CylinderGeometry(3.5, 4, 3, 6);
                const cannonBase = new THREE.Mesh(cannonBaseGeo, cannonMat);
                cannonGroup.add(cannonBase);

                const barrelGeo = new THREE.CylinderGeometry(2, 2.8, 12, 6);
                const barrel = new THREE.Mesh(barrelGeo, cannonMat);
                barrel.rotation.z = Math.PI / 3;
                barrel.position.set(4, 3.5, 0);
                barrel.castShadow = true;
                cannonGroup.add(barrel);

                obsGroup.add(cannonGroup);
            } else {
                const moundGeo = new THREE.BoxGeometry(obs.width, 24, obs.height);
                const moundMesh = new THREE.Mesh(moundGeo, stoneMat);
                moundMesh.position.y = 12;
                moundMesh.castShadow = true;
                moundMesh.receiveShadow = true;
                obsGroup.add(moundMesh);

                const parapetGeo = new THREE.BoxGeometry(obs.width + 2, 4, obs.height + 2);
                const parapet = new THREE.Mesh(parapetGeo, woodMat);
                parapet.position.y = 26;
                parapet.castShadow = true;
                obsGroup.add(parapet);

                const miniRoofGeo = new THREE.ConeGeometry(14, 14, 6);
                const miniRoof = new THREE.Mesh(miniRoofGeo, roofMat);
                miniRoof.position.set(obs.width * 0.22, 33, 0);
                miniRoof.castShadow = true;
                obsGroup.add(miniRoof);

                this.obstacleMeshes.push(moundMesh);
            }

            this.group.add(obsGroup);
        }
    }

    private createPerimeterFences(halfW: number, halfD: number): void {
        const woodMat = new THREE.MeshStandardMaterial({
            color: 0x854d0e,
            roughness: 0.85,
            metalness: 0.1,
            flatShading: true,
        });

        const stonePostMat = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            roughness: 0.8,
            metalness: 0.15,
            flatShading: true,
        });

        const postGeo = new THREE.BoxGeometry(3, 12, 3);
        const railGeoX = new THREE.BoxGeometry(34, 1.8, 1.2);
        const railGeoZ = new THREE.BoxGeometry(1.2, 1.8, 34);

        for (let x = -halfW + 20; x <= halfW - 20; x += 36) {
            for (const z of [-halfD + 4, halfD - 4]) {
                const post = new THREE.Mesh(postGeo, woodMat);
                post.position.set(x, 6, z);
                post.castShadow = true;
                this.group.add(post);

                const rail1 = new THREE.Mesh(railGeoX, woodMat);
                rail1.position.set(x + 17, 4.5, z);
                rail1.castShadow = true;
                this.group.add(rail1);

                const rail2 = new THREE.Mesh(railGeoX, woodMat);
                rail2.position.set(x + 17, 8.5, z);
                rail2.castShadow = true;
                this.group.add(rail2);
            }
        }

        for (let z = -halfD + 20; z <= halfD - 20; z += 36) {
            for (const x of [-halfW + 4, halfW - 4]) {
                const post = new THREE.Mesh(postGeo, woodMat);
                post.position.set(x, 6, z);
                post.castShadow = true;
                this.group.add(post);

                const rail1 = new THREE.Mesh(railGeoZ, woodMat);
                rail1.position.set(x, 4.5, z + 17);
                rail1.castShadow = true;
                this.group.add(rail1);

                const rail2 = new THREE.Mesh(railGeoZ, woodMat);
                rail2.position.set(x, 8.5, z + 17);
                rail2.castShadow = true;
                this.group.add(rail2);
            }
        }

        const corners = [
            { x: -halfW + 4, z: -halfD + 4 },
            { x: halfW - 4, z: -halfD + 4 },
            { x: halfW - 4, z: halfD - 4 },
            { x: -halfW + 4, z: halfD - 4 },
        ];

        const cornerPillarGeo = new THREE.CylinderGeometry(5, 6, 16, 6);
        for (const c of corners) {
            const pillar = new THREE.Mesh(cornerPillarGeo, stonePostMat);
            pillar.position.set(c.x, 8, c.z);
            pillar.castShadow = true;
            this.group.add(pillar);
        }
    }

    private createSceneryDetails(halfW: number, halfD: number): void {
        const trunkMat = new THREE.MeshStandardMaterial({
            color: 0x6d4422,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true,
        });

        const foliageColors = [0x6ee7b7, 0x86efac, 0x5eead4, 0x4ade80];
        const rockMat = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            roughness: 0.85,
            metalness: 0.15,
            flatShading: true,
        });

        const treePositions = [
            { x: -halfW + 55, z: -halfD + 60, scale: 1.1 },
            { x: -halfW + 75, z: -halfD + 95, scale: 0.85 },
            { x: halfW - 65, z: -halfD + 55, scale: 1.05 },
            { x: halfW - 90, z: -halfD + 85, scale: 0.8 },
            { x: halfW - 55, z: halfD - 65, scale: 1.15 },
            { x: halfW - 85, z: halfD - 90, scale: 0.9 },
            { x: -halfW + 60, z: halfD - 55, scale: 1.0 },
            { x: -halfW + 90, z: halfD - 85, scale: 0.8 },
            { x: 0, z: -halfD + 45, scale: 0.95 },
            { x: 0, z: halfD - 45, scale: 0.95 },
        ];

        for (let i = 0; i < treePositions.length; i++) {
            const pos = treePositions[i];
            const tree = new THREE.Group();
            tree.position.set(pos.x, 0, pos.z);

            const trunkH = 14 * pos.scale;
            const trunkGeo = new THREE.CylinderGeometry(1.8 * pos.scale, 2.8 * pos.scale, trunkH, 6);
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = trunkH / 2;
            trunk.castShadow = true;
            tree.add(trunk);

            const foliageMat = new THREE.MeshStandardMaterial({
                color: foliageColors[i % foliageColors.length],
                roughness: 0.75,
                metalness: 0.05,
                flatShading: true,
            });

            const canopy1Geo = new THREE.DodecahedronGeometry(10 * pos.scale, 0);
            const canopy1 = new THREE.Mesh(canopy1Geo, foliageMat);
            canopy1.position.set(0, trunkH + 7 * pos.scale, 0);
            canopy1.castShadow = true;
            tree.add(canopy1);

            const canopy2Geo = new THREE.IcosahedronGeometry(7 * pos.scale, 0);
            const canopy2 = new THREE.Mesh(canopy2Geo, foliageMat);
            canopy2.position.set(3 * pos.scale, trunkH + 12 * pos.scale, 2 * pos.scale);
            canopy2.castShadow = true;
            tree.add(canopy2);

            this.group.add(tree);
        }

        const rockPositions = [
            { x: -halfW + 110, z: -halfD + 130, size: 5 },
            { x: halfW - 120, z: -halfD + 120, size: 6 },
            { x: -halfW + 130, z: halfD - 110, size: 4.5 },
            { x: halfW - 110, z: halfD - 120, size: 5.5 },
            { x: -160, z: -100, size: 4 },
            { x: 170, z: 90, size: 4.5 },
            { x: -70, z: 70, size: 3.5 },
            { x: 80, z: -80, size: 4 },
        ];

        for (const r of rockPositions) {
            const rockGeo = new THREE.DodecahedronGeometry(r.size, 0);
            const rock = new THREE.Mesh(rockGeo, rockMat);
            rock.position.set(r.x, r.size * 0.7, r.z);
            rock.rotation.set(r.size, r.size * 2, r.size * 3);
            rock.scale.set(1.1, 0.75, 1);
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.group.add(rock);
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
