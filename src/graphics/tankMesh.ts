import * as THREE from "three";
import type { SimulatedTank } from "../simulation/types.ts";
import { simAngleToWorldRotation, simToWorld } from "./types.ts";

export class TankMeshController {
    public readonly id: string;
    public readonly group: THREE.Group;
    public readonly turretGroup: THREE.Group;
    public readonly barrelMesh: THREE.Mesh;
    public readonly armorMaterials: THREE.MeshStandardMaterial[] = [];

    private isDead = false;
    private recoilOffset = 0;
    private targetRecoil = 0;
    private readonly originalArmorColor: THREE.Color;
    private readonly originalAccentColor: THREE.Color;

    constructor(tank: SimulatedTank, arenaWidth: number, arenaHeight: number) {
        this.id = tank.id;
        this.group = new THREE.Group();
        this.group.name = `tank_${tank.id}`;

        const color = new THREE.Color(tank.color);
        this.originalArmorColor = color.clone();
        this.originalAccentColor = new THREE.Color(0x3f3f46);

        const darkMetal = new THREE.MeshStandardMaterial({
            color: 0x27272a,
            roughness: 0.8,
            metalness: 0.3,
            flatShading: true,
        });

        const armorMat = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.45,
            metalness: 0.2,
            flatShading: true,
        });
        this.armorMaterials.push(armorMat);

        const accentMat = new THREE.MeshStandardMaterial({
            color: 0x3f3f46,
            roughness: 0.6,
            metalness: 0.35,
            flatShading: true,
        });
        this.armorMaterials.push(accentMat);

        const lowerHullGeo = new THREE.BoxGeometry(32, 4.5, 20);
        const lowerHull = new THREE.Mesh(lowerHullGeo, darkMetal);
        lowerHull.position.set(0, 4.5, 0);
        lowerHull.castShadow = true;
        lowerHull.receiveShadow = true;
        this.group.add(lowerHull);

        const upperHullGeo = new THREE.BoxGeometry(29, 4.2, 21.6);
        const upperHull = new THREE.Mesh(upperHullGeo, armorMat);
        upperHull.position.set(-1, 8.2, 0);
        upperHull.castShadow = true;
        upperHull.receiveShadow = true;
        this.group.add(upperHull);

        const glacisGeo = this.createFrontGlacisGeometry();
        const glacisMesh = new THREE.Mesh(glacisGeo, armorMat);
        glacisMesh.castShadow = true;
        glacisMesh.receiveShadow = true;
        this.group.add(glacisMesh);

        const engineDeckGeo = new THREE.BoxGeometry(8, 0.8, 14);
        const engineDeck = new THREE.Mesh(engineDeckGeo, accentMat);
        engineDeck.position.set(-10, 10.4, 0);
        engineDeck.castShadow = true;
        this.group.add(engineDeck);

        const trackMat = darkMetal;
        const wheelMat = new THREE.MeshStandardMaterial({
            color: 0x52525b,
            roughness: 0.7,
            metalness: 0.4,
            flatShading: true,
        });

        for (const sign of [1, -1]) {
            const zTrack = sign * 14;

            const trackMainGeo = new THREE.BoxGeometry(32, 5.8, 5.2);
            const trackMain = new THREE.Mesh(trackMainGeo, trackMat);
            trackMain.position.set(0, 3.6, zTrack);
            trackMain.castShadow = true;
            trackMain.receiveShadow = true;
            this.group.add(trackMain);

            const frontSprocketGeo = new THREE.BoxGeometry(5.2, 4.2, 5.2);
            const frontSprocket = new THREE.Mesh(frontSprocketGeo, trackMat);
            frontSprocket.position.set(16.2, 4.3, zTrack);
            frontSprocket.rotation.z = -0.32;
            frontSprocket.castShadow = true;
            this.group.add(frontSprocket);

            const rearIdlerGeo = new THREE.BoxGeometry(5.2, 4.2, 5.2);
            const rearIdler = new THREE.Mesh(rearIdlerGeo, trackMat);
            rearIdler.position.set(-16.2, 4.3, zTrack);
            rearIdler.rotation.z = 0.32;
            rearIdler.castShadow = true;
            this.group.add(rearIdler);

            const fenderGeo = new THREE.BoxGeometry(36, 1.0, 5.8);
            const fender = new THREE.Mesh(fenderGeo, accentMat);
            fender.position.set(0, 6.8, zTrack);
            fender.castShadow = true;
            this.group.add(fender);

            const skirtPlateGeo = new THREE.BoxGeometry(26, 2.8, 0.8);
            const skirtPlate = new THREE.Mesh(skirtPlateGeo, accentMat);
            skirtPlate.position.set(0, 5.2, zTrack + sign * 2.8);
            skirtPlate.castShadow = true;
            this.group.add(skirtPlate);

            const wheelGeo = new THREE.CylinderGeometry(2.4, 2.4, 1.1, 8);
            const zWheel = zTrack + sign * 2.7;
            for (let x = -12; x <= 12; x += 6) {
                const wheel = new THREE.Mesh(wheelGeo, wheelMat);
                wheel.rotation.x = Math.PI / 2;
                wheel.position.set(x, 2.9, zWheel);
                wheel.castShadow = true;
                this.group.add(wheel);
            }
        }

        this.turretGroup = new THREE.Group();
        this.turretGroup.position.set(-2, 10.5, 0);

        const ringGeo = new THREE.CylinderGeometry(9.2, 9.8, 1.2, 10);
        const turretRing = new THREE.Mesh(ringGeo, darkMetal);
        turretRing.position.set(0, 0.6, 0);
        turretRing.castShadow = true;
        this.turretGroup.add(turretRing);

        const turretBaseGeo = new THREE.CylinderGeometry(8.2, 9.6, 4.8, 8);
        const turretBase = new THREE.Mesh(turretBaseGeo, armorMat);
        turretBase.position.set(0, 3.2, 0);
        turretBase.castShadow = true;
        turretBase.receiveShadow = true;
        this.turretGroup.add(turretBase);

        const hatchGeo = new THREE.CylinderGeometry(3.2, 3.2, 1.4, 8);
        const hatch = new THREE.Mesh(hatchGeo, darkMetal);
        hatch.position.set(-2, 6.0, 0);
        hatch.castShadow = true;
        this.turretGroup.add(hatch);

        const mantletGeo = new THREE.BoxGeometry(4.2, 4.0, 7.2);
        const mantlet = new THREE.Mesh(mantletGeo, accentMat);
        mantlet.position.set(8.5, 2.2, 0);
        mantlet.castShadow = true;
        this.turretGroup.add(mantlet);

        const barrelGeo = new THREE.CylinderGeometry(1.6, 2.2, 22, 8);
        this.barrelMesh = new THREE.Mesh(barrelGeo, darkMetal);
        this.barrelMesh.rotation.z = -Math.PI / 2;
        this.barrelMesh.position.set(13, 2.2, 0);
        this.barrelMesh.castShadow = true;

        const extractorGeo = new THREE.CylinderGeometry(2.3, 2.3, 4.2, 8);
        const extractor = new THREE.Mesh(extractorGeo, accentMat);
        extractor.position.set(0, 1.5, 0);
        extractor.castShadow = true;
        this.barrelMesh.add(extractor);

        const muzzleGeo = new THREE.CylinderGeometry(2.4, 2.4, 3.5, 8);
        const muzzle = new THREE.Mesh(muzzleGeo, darkMetal);
        muzzle.position.set(0, 11, 0);
        muzzle.castShadow = true;
        this.barrelMesh.add(muzzle);

        this.turretGroup.add(this.barrelMesh);
        this.group.add(this.turretGroup);

        const worldPos = simToWorld(tank.x, tank.y, arenaWidth, arenaHeight);
        this.group.position.set(worldPos.x, 0, worldPos.z);
        this.group.rotation.y = simAngleToWorldRotation(tank.angle);
    }

    private createFrontGlacisGeometry(): THREE.BufferGeometry {
        const halfW = 10.8;
        const vertices = new Float32Array([
            13.5,
            10.3,
            -halfW,
            17.5,
            5.0,
            -halfW,
            17.5,
            5.0,
            halfW,

            13.5,
            10.3,
            -halfW,
            17.5,
            5.0,
            halfW,
            13.5,
            10.3,
            halfW,

            17.5,
            5.0,
            -halfW,
            15.5,
            2.25,
            -halfW,
            15.5,
            2.25,
            halfW,

            17.5,
            5.0,
            -halfW,
            15.5,
            2.25,
            halfW,
            17.5,
            5.0,
            halfW,

            13.5,
            10.3,
            halfW,
            17.5,
            5.0,
            halfW,
            13.5,
            4.5,
            halfW,

            17.5,
            5.0,
            halfW,
            15.5,
            2.25,
            halfW,
            13.5,
            4.5,
            halfW,

            13.5,
            10.3,
            -halfW,
            13.5,
            4.5,
            -halfW,
            17.5,
            5.0,
            -halfW,

            17.5,
            5.0,
            -halfW,
            13.5,
            4.5,
            -halfW,
            15.5,
            2.25,
            -halfW,
        ]);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
        geo.computeVertexNormals();
        return geo;
    }

    public triggerRecoil(): void {
        this.targetRecoil = -3.8;
    }

    public getMuzzleWorldTransform(): { position: THREE.Vector3; direction: THREE.Vector3 } {
        this.group.updateMatrixWorld(true);
        const muzzlePos = new THREE.Vector3(0, 12.75, 0);
        this.barrelMesh.localToWorld(muzzlePos);
        const rot = new THREE.Quaternion();
        this.barrelMesh.getWorldQuaternion(rot);
        const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(rot).normalize();
        return { position: muzzlePos, direction: forward };
    }

    public reset(tank: SimulatedTank, arenaWidth: number, arenaHeight: number): void {
        this.isDead = false;
        this.targetRecoil = 0;
        this.recoilOffset = 0;
        this.barrelMesh.position.x = 13;

        if (this.armorMaterials[0]) {
            this.armorMaterials[0].color.copy(this.originalArmorColor);
            this.armorMaterials[0].roughness = 0.45;
            this.armorMaterials[0].metalness = 0.2;
        }
        if (this.armorMaterials[1]) {
            this.armorMaterials[1].color.copy(this.originalAccentColor);
            this.armorMaterials[1].roughness = 0.6;
            this.armorMaterials[1].metalness = 0.35;
        }

        const worldPos = simToWorld(tank.x, tank.y, arenaWidth, arenaHeight);
        this.group.position.set(worldPos.x, 0, worldPos.z);
        this.group.rotation.set(0, simAngleToWorldRotation(tank.angle), 0);
        this.turretGroup.rotation.set(0, 0, 0);
    }

    public update(
        tank: SimulatedTank,
        _camera: THREE.Camera,
        arenaWidth: number,
        arenaHeight: number,
        _delta: number,
        _isWinner: boolean = false,
    ): void {
        if (tank.isAlive && this.isDead) {
            this.reset(tank, arenaWidth, arenaHeight);
        }

        const worldPos = simToWorld(tank.x, tank.y, arenaWidth, arenaHeight);

        this.group.position.lerp(new THREE.Vector3(worldPos.x, 0, worldPos.z), 0.35);

        const targetRotY = simAngleToWorldRotation(tank.angle);
        let diff = targetRotY - this.group.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.group.rotation.y += diff * 0.3;

        const targetTurretWorld = simAngleToWorldRotation(tank.turretAngle);
        let turretDiff = targetTurretWorld - this.group.rotation.y - this.turretGroup.rotation.y;
        while (turretDiff < -Math.PI) turretDiff += Math.PI * 2;
        while (turretDiff > Math.PI) turretDiff -= Math.PI * 2;
        this.turretGroup.rotation.y += turretDiff * 0.4;

        this.recoilOffset += (this.targetRecoil - this.recoilOffset) * 0.4;
        this.targetRecoil *= 0.65;
        this.barrelMesh.position.x = 13 + this.recoilOffset;

        if (!tank.isAlive && !this.isDead) {
            this.isDead = true;

            for (const mat of this.armorMaterials) {
                mat.color.setHex(0x27272a);
                mat.roughness = 0.9;
                mat.metalness = 0.1;
            }

            this.group.rotation.z = 0.14;
            this.group.rotation.x = -0.08;
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
