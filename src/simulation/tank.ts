import type { BytecodeProgram } from "../compiler/bytecode.ts";
import type { TankSensors } from "../vm/types.ts";
import { VirtualMachine } from "../vm/virtualMachine.ts";
import {
    angleBetween,
    circleIntersectsAABB,
    circleIntersectsCircle,
    degToRad,
    distance,
    lineIntersectsAABB,
    normalizeAngle,
    relativeAngle,
} from "./arena.ts";
import type { ArenaConfig, Obstacle, SimulatedTank } from "./types.ts";

export function createSimulatedTank(
    id: string,
    name: string,
    color: string,
    program: BytecodeProgram,
    x: number,
    y: number,
    angle: number = 0,
    config?: Partial<ArenaConfig>,
): SimulatedTank {
    const maxEnergy = config?.defaultTankEnergy ?? 100;
    const radius = config?.tankRadius ?? 22;
    const maxInstructions = config?.maxInstructionsPerTick ?? 100;

    const vm = new VirtualMachine(program, {
        maxInstructionsPerTick: maxInstructions,
        loopOnCompletion: true,
    });

    const sensors: TankSensors = {
        energy: maxEnergy,
        position: { x: Math.round(x), y: Math.round(y) },
        enemy: {
            visible: false,
            distance: 999,
            direction: 0,
        },
    };

    return {
        id,
        name,
        color,
        x,
        y,
        angle: normalizeAngle(angle),
        turretAngle: normalizeAngle(angle),
        energy: maxEnergy,
        maxEnergy,
        radius,
        isAlive: true,
        vm,
        lastAction: null,
        lastExecutionResult: null,
        stats: {
            shotsFired: 0,
            shotsHit: 0,
            damageDealt: 0,
            damageReceived: 0,
            kills: 0,
        },
        cooldown: 0,
        sensors,
    };
}

export function findSafeSpawn(
    existingTanks: SimulatedTank[],
    obstacles: Obstacle[],
    width: number,
    height: number,
    radius: number,
    maxAttempts: number = 400,
): { x: number; y: number; angle: number } {
    const margin = radius + 48;
    const minX = margin;
    const maxX = width - margin;
    const minY = margin;
    const maxY = height - margin;

    const baseSeparation = existingTanks.length <= 1 ? 250 : existingTanks.length <= 3 ? 205 : Math.max(140, 205 - (existingTanks.length - 3) * 10);
    const minFloorSeparation = existingTanks.length <= 3 ? 200 : 110;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let separation = baseSeparation;
        if (attempt > 200) {
            separation = Math.max(minFloorSeparation, baseSeparation - 25);
        } else if (attempt > 300) {
            separation = Math.max(minFloorSeparation, baseSeparation - 45);
        }

        const x = minX + Math.random() * (maxX - minX);
        const y = minY + Math.random() * (maxY - minY);
        const candidate = { x, y };

        let collides = false;

        for (const obs of obstacles) {
            if (circleIntersectsAABB(candidate, radius + 25, obs)) {
                collides = true;
                break;
            }
        }
        if (collides) continue;

        for (const other of existingTanks) {
            if (distance(candidate, { x: other.x, y: other.y }) < separation) {
                collides = true;
                break;
            }
        }
        if (collides) continue;

        const distToCenter = distance(candidate, { x: width / 2, y: height / 2 });
        let angle: number;
        if (distToCenter < 60) {
            angle = Math.round(Math.random() * 360);
        } else {
            const centerAngle = angleBetween(candidate, { x: width / 2, y: height / 2 });
            const angleJitter = (Math.random() - 0.5) * 90;
            angle = Math.round(normalizeAngle(centerAngle + angleJitter));
        }

        return { x: Math.round(x), y: Math.round(y), angle };
    }

    const fallbackCandidates = [
        { x: margin + 40, y: margin + 40 },
        { x: width - margin - 40, y: height - margin - 40 },
        { x: width - margin - 40, y: margin + 40 },
        { x: margin + 40, y: height - margin - 40 },
        { x: width / 2, y: margin + 40 },
        { x: width / 2, y: height - margin - 40 },
        { x: margin + 40, y: height / 2 },
        { x: width - margin - 40, y: height / 2 },
    ];

    const validFallbacks = fallbackCandidates.filter((cand) => {
        return !obstacles.some((obs) => circleIntersectsAABB(cand, radius + 15, obs));
    });

    const candidatesToScore = validFallbacks.length > 0 ? validFallbacks : fallbackCandidates;

    let bestSpot = candidatesToScore[0];
    let maxMinDist = -1;

    for (const cand of candidatesToScore) {
        if (existingTanks.length === 0) {
            bestSpot = candidatesToScore[Math.floor(Math.random() * candidatesToScore.length)];
            break;
        }
        let minDist = Infinity;
        for (const other of existingTanks) {
            const d = distance(cand, { x: other.x, y: other.y });
            if (d < minDist) minDist = d;
        }
        if (minDist > maxMinDist) {
            maxMinDist = minDist;
            bestSpot = cand;
        }
    }

    const fallbackCenterAngle = angleBetween(bestSpot, { x: width / 2, y: height / 2 });
    const fallbackAngle = Math.round(normalizeAngle(fallbackCenterAngle + (Math.random() - 0.5) * 60));

    return {
        x: Math.round(bestSpot.x),
        y: Math.round(bestSpot.y),
        angle: fallbackAngle,
    };
}

export function scanForEnemies(
    tank: SimulatedTank,
    allTanks: SimulatedTank[],
    obstacles: Obstacle[],
    maxRange: number = 1000,
): { visible: boolean; distance: number; direction: number } {
    let nearestDist = Infinity;
    let nearestDirection = 0;
    let found = false;

    for (const other of allTanks) {
        if (!other.isAlive || other.id === tank.id) {
            continue;
        }

        const d = distance({ x: tank.x, y: tank.y }, { x: other.x, y: other.y });
        if (d > maxRange) {
            continue;
        }

        let blocked = false;
        for (const obs of obstacles) {
            if (lineIntersectsAABB({ x: tank.x, y: tank.y }, { x: other.x, y: other.y }, obs)) {
                blocked = true;
                break;
            }
        }

        if (!blocked && d < nearestDist) {
            nearestDist = d;
            const absoluteTargetAngle = angleBetween({ x: tank.x, y: tank.y }, { x: other.x, y: other.y });
            nearestDirection = relativeAngle(tank.angle, absoluteTargetAngle);
            found = true;
        }
    }

    if (found) {
        return {
            visible: true,
            distance: Math.round(nearestDist),
            direction: Math.round(nearestDirection),
        };
    }

    return {
        visible: false,
        distance: 999,
        direction: 0,
    };
}

export function updateTankSensors(tank: SimulatedTank, allTanks: SimulatedTank[], obstacles: Obstacle[]): void {
    tank.sensors.energy = Math.max(0, Math.round(tank.energy));
    tank.sensors.position.x = Math.round(tank.x);
    tank.sensors.position.y = Math.round(tank.y);

    const radar = scanForEnemies(tank, allTanks, obstacles);
    tank.sensors.enemy.visible = radar.visible;
    tank.sensors.enemy.distance = radar.distance;
    tank.sensors.enemy.direction = radar.direction;
}

export function applyTankMovement(
    tank: SimulatedTank,
    distanceUnits: number,
    allTanks: SimulatedTank[],
    config: ArenaConfig,
): { moved: boolean; collided: boolean; colliderType?: "wall" | "obstacle" | "tank" } {
    const rad = degToRad(tank.angle);
    const dx = Math.cos(rad) * distanceUnits;
    const dy = Math.sin(rad) * distanceUnits;

    const steps = Math.max(1, Math.ceil(Math.abs(distanceUnits) / 5));
    const stepX = dx / steps;
    const stepY = dy / steps;

    let totalMovedX = 0;
    let totalMovedY = 0;
    let collided = false;
    let colliderType: "wall" | "obstacle" | "tank" | undefined;

    for (let s = 0; s < steps; s++) {
        const nextX = tank.x + stepX;
        const nextY = tank.y + stepY;

        if (
            nextX - tank.radius < 0 ||
            nextX + tank.radius > config.width ||
            nextY - tank.radius < 0 ||
            nextY + tank.radius > config.height
        ) {
            collided = true;
            colliderType = "wall";
            break;
        }

        let hitObstacle = false;
        for (const obs of config.obstacles) {
            if (circleIntersectsAABB({ x: nextX, y: nextY }, tank.radius, obs)) {
                hitObstacle = true;
                break;
            }
        }
        if (hitObstacle) {
            collided = true;
            colliderType = "obstacle";
            break;
        }

        let hitTank = false;
        for (const other of allTanks) {
            if (other.id !== tank.id && other.isAlive) {
                if (
                    circleIntersectsCircle(
                        { x: nextX, y: nextY },
                        tank.radius,
                        { x: other.x, y: other.y },
                        other.radius,
                    )
                ) {
                    hitTank = true;
                    break;
                }
            }
        }
        if (hitTank) {
            collided = true;
            colliderType = "tank";
            break;
        }

        tank.x = nextX;
        tank.y = nextY;
        totalMovedX += stepX;
        totalMovedY += stepY;
    }

    tank.sensors.position.x = Math.round(tank.x);
    tank.sensors.position.y = Math.round(tank.y);

    return {
        moved: Math.hypot(totalMovedX, totalMovedY) > 0.01,
        collided,
        colliderType,
    };
}
