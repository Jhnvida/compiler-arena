import gsap from "gsap";
import * as THREE from "three";
import type { SimulatedTank } from "../simulation/types.ts";
import type { CameraMode } from "./types.ts";
import { simToWorld } from "./types.ts";

export class CameraController {
    public readonly camera: THREE.PerspectiveCamera;
    public mode: CameraMode = "menu_orbit";

    private currentTarget = new THREE.Vector3(0, 0, 0);
    private desiredTarget = new THREE.Vector3(0, 0, 0);
    private desiredPosition = new THREE.Vector3(0, 300, 500);

    private orbitAngle = 0;
    private victoryOrbitAngle = 0;
    private isTransitioning = false;

    constructor(aspect: number) {
        this.camera = new THREE.PerspectiveCamera(45, aspect, 1, 4000);
        this.camera.position.set(0, 320, 560);
        this.camera.lookAt(0, 0, 0);
    }

    public setMode(newMode: CameraMode, winnerTank?: SimulatedTank | null, arenaWidth = 800, arenaHeight = 600): void {
        if (this.mode === newMode && !winnerTank) return;
        this.mode = newMode;

        if (newMode === "combat") {
            this.isTransitioning = true;
            gsap.to(this.camera.position, {
                x: 0,
                y: 440,
                z: 520,
                duration: 1.4,
                ease: "power2.inOut",
                onComplete: () => {
                    this.isTransitioning = false;
                },
            });
            gsap.to(this.currentTarget, {
                x: 0,
                y: 0,
                z: 0,
                duration: 1.4,
                ease: "power2.inOut",
            });
        } else if (newMode === "victory" && winnerTank) {
            const world = simToWorld(winnerTank.x, winnerTank.y, arenaWidth, arenaHeight);
            this.isTransitioning = true;
            this.victoryOrbitAngle = 0;

            gsap.to(this.currentTarget, {
                x: world.x,
                y: 8,
                z: world.z,
                duration: 1.8,
                ease: "power2.out",
            });

            gsap.to(this.camera.position, {
                x: world.x + 90,
                y: 50,
                z: world.z + 90,
                duration: 1.8,
                ease: "power2.out",
                onComplete: () => {
                    this.isTransitioning = false;
                },
            });
        } else if (newMode === "menu_orbit") {
            this.isTransitioning = true;
            gsap.to(this.currentTarget, {
                x: 0,
                y: 0,
                z: 0,
                duration: 1.2,
                ease: "power2.inOut",
            });
            gsap.to(this.camera.position, {
                x: Math.cos(this.orbitAngle) * 580,
                y: 300,
                z: Math.sin(this.orbitAngle) * 580,
                duration: 1.2,
                ease: "power2.inOut",
                onComplete: () => {
                    this.isTransitioning = false;
                },
            });
        }
    }

    public update(
        delta: number,
        tanks: SimulatedTank[],
        winner: SimulatedTank | null,
        arenaWidth: number,
        arenaHeight: number,
    ): void {
        if (this.mode === "menu_orbit") {
            this.orbitAngle += delta * 0.15;
            const radius = 620;
            const height = 300;

            if (!this.isTransitioning) {
                this.camera.position.x = Math.cos(this.orbitAngle) * radius;
                this.camera.position.z = Math.sin(this.orbitAngle) * radius;
                this.camera.position.y = height;
                this.currentTarget.set(0, 0, 0);
            }
        } else if (this.mode === "combat") {
            const aliveTanks = tanks.filter((t) => t.isAlive);

            if (aliveTanks.length > 0) {
                let sumX = 0;
                let sumZ = 0;
                let minX = Infinity;
                let maxX = -Infinity;
                let minZ = Infinity;
                let maxZ = -Infinity;

                for (const tank of aliveTanks) {
                    const w = simToWorld(tank.x, tank.y, arenaWidth, arenaHeight);
                    sumX += w.x;
                    sumZ += w.z;
                    if (w.x < minX) minX = w.x;
                    if (w.x > maxX) maxX = w.x;
                    if (w.z < minZ) minZ = w.z;
                    if (w.z > maxZ) maxZ = w.z;
                }

                const count = aliveTanks.length;
                const rawCenterX = sumX / count;
                const rawCenterZ = sumZ / count;

                const centerX = Math.max(-120, Math.min(120, rawCenterX));
                const centerZ = Math.max(-90, Math.min(90, rawCenterZ));

                const spanX = maxX - minX;
                const spanZ = maxZ - minZ;
                const maxSpan = Math.max(spanX, spanZ, 220);

                const dist = Math.max(460, 360 + maxSpan * 0.52);
                const height = Math.max(380, 300 + maxSpan * 0.42);

                this.desiredTarget.set(centerX, 0, centerZ);
                this.desiredPosition.set(centerX, height, centerZ + dist);

                if (!this.isTransitioning) {
                    this.camera.position.lerp(this.desiredPosition, 0.05);
                    this.currentTarget.lerp(this.desiredTarget, 0.08);
                }
            }
        } else if (this.mode === "victory" && winner) {
            this.victoryOrbitAngle += delta * 0.4;
            const world = simToWorld(winner.x, winner.y, arenaWidth, arenaHeight);
            const orbitRadius = 110;
            const height = 45;

            this.desiredTarget.set(world.x, 8, world.z);
            this.desiredPosition.set(
                world.x + Math.cos(this.victoryOrbitAngle) * orbitRadius,
                height,
                world.z + Math.sin(this.victoryOrbitAngle) * orbitRadius,
            );

            if (!this.isTransitioning) {
                this.camera.position.lerp(this.desiredPosition, 0.08);
                this.currentTarget.lerp(this.desiredTarget, 0.1);
            }
        }

        this.camera.lookAt(this.currentTarget);
    }

    public setAspect(aspect: number): void {
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
    }
}
