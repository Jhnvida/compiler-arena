import * as THREE from "three";
import type { Projectile } from "../simulation/types.ts";
import { simToWorld } from "./types.ts";

export type ParticleKind = "spark" | "smoke" | "fire" | "debris" | "flash" | "shockwave";

interface PooledParticle {
    mesh: THREE.Mesh;
    kind: ParticleKind;
    active: boolean;
    vx: number;
    vy: number;
    vz: number;
    drag: number;
    gravity: number;
    life: number;
    maxLife: number;
    rotSpeedX: number;
    rotSpeedY: number;
    rotSpeedZ: number;
    initialScale: number;
    targetScale: number;
    initialOpacity: number;
}

export class ParticleSystemManager {
    public readonly group: THREE.Group;

    private activeParticles: PooledParticle[] = [];

    private sparkPool: PooledParticle[] = [];
    private smokePool: PooledParticle[] = [];
    private firePool: PooledParticle[] = [];
    private debrisPool: PooledParticle[] = [];
    private flashPool: PooledParticle[] = [];
    private shockwavePool: PooledParticle[] = [];

    private projectileMeshes = new Map<string, THREE.Group>();

    private readonly sparkGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    private readonly smokeGeo = new THREE.DodecahedronGeometry(1.8, 0);
    private readonly fireGeo = new THREE.IcosahedronGeometry(2.4, 0);
    private readonly debrisGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    private readonly flashGeo = new THREE.OctahedronGeometry(3.6, 0);
    private readonly shockwaveGeo = new THREE.RingGeometry(1.5, 3.6, 16);

    constructor() {
        this.group = new THREE.Group();
        this.group.name = "particle_effects";

        this.initPools();
    }

    private initPools(): void {
        for (let i = 0; i < 140; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xfde047,
                transparent: true,
                opacity: 1,
            });
            const mesh = new THREE.Mesh(this.sparkGeo, mat);
            mesh.visible = false;
            this.group.add(mesh);
            this.sparkPool.push(this.createPooledItem(mesh, "spark"));
        }

        for (let i = 0; i < 75; i++) {
            const mat = new THREE.MeshStandardMaterial({
                color: 0x475569,
                roughness: 0.9,
                metalness: 0.05,
                flatShading: true,
                transparent: true,
                opacity: 0.7,
            });
            const mesh = new THREE.Mesh(this.smokeGeo, mat);
            mesh.visible = false;
            this.group.add(mesh);
            this.smokePool.push(this.createPooledItem(mesh, "smoke"));
        }

        for (let i = 0; i < 40; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xf97316,
                transparent: true,
                opacity: 0.95,
            });
            const mesh = new THREE.Mesh(this.fireGeo, mat);
            mesh.visible = false;
            this.group.add(mesh);
            this.firePool.push(this.createPooledItem(mesh, "fire"));
        }

        for (let i = 0; i < 40; i++) {
            const mat = new THREE.MeshStandardMaterial({
                color: 0x3f3f46,
                roughness: 0.8,
                metalness: 0.3,
                flatShading: true,
                transparent: true,
                opacity: 1,
            });
            const mesh = new THREE.Mesh(this.debrisGeo, mat);
            mesh.visible = false;
            this.group.add(mesh);
            this.debrisPool.push(this.createPooledItem(mesh, "debris"));
        }

        for (let i = 0; i < 16; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xfef08a,
                transparent: true,
                opacity: 0.95,
            });
            const mesh = new THREE.Mesh(this.flashGeo, mat);
            mesh.visible = false;
            this.group.add(mesh);
            this.flashPool.push(this.createPooledItem(mesh, "flash"));
        }

        for (let i = 0; i < 10; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xfef08a,
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide,
            });
            const mesh = new THREE.Mesh(this.shockwaveGeo, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.visible = false;
            this.group.add(mesh);
            this.shockwavePool.push(this.createPooledItem(mesh, "shockwave"));
        }
    }

    private createPooledItem(mesh: THREE.Mesh, kind: ParticleKind): PooledParticle {
        return {
            mesh,
            kind,
            active: false,
            vx: 0,
            vy: 0,
            vz: 0,
            drag: 1.0,
            gravity: -60,
            life: 0,
            maxLife: 1,
            rotSpeedX: 0,
            rotSpeedY: 0,
            rotSpeedZ: 0,
            initialScale: 1,
            targetScale: 1,
            initialOpacity: 1,
        };
    }

    private acquire(kind: ParticleKind): PooledParticle | null {
        let pool: PooledParticle[];
        switch (kind) {
            case "spark":
                pool = this.sparkPool;
                break;
            case "smoke":
                pool = this.smokePool;
                break;
            case "fire":
                pool = this.firePool;
                break;
            case "debris":
                pool = this.debrisPool;
                break;
            case "flash":
                pool = this.flashPool;
                break;
            case "shockwave":
                pool = this.shockwavePool;
                break;
        }

        for (const item of pool) {
            if (!item.active) {
                item.active = true;
                item.mesh.visible = true;
                this.activeParticles.push(item);
                return item;
            }
        }

        for (let i = 0; i < this.activeParticles.length; i++) {
            if (this.activeParticles[i].kind === kind) {
                const recycled = this.activeParticles.splice(i, 1)[0];
                recycled.active = true;
                recycled.mesh.visible = true;
                this.activeParticles.push(recycled);
                return recycled;
            }
        }

        return null;
    }

    public spawnMuzzleBlast(x: number, y: number, z: number, direction?: THREE.Vector3, power: number = 1): void {
        const dir = direction ? direction.clone().normalize() : new THREE.Vector3(1, 0, 0);
        const colorHex = power === 1 ? 0x38bdf8 : power === 2 ? 0xfbbf24 : 0xef4444;

        const flash = this.acquire("flash");
        if (flash) {
            flash.mesh.position.set(x + dir.x * 1.5, y + dir.y * 1.5, z + dir.z * 1.5);
            flash.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
            (flash.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
            flash.vx = dir.x * 4;
            flash.vy = dir.y * 4;
            flash.vz = dir.z * 4;
            flash.drag = 0.9;
            flash.gravity = 0;
            flash.life = 0.07;
            flash.maxLife = 0.07;
            flash.initialScale = 0.8 * (0.8 + power * 0.3);
            flash.targetScale = 1.6 * (0.8 + power * 0.3);
            flash.initialOpacity = 0.95;
            flash.mesh.scale.setScalar(flash.initialScale);
        }

        const sparkCount = 4 + power * 3;
        for (let i = 0; i < sparkCount; i++) {
            const p = this.acquire("spark");
            if (!p) continue;

            p.mesh.position.set(
                x + (Math.random() - 0.5) * 0.8,
                y + (Math.random() - 0.5) * 0.8,
                z + (Math.random() - 0.5) * 0.8,
            );

            const spread = 0.18;
            const sx = dir.x + (Math.random() - 0.5) * spread;
            const sy = dir.y + (Math.random() - 0.5) * spread;
            const sz = dir.z + (Math.random() - 0.5) * spread;
            const speed = 40 + Math.random() * 45;

            p.vx = sx * speed;
            p.vy = sy * speed + 5;
            p.vz = sz * speed;
            p.drag = 0.94;
            p.gravity = -45;
            p.life = 0.18 + Math.random() * 0.14;
            p.maxLife = p.life;
            p.initialScale = 0.9 + Math.random() * 0.4;
            p.targetScale = 0.2;
            p.initialOpacity = 1;
            (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xfef08a);
            p.mesh.scale.setScalar(p.initialScale);
        }

        const smoke = this.acquire("smoke");
        if (smoke) {
            smoke.mesh.position.set(x + dir.x * 2.0, y + dir.y * 2.0, z + dir.z * 2.0);
            smoke.vx = dir.x * 8 + (Math.random() - 0.5) * 4;
            smoke.vy = 4 + Math.random() * 4;
            smoke.vz = dir.z * 8 + (Math.random() - 0.5) * 4;
            smoke.drag = 0.92;
            smoke.gravity = 2;
            smoke.life = 0.45 + power * 0.15;
            smoke.maxLife = smoke.life;
            smoke.rotSpeedX = (Math.random() - 0.5) * 2;
            smoke.rotSpeedY = (Math.random() - 0.5) * 2;
            smoke.initialScale = 0.8;
            smoke.targetScale = 2.4;
            smoke.initialOpacity = 0.65;
            (smoke.mesh.material as THREE.MeshStandardMaterial).color.setHex(0x64748b);
            smoke.mesh.scale.setScalar(smoke.initialScale);
        }
    }

    public spawnMuzzleFlash(x: number, y: number, z: number, colorHex: number = 0xfef08a): void {
        this.spawnMuzzleBlast(x, y, z, undefined, colorHex === 0xef4444 ? 3 : 1);
    }

    public spawnTankImpact(x: number, y: number, z: number, incomingDir?: THREE.Vector3, power: number = 1): void {
        const reflectDir = incomingDir ? incomingDir.clone().negate().normalize() : new THREE.Vector3(0, 1, 0);

        const flash = this.acquire("flash");
        if (flash) {
            flash.mesh.position.set(x, y, z);
            (flash.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
            flash.vx = 0;
            flash.vy = 0;
            flash.vz = 0;
            flash.gravity = 0;
            flash.life = 0.06;
            flash.maxLife = 0.06;
            flash.initialScale = 1.0 + power * 0.3;
            flash.targetScale = 1.8;
            flash.initialOpacity = 1;
            flash.mesh.scale.setScalar(flash.initialScale);
        }

        const sparkCount = 14 + power * 6;
        for (let i = 0; i < sparkCount; i++) {
            const p = this.acquire("spark");
            if (!p) continue;

            p.mesh.position.set(x, y, z);
            const spreadAngle = 0.85;
            const rx = reflectDir.x + (Math.random() - 0.5) * spreadAngle * 2;
            const ry = Math.max(0.2, reflectDir.y + Math.random() * spreadAngle);
            const rz = reflectDir.z + (Math.random() - 0.5) * spreadAngle * 2;
            const speed = 25 + Math.random() * 55;

            p.vx = rx * speed;
            p.vy = ry * speed + 10;
            p.vz = rz * speed;
            p.drag = 0.95;
            p.gravity = -55;
            p.life = 0.25 + Math.random() * 0.25;
            p.maxLife = p.life;
            p.initialScale = 0.8;
            p.targetScale = 0.15;
            p.initialOpacity = 1;
            (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(i % 3 === 0 ? 0xffffff : 0xfde047);
            p.mesh.scale.setScalar(p.initialScale);
        }

        const debrisCount = 2 + power;
        for (let i = 0; i < debrisCount; i++) {
            const d = this.acquire("debris");
            if (!d) continue;

            d.mesh.position.set(x, y, z);
            d.vx = reflectDir.x * 15 + (Math.random() - 0.5) * 20;
            d.vy = 12 + Math.random() * 18;
            d.vz = reflectDir.z * 15 + (Math.random() - 0.5) * 20;
            d.drag = 0.96;
            d.gravity = -60;
            d.life = 0.4 + Math.random() * 0.3;
            d.maxLife = d.life;
            d.rotSpeedX = (Math.random() - 0.5) * 14;
            d.rotSpeedY = (Math.random() - 0.5) * 14;
            d.initialScale = 0.6;
            d.targetScale = 0.4;
            d.initialOpacity = 0.9;
            (d.mesh.material as THREE.MeshStandardMaterial).color.setHex(0x27272a);
            d.mesh.scale.setScalar(d.initialScale);
        }

        const smoke = this.acquire("smoke");
        if (smoke) {
            smoke.mesh.position.set(x, y + 1, z);
            smoke.vx = (Math.random() - 0.5) * 6;
            smoke.vy = 8 + Math.random() * 8;
            smoke.vz = (Math.random() - 0.5) * 6;
            smoke.drag = 0.94;
            smoke.gravity = 3;
            smoke.life = 0.6 + power * 0.2;
            smoke.maxLife = smoke.life;
            smoke.rotSpeedX = (Math.random() - 0.5) * 2;
            smoke.rotSpeedY = (Math.random() - 0.5) * 2;
            smoke.initialScale = 0.9;
            smoke.targetScale = 2.2;
            smoke.initialOpacity = 0.6;
            (smoke.mesh.material as THREE.MeshStandardMaterial).color.setHex(0x334155);
            smoke.mesh.scale.setScalar(smoke.initialScale);
        }
    }

    public spawnWallImpact(x: number, y: number, z: number, wallNormal?: THREE.Vector3, power: number = 1): void {
        const normal = wallNormal ? wallNormal.clone().normalize() : new THREE.Vector3(0, 1, 0);

        const sparkCount = 10 + power * 4;
        for (let i = 0; i < sparkCount; i++) {
            const p = this.acquire("spark");
            if (!p) continue;

            p.mesh.position.set(x, y, z);
            const speed = 18 + Math.random() * 38;
            const spread = 0.7;

            p.vx = (normal.x + (Math.random() - 0.5) * spread) * speed;
            p.vy = Math.max(2, normal.y + Math.random() * 0.8) * speed;
            p.vz = (normal.z + (Math.random() - 0.5) * spread) * speed;
            p.drag = 0.94;
            p.gravity = -50;
            p.life = 0.25 + Math.random() * 0.2;
            p.maxLife = p.life;
            p.initialScale = 0.7;
            p.targetScale = 0.2;
            p.initialOpacity = 0.9;
            (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xfef08a);
            p.mesh.scale.setScalar(p.initialScale);
        }

        for (let i = 0; i < 4; i++) {
            const d = this.acquire("debris");
            if (!d) continue;

            d.mesh.position.set(x, y, z);
            d.vx = normal.x * 12 + (Math.random() - 0.5) * 16;
            d.vy = 8 + Math.random() * 14;
            d.vz = normal.z * 12 + (Math.random() - 0.5) * 16;
            d.drag = 0.95;
            d.gravity = -60;
            d.life = 0.35 + Math.random() * 0.25;
            d.maxLife = d.life;
            d.rotSpeedX = (Math.random() - 0.5) * 12;
            d.rotSpeedY = (Math.random() - 0.5) * 12;
            d.initialScale = 0.6;
            d.targetScale = 0.3;
            d.initialOpacity = 0.9;
            (d.mesh.material as THREE.MeshStandardMaterial).color.setHex(0xa88d6b);
            d.mesh.scale.setScalar(d.initialScale);
        }

        const dust = this.acquire("smoke");
        if (dust) {
            dust.mesh.position.set(x + normal.x * 1.5, y, z + normal.z * 1.5);
            dust.vx = normal.x * 4 + (Math.random() - 0.5) * 3;
            dust.vy = 4 + Math.random() * 6;
            dust.vz = normal.z * 4 + (Math.random() - 0.5) * 3;
            dust.drag = 0.92;
            dust.gravity = 1;
            dust.life = 0.65;
            dust.maxLife = 0.65;
            dust.rotSpeedX = (Math.random() - 0.5) * 1.5;
            dust.rotSpeedY = (Math.random() - 0.5) * 1.5;
            dust.initialScale = 0.8;
            dust.targetScale = 2.0;
            dust.initialOpacity = 0.55;
            (dust.mesh.material as THREE.MeshStandardMaterial).color.setHex(0xd4cbb7);
            dust.mesh.scale.setScalar(dust.initialScale);
        }
    }

    public spawnImpactSparks(x: number, y: number, z: number, count: number = 16): void {
        const dummyDir = new THREE.Vector3(0, 1, 0);
        this.spawnTankImpact(x, y, z, dummyDir, count > 15 ? 2 : 1);
    }

    public spawnSmokePuff(x: number, y: number, z: number, scale = 1.0): void {
        const p = this.acquire("smoke");
        if (!p) return;

        p.mesh.position.set(x + (Math.random() - 0.5) * 3, y + 1, z + (Math.random() - 0.5) * 3);
        p.vx = (Math.random() - 0.5) * 5;
        p.vy = 6 + Math.random() * 10;
        p.vz = (Math.random() - 0.5) * 5;
        p.drag = 0.94;
        p.gravity = 2;
        p.life = 0.75 + Math.random() * 0.35;
        p.maxLife = p.life;
        p.rotSpeedX = (Math.random() - 0.5) * 2;
        p.rotSpeedY = (Math.random() - 0.5) * 2;
        p.initialScale = 0.7 * scale;
        p.targetScale = 2.0 * scale;
        p.initialOpacity = 0.6;
        (p.mesh.material as THREE.MeshStandardMaterial).color.setHex(0x475569);
        p.mesh.scale.setScalar(p.initialScale);
    }

    public spawnExplosion(x: number, y: number, z: number, intensity: number = 1.0): void {
        const flash = this.acquire("flash");
        if (flash) {
            flash.mesh.position.set(x, y + 5, z);
            (flash.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xfffaeb);
            flash.vx = 0;
            flash.vy = 2;
            flash.vz = 0;
            flash.gravity = 0;
            flash.life = 0.08;
            flash.maxLife = 0.08;
            flash.initialScale = 1.5 * intensity;
            flash.targetScale = 3.2 * intensity;
            flash.initialOpacity = 1;
            flash.mesh.scale.setScalar(flash.initialScale);
        }

        const shockwave = this.acquire("shockwave");
        if (shockwave) {
            shockwave.mesh.position.set(x, 0.4, z);
            shockwave.vx = 0;
            shockwave.vy = 0;
            shockwave.vz = 0;
            shockwave.gravity = 0;
            shockwave.life = 0.28;
            shockwave.maxLife = 0.28;
            shockwave.initialScale = 1.0;
            shockwave.targetScale = 5.5 * intensity;
            shockwave.initialOpacity = 0.85;
            shockwave.mesh.scale.setScalar(shockwave.initialScale);
        }

        const fireColors = [0xfde047, 0xf97316, 0xef4444, 0xb91c1c];
        const fireCount = 4;
        for (let i = 0; i < fireCount; i++) {
            const fire = this.acquire("fire");
            if (!fire) continue;

            const angle = (i / fireCount) * Math.PI * 2;
            const dist = (i === 0 ? 0 : 2.5) * intensity;
            fire.mesh.position.set(x + Math.cos(angle) * dist, y + 4 + i * 1.2, z + Math.sin(angle) * dist);
            fire.vx = Math.cos(angle) * 4 * intensity;
            fire.vy = 8 + Math.random() * 8;
            fire.vz = Math.sin(angle) * 4 * intensity;
            fire.drag = 0.94;
            fire.gravity = 4;
            fire.life = 0.35 + Math.random() * 0.15;
            fire.maxLife = fire.life;
            fire.rotSpeedX = (Math.random() - 0.5) * 4;
            fire.rotSpeedY = (Math.random() - 0.5) * 4;
            fire.initialScale = (1.0 + i * 0.3) * intensity;
            fire.targetScale = (2.6 + i * 0.4) * intensity;
            fire.initialOpacity = 0.95;
            (fire.mesh.material as THREE.MeshBasicMaterial).color.setHex(fireColors[i % fireColors.length]);
            fire.mesh.scale.setScalar(fire.initialScale);
        }

        const emberCount = Math.round(22 * intensity);
        for (let i = 0; i < emberCount; i++) {
            const p = this.acquire("spark");
            if (!p) continue;

            p.mesh.position.set(x, y + 4, z);
            const angle = Math.random() * Math.PI * 2;
            const speed = (25 + Math.random() * 60) * intensity;
            const elevation = 0.3 + Math.random() * 0.7;

            p.vx = Math.cos(angle) * speed;
            p.vy = elevation * speed + 15;
            p.vz = Math.sin(angle) * speed;
            p.drag = 0.95;
            p.gravity = -55;
            p.life = 0.4 + Math.random() * 0.4;
            p.maxLife = p.life;
            p.initialScale = 1.0;
            p.targetScale = 0.2;
            p.initialOpacity = 1;
            (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(
                i % 4 === 0 ? 0xfffaeb : i % 2 === 0 ? 0xfde047 : 0xf97316,
            );
            p.mesh.scale.setScalar(p.initialScale);
        }

        const debrisCount = Math.round(10 * intensity);
        for (let i = 0; i < debrisCount; i++) {
            const d = this.acquire("debris");
            if (!d) continue;

            d.mesh.position.set(x, y + 4, z);
            const angle = Math.random() * Math.PI * 2;
            const speed = (20 + Math.random() * 45) * intensity;

            d.vx = Math.cos(angle) * speed;
            d.vy = 18 + Math.random() * 32;
            d.vz = Math.sin(angle) * speed;
            d.drag = 0.96;
            d.gravity = -65;
            d.life = 0.6 + Math.random() * 0.4;
            d.maxLife = d.life;
            d.rotSpeedX = (Math.random() - 0.5) * 16;
            d.rotSpeedY = (Math.random() - 0.5) * 16;
            d.initialScale = (0.7 + Math.random() * 0.5) * intensity;
            d.targetScale = d.initialScale * 0.7;
            d.initialOpacity = 1;
            (d.mesh.material as THREE.MeshStandardMaterial).color.setHex(i % 2 === 0 ? 0x27272a : 0x3f3f46);
            d.mesh.scale.setScalar(d.initialScale);
        }

        const smokeCount = Math.round(6 * intensity);
        for (let s = 0; s < smokeCount; s++) {
            const smoke = this.acquire("smoke");
            if (!smoke) continue;

            smoke.mesh.position.set(x + (Math.random() - 0.5) * 6, y + 3 + s * 2, z + (Math.random() - 0.5) * 6);
            smoke.vx = (Math.random() - 0.5) * 8 * intensity;
            smoke.vy = (8 + Math.random() * 14) * intensity;
            smoke.vz = (Math.random() - 0.5) * 8 * intensity;
            smoke.drag = 0.94;
            smoke.gravity = 2.5;
            smoke.life = 0.9 + Math.random() * 0.5;
            smoke.maxLife = smoke.life;
            smoke.rotSpeedX = (Math.random() - 0.5) * 2.5;
            smoke.rotSpeedY = (Math.random() - 0.5) * 2.5;
            smoke.initialScale = (1.2 + Math.random() * 0.6) * intensity;
            smoke.targetScale = (3.2 + Math.random() * 1.2) * intensity;
            smoke.initialOpacity = 0.75;
            (smoke.mesh.material as THREE.MeshStandardMaterial).color.setHex(s % 2 === 0 ? 0x334155 : 0x1e293b);
            smoke.mesh.scale.setScalar(smoke.initialScale);
        }
    }

    public spawnTankDestruction(x: number, y: number, z: number): void {
        this.spawnExplosion(x, y, z, 1.8);

        for (let i = 0; i < 4; i++) {
            setTimeout(
                () => {
                    const offX = x + (Math.random() - 0.5) * 12;
                    const offZ = z + (Math.random() - 0.5) * 12;
                    this.spawnSmokePuff(offX, y + 4, offZ, 2.2 + Math.random());
                },
                100 * (i + 1),
            );
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
            const projY = 12.5;

            const headingWorld = Math.atan2(proj.vy, proj.vx);

            if (!group) {
                group = new THREE.Group();
                group.name = `proj_${proj.id}`;

                const power = proj.power;
                const colorHex = power === 1 ? 0x38bdf8 : power === 2 ? 0xf59e0b : 0xef4444;

                const slugLength = power === 1 ? 7 : power === 2 ? 8.5 : 10;
                const slugRadius = power === 1 ? 1.6 : power === 2 ? 2.2 : 2.8;

                const slugGeo = new THREE.CylinderGeometry(slugRadius * 0.4, slugRadius, slugLength, 8);
                slugGeo.rotateX(Math.PI / 2);
                const slugMat = new THREE.MeshBasicMaterial({ color: colorHex });
                const slugMesh = new THREE.Mesh(slugGeo, slugMat);
                group.add(slugMesh);

                const tipGeo = new THREE.ConeGeometry(slugRadius * 0.6, slugLength * 0.4, 8);
                tipGeo.rotateX(Math.PI / 2);
                tipGeo.translate(0, 0, slugLength * 0.5);
                const tipMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                const tipMesh = new THREE.Mesh(tipGeo, tipMat);
                group.add(tipMesh);

                const haloGeo = new THREE.SphereGeometry(slugRadius * 1.8, 8, 6);
                const haloMat = new THREE.MeshBasicMaterial({
                    color: colorHex,
                    transparent: true,
                    opacity: 0.38,
                });
                const haloMesh = new THREE.Mesh(haloGeo, haloMat);
                group.add(haloMesh);

                group.position.set(world.x, projY, world.z);
                group.rotation.y = -headingWorld + Math.PI / 2;

                this.group.add(group);
                this.projectileMeshes.set(proj.id, group);
            } else {
                group.position.set(world.x, projY, world.z);
                group.rotation.y = -headingWorld + Math.PI / 2;

                const spark = this.acquire("spark");
                if (spark) {
                    spark.mesh.position.set(
                        world.x + (Math.random() - 0.5) * 1.0,
                        projY + (Math.random() - 0.5) * 0.8,
                        world.z + (Math.random() - 0.5) * 1.0,
                    );
                    spark.vx = (Math.random() - 0.5) * 3;
                    spark.vy = (Math.random() - 0.5) * 3;
                    spark.vz = (Math.random() - 0.5) * 3;
                    spark.drag = 0.9;
                    spark.gravity = 0;
                    spark.life = 0.16;
                    spark.maxLife = 0.16;
                    spark.initialScale = proj.power === 1 ? 0.7 : proj.power === 2 ? 1.0 : 1.3;
                    spark.targetScale = 0.1;
                    spark.initialOpacity = 0.85;
                    const trailColor = proj.power === 1 ? 0xbae6fd : proj.power === 2 ? 0xfde047 : 0xf87171;
                    (spark.mesh.material as THREE.MeshBasicMaterial).color.setHex(trailColor);
                    spark.mesh.scale.setScalar(spark.initialScale);
                }
            }
        }
    }

    public update(delta: number): void {
        const remaining: PooledParticle[] = [];

        for (let i = 0; i < this.activeParticles.length; i++) {
            const p = this.activeParticles[i];
            p.life -= delta;

            if (p.life <= 0) {
                p.active = false;
                p.mesh.visible = false;
                continue;
            }

            p.vy += p.gravity * delta;
            p.vx *= Math.pow(p.drag, delta * 60);
            p.vz *= Math.pow(p.drag, delta * 60);

            p.mesh.position.x += p.vx * delta;
            p.mesh.position.y = Math.max(0.4, p.mesh.position.y + p.vy * delta);
            p.mesh.position.z += p.vz * delta;

            p.mesh.rotation.x += p.rotSpeedX * delta;
            p.mesh.rotation.y += p.rotSpeedY * delta;
            p.mesh.rotation.z += p.rotSpeedZ * delta;

            const progress = 1 - Math.max(0, p.life / p.maxLife);
            const currentScale = p.initialScale + (p.targetScale - p.initialScale) * progress;
            p.mesh.scale.setScalar(Math.max(0.01, currentScale));

            const alpha = p.initialOpacity * (1 - progress);
            if (p.mesh.material && "opacity" in p.mesh.material) {
                (p.mesh.material as THREE.Material & { opacity: number }).opacity = alpha;
            }

            remaining.push(p);
        }

        this.activeParticles = remaining;
    }

    public clear(): void {
        for (const p of this.activeParticles) {
            p.active = false;
            p.mesh.visible = false;
        }
        this.activeParticles = [];

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

    public dispose(): void {
        this.clear();

        const allPools = [
            this.sparkPool,
            this.smokePool,
            this.firePool,
            this.debrisPool,
            this.flashPool,
            this.shockwavePool,
        ];

        for (const pool of allPools) {
            for (const item of pool) {
                this.group.remove(item.mesh);
                if (Array.isArray(item.mesh.material)) {
                    item.mesh.material.forEach((m) => m.dispose());
                } else {
                    item.mesh.material.dispose();
                }
            }
            pool.length = 0;
        }

        this.sparkGeo.dispose();
        this.smokeGeo.dispose();
        this.fireGeo.dispose();
        this.debrisGeo.dispose();
        this.flashGeo.dispose();
        this.shockwaveGeo.dispose();
    }
}
