import { circleIntersectsAABB, degToRad } from "./arena.ts";
import type { ArenaConfig, Obstacle, Projectile } from "./types.ts";

let projectileCounter = 0;

export function createProjectile(
    ownerId: string,
    startX: number,
    startY: number,
    angleDeg: number,
    power: number,
    baseSpeed: number = 12,
): Projectile {
    projectileCounter++;
    const clampedPower = Math.max(1, Math.min(3, Math.round(power)));

    const speed = baseSpeed + (3 - clampedPower) * 2;
    const damage = clampedPower === 1 ? 12 : clampedPower === 2 ? 25 : 40;

    const rad = degToRad(angleDeg);
    const vx = Math.cos(rad) * speed;
    const vy = Math.sin(rad) * speed;

    return {
        id: `proj_${projectileCounter}_${Date.now()}`,
        ownerId,
        x: startX,
        y: startY,
        vx,
        vy,
        power: clampedPower,
        damage,
        radius: 4,
        alive: true,
    };
}

export interface ProjectileStepResult {
    hitType: "none" | "wall" | "obstacle";
    obstacleHit?: Obstacle;
}

export function updateProjectile(proj: Projectile, config: ArenaConfig): ProjectileStepResult {
    if (!proj.alive) {
        return { hitType: "none" };
    }

    proj.x += proj.vx;
    proj.y += proj.vy;

    if (
        proj.x - proj.radius <= 0 ||
        proj.x + proj.radius >= config.width ||
        proj.y - proj.radius <= 0 ||
        proj.y + proj.radius >= config.height
    ) {
        proj.alive = false;
        return { hitType: "wall" };
    }

    for (const obs of config.obstacles) {
        if (circleIntersectsAABB({ x: proj.x, y: proj.y }, proj.radius, obs)) {
            proj.alive = false;
            return { hitType: "obstacle", obstacleHit: obs };
        }
    }

    return { hitType: "none" };
}
