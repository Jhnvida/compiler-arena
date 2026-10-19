import type { BytecodeProgram } from "../compiler/bytecode.ts";
import { circleIntersectsCircle, DEFAULT_ARENA_CONFIG, degToRad, normalizeAngle } from "./arena.ts";
import { createProjectile, updateProjectile } from "./projectile.ts";
import { applyTankMovement, createSimulatedTank, findSafeSpawn, updateTankSensors } from "./tank.ts";
import type {
    ArenaConfig,
    BattleStatus,
    Projectile,
    SimEvent,
    SimEventType,
    SimulatedTank,
    SimulationSnapshot,
} from "./types.ts";

export interface TankDefinition {
    id: string;
    name: string;
    color: string;
    program: BytecodeProgram;
    initialPosition?: { x: number; y: number; angle?: number };
}

export type TickListener = (snapshot: SimulationSnapshot) => void;

let eventIdCounter = 0;

export class SimulationEngine {
    public tick = 0;
    public status: BattleStatus = "idle";
    public tanks: SimulatedTank[] = [];
    public projectiles: Projectile[] = [];
    public events: SimEvent[] = [];
    public winner: SimulatedTank | null = null;
    public isDraw = false;
    public config: ArenaConfig;

    private listeners = new Set<TickListener>();
    private readonly maxEventHistory = 150;

    constructor(config?: Partial<ArenaConfig>) {
        this.config = { ...DEFAULT_ARENA_CONFIG, ...config };
    }

    public subscribe(listener: TickListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private emitEvent(type: SimEventType, message: string, details?: Partial<SimEvent>): void {
        eventIdCounter++;
        const event: SimEvent = {
            id: `ev_${eventIdCounter}_${this.tick}`,
            tick: this.tick,
            type,
            message,
            ...details,
        };

        this.events.push(event);
        if (this.events.length > this.maxEventHistory) {
            this.events.shift();
        }
    }

    public initBattle(tankDefs: TankDefinition[]): void {
        this.tick = 0;
        this.status = "idle";
        this.projectiles = [];
        this.events = [];
        this.winner = null;
        this.isDraw = false;
        this.tanks = [];

        for (const def of tankDefs) {
            let x: number;
            let y: number;
            let angle: number;

            if (def.initialPosition) {
                x = def.initialPosition.x;
                y = def.initialPosition.y;
                angle = def.initialPosition.angle ?? 0;
            } else {
                const spawn = findSafeSpawn(
                    this.tanks,
                    this.config.obstacles,
                    this.config.width,
                    this.config.height,
                    this.config.tankRadius,
                );
                x = spawn.x;
                y = spawn.y;
                angle = spawn.angle;
            }

            const tank = createSimulatedTank(def.id, def.name, def.color, def.program, x, y, angle, this.config);

            this.tanks.push(tank);
            this.emitEvent("tank_spawn", `${tank.name} entrou na arena na posição (${x}, ${y})`, {
                tankId: tank.id,
                x,
                y,
            });
        }

        for (const tank of this.tanks) {
            updateTankSensors(tank, this.tanks, this.config.obstacles);
        }

        this.notify();
    }

    public start(): void {
        if (this.status !== "finished") {
            this.status = "running";
        }
    }

    public pause(): void {
        if (this.status === "running") {
            this.status = "paused";
        }
    }

    public resume(): void {
        if (this.status === "paused") {
            this.status = "running";
        }
    }

    public step(): SimulationSnapshot {
        if (this.status === "idle") {
            this.status = "running";
        }

        if (this.status === "finished") {
            return this.getSnapshot();
        }

        this.tick++;

        const remainingProjectiles: Projectile[] = [];

        for (const proj of this.projectiles) {
            if (!proj.alive) continue;

            const stepRes = updateProjectile(proj, this.config);

            if (stepRes.hitType === "wall") {
                this.emitEvent("projectile_hit_wall", `Projétil atingiu a barreira da arena`, {
                    projectileId: proj.id,
                    x: proj.x,
                    y: proj.y,
                });
                continue;
            }

            if (stepRes.hitType === "obstacle") {
                this.emitEvent("projectile_hit_obstacle", `Projétil colidiu contra obstáculo`, {
                    projectileId: proj.id,
                    x: proj.x,
                    y: proj.y,
                });
                continue;
            }

            let hitTank = false;
            for (const tank of this.tanks) {
                if (!tank.isAlive || tank.id === proj.ownerId) continue;

                if (
                    circleIntersectsCircle({ x: proj.x, y: proj.y }, proj.radius, { x: tank.x, y: tank.y }, tank.radius)
                ) {
                    hitTank = true;
                    proj.alive = false;

                    tank.energy = Math.max(0, tank.energy - proj.damage);
                    tank.stats.damageReceived += proj.damage;

                    const owner = this.tanks.find((t) => t.id === proj.ownerId);
                    if (owner) {
                        owner.stats.shotsHit++;
                        owner.stats.damageDealt += proj.damage;
                    }

                    this.emitEvent(
                        "projectile_hit_tank",
                        `${owner?.name ?? "Projétil"} acertou ${tank.name} causando ${proj.damage} de dano (${tank.energy} HP restantes)`,
                        {
                            tankId: proj.ownerId,
                            targetTankId: tank.id,
                            projectileId: proj.id,
                            value: proj.damage,
                            x: tank.x,
                            y: tank.y,
                        },
                    );

                    if (tank.energy <= 0) {
                        tank.isAlive = false;
                        if (owner) {
                            owner.stats.kills++;
                        }
                        this.emitEvent("tank_destroyed", `O tanque ${tank.name} foi destruído`, {
                            tankId: tank.id,
                            x: tank.x,
                            y: tank.y,
                        });
                    }
                    break;
                }
            }

            if (!hitTank && proj.alive) {
                remainingProjectiles.push(proj);
            }
        }

        this.projectiles = remainingProjectiles;

        for (const tank of this.tanks) {
            if (tank.cooldown > 0) {
                tank.cooldown--;
            }
        }

        const tankCount = this.tanks.length;
        const startOffset = tankCount > 0 ? (this.tick - 1) % tankCount : 0;

        for (let i = 0; i < tankCount; i++) {
            const tankIndex = (startOffset + i) % tankCount;
            const tank = this.tanks[tankIndex];
            if (!tank.isAlive) continue;

            updateTankSensors(tank, this.tanks, this.config.obstacles);

            const execResult = tank.vm.runTick(tank.sensors, this.config.maxInstructionsPerTick);
            tank.lastExecutionResult = execResult;

            if (execResult.actions.length > 0) {
                const action = execResult.actions[0];
                tank.lastAction = action;

                switch (action.type) {
                    case "move": {
                        const dist = action.value ?? 10;
                        const moveRes = applyTankMovement(tank, dist, this.tanks, this.config);
                        if (moveRes.collided) {
                            this.emitEvent(
                                "tank_collide_obstacle",
                                `${tank.name} colidiu contra ${moveRes.colliderType === "wall" ? "a barreira" : moveRes.colliderType === "tank" ? "outro tanque" : "um obstáculo"}`,
                                { tankId: tank.id, x: tank.x, y: tank.y },
                            );
                        }
                        break;
                    }

                    case "back": {
                        const dist = -(action.value ?? 10);
                        const moveRes = applyTankMovement(tank, dist, this.tanks, this.config);
                        if (moveRes.collided) {
                            this.emitEvent("tank_collide_obstacle", `${tank.name} colidiu em marcha ré`, {
                                tankId: tank.id,
                                x: tank.x,
                                y: tank.y,
                            });
                        }
                        break;
                    }

                    case "rotate": {
                        const deg = action.value ?? 15;
                        tank.angle = normalizeAngle(tank.angle + deg);
                        tank.turretAngle = tank.angle;
                        break;
                    }

                    case "scan": {
                        this.emitEvent("tank_scan", `${tank.name} realizou varredura de radar`, {
                            tankId: tank.id,
                            x: tank.x,
                            y: tank.y,
                        });
                        break;
                    }

                    case "fire": {
                        if (tank.cooldown <= 0) {
                            const power = action.value ?? 1;
                            const barrelOffset = tank.radius + 6;
                            const rad = degToRad(tank.angle);
                            const spawnX = tank.x + Math.cos(rad) * barrelOffset;
                            const spawnY = tank.y + Math.sin(rad) * barrelOffset;

                            const proj = createProjectile(
                                tank.id,
                                spawnX,
                                spawnY,
                                tank.angle,
                                power,
                                this.config.projectileSpeedBase,
                            );

                            this.projectiles.push(proj);
                            tank.stats.shotsFired++;
                            tank.cooldown = this.config.fireCooldownTicks;

                            this.emitEvent("tank_fire", `${tank.name} disparou com potência ${proj.power}`, {
                                tankId: tank.id,
                                projectileId: proj.id,
                                value: proj.power,
                                x: spawnX,
                                y: spawnY,
                            });
                        }
                        break;
                    }
                }
            }
        }

        this.checkMatchEnd();

        this.notify();
        return this.getSnapshot();
    }

    private checkMatchEnd(): void {
        const aliveTanks = this.tanks.filter((t) => t.isAlive);

        if (aliveTanks.length === 1 && this.tanks.length >= 2) {
            this.winner = aliveTanks[0];
            this.isDraw = false;
            this.status = "finished";
            this.emitEvent("battle_end", `Vitória: o tanque ${this.winner.name} venceu a batalha`, {
                tankId: this.winner.id,
            });
            return;
        }

        if (aliveTanks.length === 0 && this.tanks.length > 0) {
            this.winner = null;
            this.isDraw = true;
            this.status = "finished";
            this.emitEvent("battle_end", `Empate: todos os tanques foram destruídos`);
            return;
        }

        if (this.tick >= this.config.maxTicks) {
            this.status = "finished";
            aliveTanks.sort((a, b) => b.energy - a.energy);
            if (aliveTanks.length > 1 && aliveTanks[0].energy === aliveTanks[1].energy) {
                this.winner = null;
                this.isDraw = true;
                this.emitEvent("battle_end", `Tempo esgotado: batalha empatada em pontos de energia`);
            } else if (aliveTanks.length > 0) {
                this.winner = aliveTanks[0];
                this.isDraw = false;
                this.emitEvent(
                    "battle_end",
                    `Tempo esgotado: ${this.winner.name} venceu com maior energia restante (${this.winner.energy} HP)`,
                    { tankId: this.winner.id },
                );
            }
        }
    }

    public getSnapshot(): SimulationSnapshot {
        return {
            tick: this.tick,
            status: this.status,
            tanks: this.tanks,
            projectiles: this.projectiles,
            recentEvents: [...this.events],
            winner: this.winner,
            isDraw: this.isDraw,
            config: this.config,
        };
    }

    private notify(): void {
        const snapshot = this.getSnapshot();
        for (const listener of this.listeners) {
            listener(snapshot);
        }
    }
}
