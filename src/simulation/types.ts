import type { TankAction, TankSensors, VMExecutionResult } from "../vm/types.ts";
import type { VirtualMachine } from "../vm/virtualMachine.ts";

export interface Point2D {
    x: number;
    y: number;
}

export interface Obstacle {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    shape?: "box" | "cylinder";
}

export interface ArenaConfig {
    width: number;
    height: number;
    obstacles: Obstacle[];
    maxTicks: number;
    defaultTankEnergy: number;
    tankRadius: number;
    projectileSpeedBase: number;
    fireCooldownTicks: number;
    maxInstructionsPerTick: number;
}

export interface TankStats {
    shotsFired: number;
    shotsHit: number;
    damageDealt: number;
    damageReceived: number;
    kills: number;
}

export type DamageSourceType = "tank" | "arena" | "unknown";

export interface LastDamageSource {
    type: DamageSourceType;
    attackerId?: string;
    damage: number;
    tick: number;
}

export interface SimulatedTank {
    id: string;
    name: string;
    color: string;
    x: number;
    y: number;
    angle: number;
    turretAngle: number;
    energy: number;
    maxEnergy: number;
    radius: number;
    isAlive: boolean;
    vm: VirtualMachine;
    lastAction: TankAction | null;
    lastExecutionResult: VMExecutionResult | null;
    lastDamageSource?: LastDamageSource | null;
    stats: TankStats;
    cooldown: number;
    sensors: TankSensors;
}

export interface Projectile {
    id: string;
    ownerId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    power: number;
    damage: number;
    radius: number;
    alive: boolean;
}

export type SimEventType =
    | "tank_spawn"
    | "tank_move"
    | "tank_rotate"
    | "tank_scan"
    | "tank_fire"
    | "projectile_hit_tank"
    | "projectile_hit_wall"
    | "projectile_hit_obstacle"
    | "tank_collide_tank"
    | "tank_collide_obstacle"
    | "tank_destroyed"
    | "battle_end";

export interface SimEvent {
    id: string;
    tick: number;
    type: SimEventType;
    tankId?: string;
    targetTankId?: string;
    attackerId?: string;
    victimId?: string;
    sourceType?: DamageSourceType;
    projectileId?: string;
    x?: number;
    y?: number;
    value?: number;
    message: string;
}

export type BattleStatus = "idle" | "running" | "paused" | "finished";

export interface SimulationSnapshot {
    tick: number;
    status: BattleStatus;
    tanks: SimulatedTank[];
    projectiles: Projectile[];
    recentEvents: SimEvent[];
    winner: SimulatedTank | null;
    isDraw: boolean;
    config: ArenaConfig;
}
