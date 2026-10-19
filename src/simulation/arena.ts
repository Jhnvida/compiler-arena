import type { ArenaConfig, Obstacle, Point2D } from "./types.ts";

export function normalizeAngle(deg: number): number {
    let angle = deg % 360;
    if (angle < 0) {
        angle += 360;
    }
    return angle;
}

export function normalizeAngleSigned(deg: number): number {
    let angle = deg % 360;
    if (angle > 180) {
        angle -= 360;
    } else if (angle <= -180) {
        angle += 360;
    }
    return angle;
}

export function degToRad(deg: number): number {
    return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
    return (rad * 180) / Math.PI;
}

export function distance(p1: Point2D, p2: Point2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.hypot(dx, dy);
}

export function angleBetween(p1: Point2D, p2: Point2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const rad = Math.atan2(dy, dx);
    return normalizeAngle(radToDeg(rad));
}

export function relativeAngle(currentAngle: number, targetAngle: number): number {
    return normalizeAngleSigned(targetAngle - currentAngle);
}

export function circleIntersectsCircle(c1: Point2D, r1: number, c2: Point2D, r2: number): boolean {
    return distance(c1, c2) < r1 + r2;
}

export function circleIntersectsAABB(circle: Point2D, radius: number, box: Obstacle): boolean {
    const halfW = box.width / 2;
    const halfH = box.height / 2;

    const closestX = Math.max(box.x - halfW, Math.min(circle.x, box.x + halfW));
    const closestY = Math.max(box.y - halfH, Math.min(circle.y, box.y + halfH));

    const distX = circle.x - closestX;
    const distY = circle.y - closestY;

    return distX * distX + distY * distY < radius * radius;
}

export function pointInsideAABB(point: Point2D, box: Obstacle): boolean {
    const halfW = box.width / 2;
    const halfH = box.height / 2;
    return point.x >= box.x - halfW && point.x <= box.x + halfW && point.y >= box.y - halfH && point.y <= box.y + halfH;
}

export function lineIntersectsAABB(p1: Point2D, p2: Point2D, box: Obstacle): boolean {
    const halfW = box.width / 2;
    const halfH = box.height / 2;
    const minX = box.x - halfW;
    const maxX = box.x + halfW;
    const minY = box.y - halfH;
    const maxY = box.y + halfH;

    if (pointInsideAABB(p1, box) || pointInsideAABB(p2, box)) {
        return true;
    }

    let t0 = 0.0;
    let t1 = 1.0;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    const p = [-dx, dx, -dy, dy];
    const q = [p1.x - minX, maxX - p1.x, p1.y - minY, maxY - p1.y];

    for (let i = 0; i < 4; i++) {
        if (p[i] === 0) {
            if (q[i] < 0) return false;
        } else {
            const t = q[i] / p[i];
            if (p[i] < 0) {
                if (t > t1) return false;
                if (t > t0) t0 = t;
            } else {
                if (t < t0) return false;
                if (t < t1) t1 = t;
            }
        }
    }

    return t0 <= t1;
}

export const DEFAULT_OBSTACLES: Obstacle[] = [
    { id: "obs-center-left", x: 260, y: 300, width: 70, height: 70, shape: "box" },
    { id: "obs-center-right", x: 540, y: 300, width: 70, height: 70, shape: "box" },
    { id: "obs-top", x: 400, y: 150, width: 100, height: 50, shape: "box" },
    { id: "obs-bottom", x: 400, y: 450, width: 100, height: 50, shape: "box" },
];

export const DEFAULT_ARENA_CONFIG: ArenaConfig = {
    width: 800,
    height: 600,
    obstacles: DEFAULT_OBSTACLES,
    maxTicks: 3000,
    defaultTankEnergy: 100,
    tankRadius: 22,
    projectileSpeedBase: 12,
    fireCooldownTicks: 6,
    maxInstructionsPerTick: 100,
};
