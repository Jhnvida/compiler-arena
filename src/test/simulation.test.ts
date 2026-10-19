import { describe, expect, it } from "vitest";
import { compileTankScript } from "../compiler/compiler.ts";
import { PRESET_HUNTER, PRESET_STRIKER } from "../compiler/presets.ts";
import { distance, SimulationEngine, type TankDefinition } from "../simulation/index.ts";

describe("Simulation Engine", () => {
    it("initializes battle with tanks and default safe spawn positions", () => {
        const comp1 = compileTankScript("robot Alpha { move(10); }");
        const comp2 = compileTankScript("robot Beta { move(10); }");

        const engine = new SimulationEngine();
        const tankDefs: TankDefinition[] = [
            { id: "t1", name: "Alpha", color: "#3b82f6", program: comp1.bytecode! },
            { id: "t2", name: "Beta", color: "#ef4444", program: comp2.bytecode! },
        ];

        engine.initBattle(tankDefs);
        expect(engine.tanks).toHaveLength(2);
        expect(engine.tanks[0].isAlive).toBe(true);
        expect(engine.tanks[1].isAlive).toBe(true);
        expect(engine.tanks[0].energy).toBe(100);
        expect(engine.tanks[1].energy).toBe(100);

        const d = distance(
            { x: engine.tanks[0].x, y: engine.tanks[0].y },
            { x: engine.tanks[1].x, y: engine.tanks[1].y },
        );
        expect(d).toBeGreaterThan(engine.config.tankRadius * 2);
    });

    it("updates tank movement and bounds within arena perimeter", () => {
        const comp = compileTankScript("robot Rusher { move(200); }");
        const engine = new SimulationEngine();

        engine.initBattle([
            {
                id: "rusher",
                name: "Rusher",
                color: "#3b82f6",
                program: comp.bytecode!,
                initialPosition: { x: 50, y: 100, angle: 180 },
            },
            {
                id: "dummy",
                name: "Dummy",
                color: "#ef4444",
                program: comp.bytecode!,
                initialPosition: { x: 500, y: 500, angle: 0 },
            },
        ]);

        engine.step();

        const rusher = engine.tanks[0];
        expect(rusher.x).toBeGreaterThanOrEqual(rusher.radius);
        expect(rusher.x).toBeLessThan(50);
    });

    it("detects obstacle collisions and stops tank from penetrating", () => {
        const comp = compileTankScript("robot ObstacleCrasher { move(50); }");
        const engine = new SimulationEngine({
            obstacles: [{ id: "obs-center-left", x: 260, y: 300, width: 70, height: 70, shape: "box" }],
        });

        engine.initBattle([
            {
                id: "crasher",
                name: "Crasher",
                color: "#3b82f6",
                program: comp.bytecode!,
                initialPosition: { x: 190, y: 300, angle: 0 },
            },
            {
                id: "dummy",
                name: "Dummy",
                color: "#ef4444",
                program: comp.bytecode!,
                initialPosition: { x: 700, y: 500, angle: 0 },
            },
        ]);

        engine.step();

        const crasher = engine.tanks[0];
        expect(crasher.x).toBeLessThanOrEqual(204);
    });

    it("prevents tanks from colliding into each other (tank-tank collision)", () => {
        const comp = compileTankScript("robot Rammer { move(30); }");
        const engine = new SimulationEngine();

        engine.initBattle([
            {
                id: "t1",
                name: "T1",
                color: "#3b82f6",
                program: comp.bytecode!,
                initialPosition: { x: 100, y: 100, angle: 0 },
            },
            {
                id: "t2",
                name: "T2",
                color: "#ef4444",
                program: comp.bytecode!,
                initialPosition: { x: 160, y: 100, angle: 180 },
            },
        ]);

        engine.step();

        const d = distance(
            { x: engine.tanks[0].x, y: engine.tanks[0].y },
            { x: engine.tanks[1].x, y: engine.tanks[1].y },
        );
        expect(d).toBeGreaterThanOrEqual(engine.config.tankRadius * 2 - 1);
    });

    it("updates sensors with real enemy distance and direction", () => {
        const comp = compileTankScript("robot Scanner { scan(); }");
        const engine = new SimulationEngine();

        engine.initBattle([
            {
                id: "t1",
                name: "Scanner",
                color: "#3b82f6",
                program: comp.bytecode!,
                initialPosition: { x: 100, y: 100, angle: 0 },
            },
            {
                id: "t2",
                name: "Target",
                color: "#ef4444",
                program: comp.bytecode!,
                initialPosition: { x: 100, y: 200, angle: 0 },
            },
        ]);

        const t1 = engine.tanks[0];
        expect(t1.sensors.enemy.visible).toBe(true);
        expect(t1.sensors.enemy.distance).toBe(100);
        expect(t1.sensors.enemy.direction).toBe(90);
    });

    it("blocks radar line-of-sight when an obstacle is directly in between", () => {
        const comp = compileTankScript("robot Scanner { scan(); }");
        const engine = new SimulationEngine({
            obstacles: [{ id: "obs-center-left", x: 260, y: 300, width: 70, height: 70, shape: "box" }],
        });

        engine.initBattle([
            {
                id: "t1",
                name: "Scanner",
                color: "#3b82f6",
                program: comp.bytecode!,
                initialPosition: { x: 150, y: 300, angle: 0 },
            },
            {
                id: "t2",
                name: "HiddenTarget",
                color: "#ef4444",
                program: comp.bytecode!,
                initialPosition: { x: 370, y: 300, angle: 0 },
            },
        ]);

        const t1 = engine.tanks[0];
        expect(t1.sensors.enemy.visible).toBe(false);
        expect(t1.sensors.enemy.distance).toBe(999);
    });

    it("spawns projectiles upon fire action and applies cooldown", () => {
        const shooterComp = compileTankScript("robot Shooter { fire(3); }");
        const dummyComp = compileTankScript("robot Dummy {}");
        const engine = new SimulationEngine();

        engine.initBattle([
            {
                id: "shooter",
                name: "Shooter",
                color: "#3b82f6",
                program: shooterComp.bytecode!,
                initialPosition: { x: 100, y: 100, angle: 0 },
            },
            {
                id: "dummy",
                name: "Dummy",
                color: "#ef4444",
                program: dummyComp.bytecode!,
                initialPosition: { x: 700, y: 500, angle: 0 },
            },
        ]);

        engine.step();

        expect(engine.projectiles).toHaveLength(1);
        const proj = engine.projectiles[0];
        expect(proj.ownerId).toBe("shooter");
        expect(proj.power).toBe(3);
        expect(proj.damage).toBe(40);
        expect(proj.alive).toBe(true);

        const shooter = engine.tanks[0];
        expect(shooter.stats.shotsFired).toBe(1);
        expect(shooter.cooldown).toBe(engine.config.fireCooldownTicks);
    });

    it("destroys projectiles when colliding with arena walls", () => {
        const shooterComp = compileTankScript("robot Shooter { fire(1); }");
        const dummyComp = compileTankScript("robot Dummy {}");
        const engine = new SimulationEngine();

        engine.initBattle([
            {
                id: "shooter",
                name: "Shooter",
                color: "#3b82f6",
                program: shooterComp.bytecode!,
                initialPosition: { x: engine.config.width - 40, y: 300, angle: 0 },
            },
            {
                id: "dummy",
                name: "Dummy",
                color: "#ef4444",
                program: dummyComp.bytecode!,
                initialPosition: { x: 100, y: 100, angle: 0 },
            },
        ]);

        engine.step();
        expect(engine.projectiles).toHaveLength(1);

        engine.step();

        expect(engine.projectiles).toHaveLength(0);
        const wallHitEvent = engine.events.find((e) => e.type === "projectile_hit_wall");
        expect(wallHitEvent).toBeDefined();
    });

    it("inflicts damage on projectile hit and updates tank stats", () => {
        const shooterComp = compileTankScript("robot Shooter { fire(2); }");
        const targetComp = compileTankScript("robot Target {}");
        const engine = new SimulationEngine();

        engine.initBattle([
            {
                id: "shooter",
                name: "Shooter",
                color: "#3b82f6",
                program: shooterComp.bytecode!,
                initialPosition: { x: 100, y: 200, angle: 0 },
            },
            {
                id: "target",
                name: "Target",
                color: "#ef4444",
                program: targetComp.bytecode!,
                initialPosition: { x: 140, y: 200, angle: 0 },
            },
        ]);

        engine.step();
        engine.step();

        const target = engine.tanks[1];
        const shooter = engine.tanks[0];

        expect(target.energy).toBe(75);
        expect(target.stats.damageReceived).toBe(25);
        expect(shooter.stats.shotsHit).toBe(1);
        expect(shooter.stats.damageDealt).toBe(25);
    });

    it("destroys tank at 0 HP and declares the remaining survivor as winner", () => {
        const shooterComp = compileTankScript("robot Shooter { fire(2); }");
        const targetComp = compileTankScript("robot Target {}");
        const engine = new SimulationEngine();

        engine.initBattle([
            {
                id: "shooter",
                name: "Shooter",
                color: "#3b82f6",
                program: shooterComp.bytecode!,
                initialPosition: { x: 100, y: 200, angle: 0 },
            },
            {
                id: "target",
                name: "Target",
                color: "#ef4444",
                program: targetComp.bytecode!,
                initialPosition: { x: 140, y: 200, angle: 0 },
            },
        ]);

        engine.tanks[1].energy = 15;

        engine.step();
        engine.step();

        expect(engine.tanks[1].isAlive).toBe(false);
        expect(engine.tanks[1].energy).toBe(0);
        expect(engine.tanks[0].stats.kills).toBe(1);
        expect(engine.status).toBe("finished");
        expect(engine.winner?.id).toBe("shooter");
    });

    it("ensures infinite loops in a tank do not block the simulation (gas limit fairness)", () => {
        const loopScript = `
      robot LoopBot {
        int i = 0;
        while (true) {
          i = i + 1;
        }
      }
    `;
        const normalScript = `
      robot NormalBot {
        move(10);
      }
    `;

        const loopComp = compileTankScript(loopScript);
        const normalComp = compileTankScript(normalScript);

        const engine = new SimulationEngine({ maxInstructionsPerTick: 50 });
        engine.initBattle([
            {
                id: "loop",
                name: "LoopBot",
                color: "#3b82f6",
                program: loopComp.bytecode!,
                initialPosition: { x: 100, y: 100, angle: 0 },
            },
            {
                id: "normal",
                name: "NormalBot",
                color: "#ef4444",
                program: normalComp.bytecode!,
                initialPosition: { x: 100, y: 400, angle: 0 },
            },
        ]);

        const startTime = Date.now();
        engine.step();
        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(100);
        expect(engine.tanks[0].lastExecutionResult?.yieldReason).toBe("quota_exhausted");
        expect(engine.tanks[0].lastExecutionResult?.instructionsExecuted).toBe(50);

        expect(engine.tanks[1].lastAction).toEqual({ type: "move", value: 10 });
        expect(engine.tanks[1].x).toBe(110);
    });

    it("runs a full match between preset robots Hunter and Striker deterministically", () => {
        const hunterComp = compileTankScript(PRESET_HUNTER);
        const strikerComp = compileTankScript(PRESET_STRIKER);

        expect(hunterComp.success).toBe(true);
        expect(strikerComp.success).toBe(true);

        const engine = new SimulationEngine({ maxTicks: 500 });
        engine.initBattle([
            {
                id: "hunter",
                name: "Hunter",
                color: "#06b6d4",
                program: hunterComp.bytecode!,
                initialPosition: { x: 150, y: 150, angle: 45 },
            },
            {
                id: "striker",
                name: "Striker",
                color: "#f97316",
                program: strikerComp.bytecode!,
                initialPosition: { x: 650, y: 450, angle: 225 },
            },
        ]);

        for (let i = 0; i < 150; i++) {
            if (engine.status === "finished") break;
            engine.step();
        }

        expect(engine.tick).toBeGreaterThanOrEqual(15);
        const t1 = engine.tanks[0];
        const t2 = engine.tanks[1];
        expect(t1.stats.shotsFired + t2.stats.shotsFired).toBeGreaterThan(0);
        expect(engine.events.length).toBeGreaterThan(0);
    });

    it("handles reverse movement (back action) and boundary collision", () => {
        const comp = compileTankScript("robot Backer { back(50); }");
        const engine = new SimulationEngine();

        engine.initBattle([
            {
                id: "backer",
                name: "Backer",
                color: "#3b82f6",
                program: comp.bytecode!,
                initialPosition: { x: 50, y: 100, angle: 0 },
            },
            {
                id: "dummy",
                name: "Dummy",
                color: "#ef4444",
                program: comp.bytecode!,
                initialPosition: { x: 500, y: 500, angle: 0 },
            },
        ]);

        engine.step();
        expect(engine.tanks[0].x).toBeGreaterThanOrEqual(22);
        expect(engine.tanks[0].x).toBeLessThan(50);
    });

    it("normalizes angle wrap-around on continuous rotations", () => {
        const comp = compileTankScript("robot Spinner { rotate(270); }");
        const engine = new SimulationEngine();

        engine.initBattle([
            {
                id: "spinner",
                name: "Spinner",
                color: "#3b82f6",
                program: comp.bytecode!,
                initialPosition: { x: 200, y: 200, angle: 100 },
            },
            {
                id: "dummy",
                name: "Dummy",
                color: "#ef4444",
                program: comp.bytecode!,
                initialPosition: { x: 500, y: 500, angle: 0 },
            },
        ]);

        engine.step();
        expect(engine.tanks[0].angle).toBe(10);
    });

    it("declares winner by remaining HP when maxTicks timeout is reached", () => {
        const comp = compileTankScript("robot IdleBot {}");
        const engine = new SimulationEngine({ maxTicks: 5 });

        engine.initBattle([
            {
                id: "t1",
                name: "T1",
                color: "#3b82f6",
                program: comp.bytecode!,
                initialPosition: { x: 100, y: 100, angle: 0 },
            },
            {
                id: "t2",
                name: "T2",
                color: "#ef4444",
                program: comp.bytecode!,
                initialPosition: { x: 200, y: 200, angle: 0 },
            },
        ]);

        engine.tanks[0].energy = 90;
        engine.tanks[1].energy = 60;

        for (let i = 0; i < 6; i++) {
            engine.step();
        }

        expect(engine.status).toBe("finished");
        expect(engine.winner?.id).toBe("t1");
    });

    it("correctly handles 3-tank elimination and finishes only when 1 survivor remains", () => {
        const compShooter = compileTankScript("robot Assassin { fire(3); }");
        const compIdle = compileTankScript("robot Prey {}");

        const engine = new SimulationEngine();
        engine.initBattle([
            {
                id: "t1",
                name: "Assassin",
                color: "#06b6d4",
                program: compShooter.bytecode!,
                initialPosition: { x: 100, y: 100, angle: 0 },
            },
            {
                id: "t2",
                name: "Prey1",
                color: "#f97316",
                program: compIdle.bytecode!,
                initialPosition: { x: 140, y: 100, angle: 0 },
            },
            {
                id: "t3",
                name: "Prey2",
                color: "#10b981",
                program: compIdle.bytecode!,
                initialPosition: { x: 700, y: 500, angle: 0 },
            },
        ]);

        engine.tanks[1].energy = 10;

        engine.step();
        engine.step();

        expect(engine.tanks[1].isAlive).toBe(false);
        expect(engine.status).toBe("running");
        expect(engine.winner).toBeNull();

        engine.tanks[2].isAlive = false;
        engine.tanks[2].energy = 0;
        engine.step();

        expect(engine.status).toBe("finished");
        expect(engine.winner?.id).toBe("t1");
    });

    it("handles simultaneous destruction resulting in a technical draw", () => {
        const comp = compileTankScript("robot DualFire { fire(3); }");
        const engine = new SimulationEngine();

        engine.initBattle([
            {
                id: "t1",
                name: "T1",
                color: "#3b82f6",
                program: comp.bytecode!,
                initialPosition: { x: 200, y: 200, angle: 0 },
            },
            {
                id: "t2",
                name: "T2",
                color: "#ef4444",
                program: comp.bytecode!,
                initialPosition: { x: 280, y: 200, angle: 180 },
            },
        ]);

        engine.tanks[0].energy = 20;
        engine.tanks[1].energy = 20;

        engine.step();
        engine.step();
        engine.step();
        engine.step();

        expect(engine.tanks[0].isAlive).toBe(false);
        expect(engine.tanks[1].isAlive).toBe(false);
        expect(engine.status).toBe("finished");
        expect(engine.isDraw).toBe(true);
        expect(engine.winner).toBeNull();
    });

    it("ensures destroyed tanks do not execute VM actions or fire projectiles", () => {
        const comp = compileTankScript("robot GhostShooter { fire(1); }");
        const engine = new SimulationEngine();

        engine.initBattle([
            {
                id: "deadBot",
                name: "DeadBot",
                color: "#3b82f6",
                program: comp.bytecode!,
                initialPosition: { x: 100, y: 100, angle: 0 },
            },
            {
                id: "livingBot",
                name: "LivingBot",
                color: "#ef4444",
                program: comp.bytecode!,
                initialPosition: { x: 500, y: 500, angle: 0 },
            },
        ]);

        engine.tanks[0].isAlive = false;
        engine.tanks[0].energy = 0;

        engine.step();

        expect(engine.projectiles).toHaveLength(1);
        expect(engine.projectiles[0].ownerId).toBe("livingBot");
        expect(engine.tanks[0].stats.shotsFired).toBe(0);
    });

    it("selects nearest alive enemy when multiple targets are present", () => {
        const compScan = compileTankScript("robot RadarTracker { scan(); }");
        const compDummy = compileTankScript("robot Target {}");
        const engine = new SimulationEngine();

        engine.initBattle([
            {
                id: "radar",
                name: "RadarTracker",
                color: "#06b6d4",
                program: compScan.bytecode!,
                initialPosition: { x: 100, y: 100, angle: 0 },
            },
            {
                id: "farTarget",
                name: "FarTarget",
                color: "#f97316",
                program: compDummy.bytecode!,
                initialPosition: { x: 400, y: 100, angle: 0 },
            },
            {
                id: "nearTarget",
                name: "NearTarget",
                color: "#10b981",
                program: compDummy.bytecode!,
                initialPosition: { x: 180, y: 100, angle: 0 },
            },
        ]);

        const radarTank = engine.tanks[0];
        expect(radarTank.sensors.enemy.visible).toBe(true);
        expect(radarTank.sensors.enemy.distance).toBe(80);

        engine.tanks[2].isAlive = false;
        engine.step();

        expect(radarTank.sensors.enemy.distance).toBe(300);
    });
});
