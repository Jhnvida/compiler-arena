import * as THREE from "three";
import type { Projectile } from "../simulation/types.ts";
import { simToWorld } from "./types.ts";

interface Particle {
    mesh: THREE.Mesh;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    maxLife: number;
    rotSpeedX: number;
    rotSpeedY: number;
    scaleDecay: number;
}

export class ParticleSystemManager {
    public readonly group: THREE.Group;
    private particles: Particle[] = [];
    private projectileMeshes = new Map<string, THREE.Group>();

    private readonly sparkGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    private readonly smokeGeo = new THREE.DodecahedronGeometry(2, 0);
    private readonly debrisGeo = new THREE.BoxGeometry(2, 2, 2);

    private readonly sparkMat = new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
    });
    private readonly fireMat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
    });
    private readonly smokeMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.9,
        transparent: true,
        opacity: 0.65,
        flatShading: true,
    });

    constructor() {
        this.group = new THREE.Group();
        this.group.name = "particle_effects";
    }

    public spawnMuzzleFlash(x: number, y: number, z: number, colorHex: number = 0xfef08a): void {
        const flashGeo = new THREE.OctahedronGeometry(3.5, 0);
        const flashMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.9,
        });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.set(x, y, z);
        this.group.add(flash);

        this.particles.push({
            mesh: flash,
            vx: 0,
            vy: 0,
            vz: 0,
            life: 0.08,
            maxLife: 0.08,
            rotSpeedX: 5,
            rotSpeedY: 5,
            scaleDecay: 1.2,
        });
    }

    public spawnImpactSparks(x: number, y: number, z: number, count: number = 16): void {
        for (let i = 0; i < count; i++) {
            const p = new THREE.Mesh(this.sparkGeo, this.sparkMat.clone());
            p.position.set(x, y, z);

            const angle = Math.random() * Math.PI * 2;
            const speed = 20 + Math.random() * 40;
            const vx = Math.cos(angle) * speed;
            const vz = Math.sin(angle) * speed;
            const vy = 15 + Math.random() * 35;

            this.group.add(p);
            this.particles.push({
                mesh: p,
                vx,
                vy,
                vz,
                life: 0.35 + Math.random() * 0.25,
                maxLife: 0.6,
                rotSpeedX: (Math.random() - 0.5) * 10,
                rotSpeedY: (Math.random() - 0.5) * 10,
                scaleDecay: 0.92,
            });
        }
    }

    public spawnSmokePuff(x: number, y: number, z: number, scale = 1.0): void {
        const p = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
        p.position.set(x + (Math.random() - 0.5) * 4, y + 1, z + (Math.random() - 0.5) * 4);
        p.scale.setScalar(scale);

        this.group.add(p);
        this.particles.push({
            mesh: p,
            vx: (Math.random() - 0.5) * 6,
            vy: 8 + Math.random() * 12,
            vz: (Math.random() - 0.5) * 6,
            life: 0.8 + Math.random() * 0.4,
            maxLife: 1.2,
            rotSpeedX: (Math.random() - 0.5) * 2,
            rotSpeedY: (Math.random() - 0.5) * 2,
            scaleDecay: 1.015,
        });
    }

    public spawnExplosion(x: number, y: number, z: number): void {
        const coreGeo = new THREE.IcosahedronGeometry(12, 0);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xf97316,
            transparent: true,
            opacity: 0.95,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.set(x, y + 8, z);
        this.group.add(core);

        this.particles.push({
            mesh: core,
            vx: 0,
            vy: 10,
            vz: 0,
            life: 0.45,
            maxLife: 0.45,
            rotSpeedX: 3,
            rotSpeedY: 4,
            scaleDecay: 1.04,
        });

        for (let i = 0; i < 28; i++) {
            const debris = new THREE.Mesh(this.debrisGeo, i % 2 === 0 ? this.fireMat.clone() : this.smokeMat.clone());
            debris.position.set(x, y + 6, z);
            const angle = Math.random() * Math.PI * 2;
            const speed = 30 + Math.random() * 60;
            const vx = Math.cos(angle) * speed;
            const vz = Math.sin(angle) * speed;
            const vy = 25 + Math.random() * 45;

            this.group.add(debris);
            this.particles.push({
                mesh: debris,
                vx,
                vy,
                vz,
                life: 0.7 + Math.random() * 0.5,
                maxLife: 1.2,
                rotSpeedX: (Math.random() - 0.5) * 12,
                rotSpeedY: (Math.random() - 0.5) * 12,
                scaleDecay: 0.95,
            });
        }

        for (let s = 0; s < 8; s++) {
            this.spawnSmokePuff(x, y + 4, z, 1.8 + Math.random());
        }
    }

    public syncProjectiles(projectiles: Projectile[], arenaWidth: number, arenaHeight: number): void {
        const currentIds = new Set(projectiles.map((p) => p.id));

        for (const [id, group] of this.projectileMeshes.entries()) {
            if (!currentIds.has(id)) {
                this.group.remove(group);
                group.traverse((c) => {
                    if (c instanceof THREE.Mesh) {
                        c.geometry.dispose();
                        if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
                        else c.material.dispose();
                    }
                });
                this.projectileMeshes.delete(id);
            }
        }

        for (const proj of projectiles) {
            if (!proj.alive) continue;

            let group = this.projectileMeshes.get(proj.id);
            const world = simToWorld(proj.x, proj.y, arenaWidth, arenaHeight);
            const projY = 12;

            if (!group) {
                group = new THREE.Group();
                group.name = `proj_${proj.id}`;

                const colorHex = proj.power === 1 ? 0x38bdf8 : proj.power === 2 ? 0xf59e0b : 0xef4444;

                const bulletGeo = new THREE.SphereGeometry(proj.radius, 8, 6);
                const bulletMat = new THREE.MeshBasicMaterial({ color: colorHex });
                const bulletMesh = new THREE.Mesh(bulletGeo, bulletMat);
                group.add(bulletMesh);

                const haloGeo = new THREE.SphereGeometry(proj.radius * 1.8, 8, 6);
                const haloMat = new THREE.MeshBasicMaterial({
                    color: colorHex,
                    transparent: true,
                    opacity: 0.35,
                });
                const haloMesh = new THREE.Mesh(haloGeo, haloMat);
                group.add(haloMesh);

                group.position.set(world.x, projY, world.z);
                this.group.add(group);
                this.projectileMeshes.set(proj.id, group);
            } else {
                group.position.set(world.x, projY, world.z);

                if (Math.random() < 0.4) {
                    const trail = new THREE.Mesh(this.sparkGeo, this.sparkMat.clone());
                    trail.position.set(world.x, projY, world.z);
                    trail.scale.setScalar(0.6);
                    this.group.add(trail);
                    this.particles.push({
                        mesh: trail,
                        vx: (Math.random() - 0.5) * 5,
                        vy: (Math.random() - 0.5) * 5,
                        vz: (Math.random() - 0.5) * 5,
                        life: 0.15,
                        maxLife: 0.15,
                        rotSpeedX: 0,
                        rotSpeedY: 0,
                        scaleDecay: 0.85,
                    });
                }
            }
        }
    }

    public update(delta: number): void {
        const remaining: Particle[] = [];
        const gravity = -60;

        for (const p of this.particles) {
            p.life -= delta;

            if (p.life <= 0) {
                this.group.remove(p.mesh);
                p.mesh.geometry.dispose();
                if (Array.isArray(p.mesh.material)) {
                    p.mesh.material.forEach((m) => m.dispose());
                } else {
                    p.mesh.material.dispose();
                }
                continue;
            }

            p.vy += gravity * delta;
            p.mesh.position.x += p.vx * delta;
            p.mesh.position.y = Math.max(0.5, p.mesh.position.y + p.vy * delta);
            p.mesh.position.z += p.vz * delta;

            p.mesh.rotation.x += p.rotSpeedX * delta;
            p.mesh.rotation.y += p.rotSpeedY * delta;

            p.mesh.scale.multiplyScalar(p.scaleDecay);

            const alpha = Math.max(0, p.life / p.maxLife);
            if (p.mesh.material && "opacity" in p.mesh.material) {
                (p.mesh.material as THREE.Material & { opacity: number }).opacity = alpha;
            }

            remaining.push(p);
        }

        this.particles = remaining;
    }

    public dispose(): void {
        for (const p of this.particles) {
            this.group.remove(p.mesh);
            p.mesh.geometry.dispose();
            if (Array.isArray(p.mesh.material)) {
                p.mesh.material.forEach((m) => m.dispose());
            } else {
                p.mesh.material.dispose();
            }
        }
        this.particles = [];

        for (const group of this.projectileMeshes.values()) {
            this.group.remove(group);
            group.traverse((c) => {
                if (c instanceof THREE.Mesh) {
                    c.geometry.dispose();
                    if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
                    else c.material.dispose();
                }
            });
        }
        this.projectileMeshes.clear();
    }
}
