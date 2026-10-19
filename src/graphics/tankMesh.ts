import * as THREE from "three";
import type { SimulatedTank } from "../simulation/types.ts";
import { simAngleToWorldRotation, simToWorld } from "./types.ts";

export class TankMeshController {
    public readonly id: string;
    public readonly group: THREE.Group;
    public readonly turretGroup: THREE.Group;
    public readonly barrelMesh: THREE.Mesh;
    public readonly healthBarFill: THREE.Mesh;
    public readonly healthBarGroup: THREE.Group;
    public readonly victoryBeacon: THREE.Group;
    public readonly armorMaterials: THREE.MeshStandardMaterial[] = [];

    private isDead = false;
    private recoilOffset = 0;
    private targetRecoil = 0;

    constructor(tank: SimulatedTank, arenaWidth: number, arenaHeight: number) {
        this.id = tank.id;
        this.group = new THREE.Group();
        this.group.name = `tank_${tank.id}`;

        const color = new THREE.Color(tank.color);
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

        const chassisGeo = new THREE.BoxGeometry(32, 9, 24);
        const chassisMesh = new THREE.Mesh(chassisGeo, armorMat);
        chassisMesh.position.y = 7;
        chassisMesh.castShadow = true;
        chassisMesh.receiveShadow = true;
        this.group.add(chassisMesh);

        const wedgeGeo = new THREE.CylinderGeometry(0, 13, 8, 4);
        const wedgeMesh = new THREE.Mesh(wedgeGeo, armorMat);
        wedgeMesh.rotation.y = Math.PI / 4;
        wedgeMesh.rotation.z = -Math.PI / 2;
        wedgeMesh.position.set(16, 6, 0);
        wedgeMesh.scale.set(0.7, 1.2, 0.7);
        wedgeMesh.castShadow = true;
        this.group.add(wedgeMesh);

        const skirtGeo = new THREE.BoxGeometry(26, 3, 1);
        const skirtL = new THREE.Mesh(skirtGeo, accentMat);
        skirtL.position.set(0, 7.5, 12.5);
        skirtL.castShadow = true;
        this.group.add(skirtL);

        const skirtR = new THREE.Mesh(skirtGeo, accentMat);
        skirtR.position.set(0, 7.5, -12.5);
        skirtR.castShadow = true;
        this.group.add(skirtR);

        const trackGeo = new THREE.BoxGeometry(38, 7, 6);
        const leftTrack = new THREE.Mesh(trackGeo, darkMetal);
        leftTrack.position.set(0, 3.5, 14);
        leftTrack.castShadow = true;
        leftTrack.receiveShadow = true;
        this.group.add(leftTrack);

        const rightTrack = new THREE.Mesh(trackGeo, darkMetal);
        rightTrack.position.set(0, 3.5, -14);
        rightTrack.castShadow = true;
        rightTrack.receiveShadow = true;
        this.group.add(rightTrack);

        const wheelGeo = new THREE.CylinderGeometry(2.8, 2.8, 1, 8);
        const wheelMat = new THREE.MeshStandardMaterial({
            color: 0x52525b,
            roughness: 0.7,
            metalness: 0.4,
            flatShading: true,
        });

        for (const z of [17.1, -17.1]) {
            for (let x = -13; x <= 13; x += 6.5) {
                const wheel = new THREE.Mesh(wheelGeo, wheelMat);
                wheel.rotation.x = Math.PI / 2;
                wheel.position.set(x, 3.2, z > 0 ? 14 + 3.1 : -14 - 3.1);
                wheel.castShadow = true;
                this.group.add(wheel);
            }
        }

        this.turretGroup = new THREE.Group();
        this.turretGroup.position.set(-2, 11.5, 0);

        const turretBaseGeo = new THREE.CylinderGeometry(9, 11, 6, 8);
        const turretBase = new THREE.Mesh(turretBaseGeo, armorMat);
        turretBase.castShadow = true;
        turretBase.receiveShadow = true;
        this.turretGroup.add(turretBase);

        const hatchGeo = new THREE.CylinderGeometry(3.5, 3.5, 1.5, 8);
        const hatch = new THREE.Mesh(hatchGeo, darkMetal);
        hatch.position.set(-2, 3.5, 0);
        hatch.castShadow = true;
        this.turretGroup.add(hatch);

        const mantletGeo = new THREE.BoxGeometry(4, 5, 8);
        const mantlet = new THREE.Mesh(mantletGeo, accentMat);
        mantlet.position.set(9, 1, 0);
        mantlet.castShadow = true;
        this.turretGroup.add(mantlet);

        const barrelGeo = new THREE.CylinderGeometry(1.6, 2.2, 22, 8);
        this.barrelMesh = new THREE.Mesh(barrelGeo, darkMetal);
        this.barrelMesh.rotation.z = -Math.PI / 2;
        this.barrelMesh.position.set(13, 1, 0);
        this.barrelMesh.castShadow = true;
        this.turretGroup.add(this.barrelMesh);

        const muzzleGeo = new THREE.CylinderGeometry(2.4, 2.4, 3.5, 8);
        const muzzle = new THREE.Mesh(muzzleGeo, darkMetal);
        muzzle.rotation.z = -Math.PI / 2;
        muzzle.position.set(24, 1, 0);
        muzzle.castShadow = true;
        this.turretGroup.add(muzzle);

        this.group.add(this.turretGroup);

        this.healthBarGroup = new THREE.Group();
        this.healthBarGroup.position.set(0, 24, 0);

        const barBgGeo = new THREE.PlaneGeometry(28, 3.5);
        const barBgMat = new THREE.MeshBasicMaterial({
            color: 0x18181b,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
        });
        const barBg = new THREE.Mesh(barBgGeo, barBgMat);
        this.healthBarGroup.add(barBg);

        const barBorderGeo = new THREE.PlaneGeometry(29, 4.5);
        const barBorderMat = new THREE.MeshBasicMaterial({
            color: 0x3f3f46,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7,
        });
        const barBorder = new THREE.Mesh(barBorderGeo, barBorderMat);
        barBorder.position.z = -0.05;
        this.healthBarGroup.add(barBorder);

        const barFillGeo = new THREE.PlaneGeometry(26, 2.5);
        barFillGeo.translate(13, 0, 0);
        const barFillMat = new THREE.MeshBasicMaterial({
            color: 0x16a34a,
            side: THREE.DoubleSide,
        });
        this.healthBarFill = new THREE.Mesh(barFillGeo, barFillMat);
        this.healthBarFill.position.set(-13, 0, 0.05);
        this.healthBarGroup.add(this.healthBarFill);

        this.group.add(this.healthBarGroup);

        const beaconGroup = new THREE.Group();
        beaconGroup.position.set(0, 30, 0);
        beaconGroup.visible = false;
        beaconGroup.name = "victory_beacon";

        const starMat = new THREE.MeshStandardMaterial({
            color: 0xeab308,
            roughness: 0.3,
            metalness: 0.5,
            flatShading: true,
        });

        const starGeo = new THREE.OctahedronGeometry(5, 0);
        const starMesh = new THREE.Mesh(starGeo, starMat);
        starMesh.scale.set(1.2, 1.4, 0.6);
        beaconGroup.add(starMesh);

        this.group.add(beaconGroup);
        this.victoryBeacon = beaconGroup;

        const worldPos = simToWorld(tank.x, tank.y, arenaWidth, arenaHeight);
        this.group.position.set(worldPos.x, 0, worldPos.z);
        this.group.rotation.y = simAngleToWorldRotation(tank.angle);
    }

    public triggerRecoil(): void {
        this.targetRecoil = -3.8;
    }

    public update(
        tank: SimulatedTank,
        camera: THREE.Camera,
        arenaWidth: number,
        arenaHeight: number,
        delta: number,
        isWinner: boolean = false,
    ): void {
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

        this.healthBarGroup.quaternion.copy(camera.quaternion);

        const hpRatio = Math.max(0, Math.min(1, tank.energy / tank.maxEnergy));
        this.healthBarFill.scale.x = hpRatio;

        const fillMat = this.healthBarFill.material as THREE.MeshBasicMaterial;
        if (hpRatio > 0.5) {
            fillMat.color.setHex(0x16a34a);
        } else if (hpRatio > 0.25) {
            fillMat.color.setHex(0xd97706);
        } else {
            fillMat.color.setHex(0xdc2626);
        }

        if (isWinner && tank.isAlive) {
            this.victoryBeacon.visible = true;
            this.victoryBeacon.rotation.y += delta * 2.2;
            this.victoryBeacon.position.y = 30 + Math.sin(performance.now() * 0.004) * 2;
        } else {
            this.victoryBeacon.visible = false;
        }

        if (!tank.isAlive && !this.isDead) {
            this.isDead = true;
            this.healthBarGroup.visible = false;
            this.victoryBeacon.visible = false;

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
