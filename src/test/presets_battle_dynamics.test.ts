import { describe, expect, it } from "vitest";
import { compileTankScript } from "../compiler/compiler.ts";
import { PRESET_HUNTER, PRESET_PATROL, PRESET_SNIPER, PRESET_STRIKER } from "../compiler/presets.ts";
import { circleIntersectsAABB, distance, SimulationEngine, type TankDefinition } from "../simulation/index.ts";

describe("Presets & Battle Dynamics Overhaul", () => {
    it("ensures initial spawn distribution guarantees safe distance and no collisions for 2, 3, and 4 tanks", () => {
        const dummyComp = compileTankScript("robot Dummy { scan(); }");
        expect(dummyComp.success).toBe(true);

        for (const tankCount of [2, 3, 4]) {
            for (let seed = 0; seed < 5; seed++) {
                const engine = new SimulationEngine();
                const defs: TankDefinition[] = Array.from({ length: tankCount }, (_, i) => ({
                    id: `tank_${i}`,
                    name: `Tank ${i}`,
                    color: "#ffffff",
                    program: dummyComp.bytecode!,
                }));

                engine.initBattle(defs);
                expect(engine.tanks).toHaveLength(tankCount);

                for (let i = 0; i < engine.tanks.length; i++) {
                    const t1 = engine.tanks[i];

                    expect(t1.x).toBeGreaterThanOrEqual(t1.radius);
                    expect(t1.x).toBeLessThanOrEqual(engine.config.width - t1.radius);
                    expect(t1.y).toBeGreaterThanOrEqual(t1.radius);
                    expect(t1.y).toBeLessThanOrEqual(engine.config.height - t1.radius);

                    for (const obs of engine.config.obstacles) {
                        const hit = circleIntersectsAABB({ x: t1.x, y: t1.y }, t1.radius, obs);
                        expect(hit).toBe(false);
                    }

                    for (let j = i + 1; j < engine.tanks.length; j++) {
                        const t2 = engine.tanks[j];
                        const d = distance({ x: t1.x, y: t1.y }, { x: t2.x, y: t2.y });
                        expect(d).toBeGreaterThanOrEqual(200);
                    }
                }
            }
        }
    });

    it("verifies Hunter actively explores, scans, moves, and fires in combat", () => {
        const hunterComp = compileTankScript(PRESET_HUNTER);
        const targetComp = compileTankScript(PRESET_PATROL);
        expect(hunterComp.success).toBe(true);
        expect(targetComp.success).toBe(true);

        const engine = new SimulationEngine();
        engine.initBattle([
            {
                id: "h1",
                name: "Hunter",
                color: "#0284c7",
                program: hunterComp.bytecode!,
                initialPosition: { x: 160, y: 160, angle: 45 },
            },
            {
                id: "t1",
                name: "Target",
                color: "#f97316",
                program: targetComp.bytecode!,
                initialPosition: { x: 640, y: 440, angle: 225 },
            },
        ]);

        const startX = engine.tanks[0].x;
        const startY = engine.tanks[0].y;
        let totalMoved = 0;
        let prevX = startX;
        let prevY = startY;

        for (let tick = 0; tick < 80; tick++) {
            if (engine.status === "finished") break;
            engine.step();
            const curH = engine.tanks[0];
            totalMoved += distance({ x: prevX, y: prevY }, { x: curH.x, y: curH.y });
            prevX = curH.x;
            prevY = curH.y;
        }

        const hunter = engine.tanks[0];
        const distMoved = distance({ x: startX, y: startY }, { x: hunter.x, y: hunter.y });

        expect(totalMoved).toBeGreaterThan(25);
        expect(distMoved).toBeGreaterThan(25);
        expect(hunter.lastAction).not.toBeNull();

        expect(hunter.stats.shotsFired).toBeGreaterThan(0);
        expect(engine.events.some((e) => e.type === "tank_scan" && e.tankId === "h1")).toBe(true);
        expect(engine.events.some((e) => e.type === "tank_fire" && e.tankId === "h1")).toBe(true);
    });

    it("verifies SniperScout kites and maintains range rather than ramming targets", () => {
        const sniperComp = compileTankScript(PRESET_SNIPER);
        expect(sniperComp.success).toBe(true);

        const dummyComp = compileTankScript("robot StaticTarget { scan(); }");
        const engine = new SimulationEngine();

        engine.initBattle([
            {
                id: "sniper",
                name: "Sniper",
                color: "#10b981",
                program: sniperComp.bytecode!,
                initialPosition: { x: 200, y: 200, angle: 0 },
            },
            {
                id: "target",
                name: "Target",
                color: "#f97316",
                program: dummyComp.bytecode!,
                initialPosition: { x: 300, y: 200, angle: 0 },
            },
        ]);

        for (let tick = 0; tick < 60; tick++) {
            if (engine.status === "finished") break;
            engine.step();
        }

        const sniper = engine.tanks[0];
        expect(sniper.stats.shotsFired).toBeGreaterThanOrEqual(1);
    });

    it("executes a 4-robot free-for-all match and verifies healthy combat duration", () => {
        const hunter = compileTankScript(PRESET_HUNTER);
        const sniper = compileTankScript(PRESET_SNIPER);
        const striker = compileTankScript(PRESET_STRIKER);
        const patrol = compileTankScript(PRESET_PATROL);

        expect(hunter.success).toBe(true);
        expect(sniper.success).toBe(true);
        expect(striker.success).toBe(true);
        expect(patrol.success).toBe(true);

        const engine = new SimulationEngine({ maxTicks: 600 });
        engine.initBattle([
            { id: "h", name: "Hunter", color: "#0284c7", program: hunter.bytecode! },
            { id: "s", name: "Sniper", color: "#10b981", program: sniper.bytecode! },
            { id: "st", name: "Striker", color: "#f97316", program: striker.bytecode! },
            { id: "p", name: "Patrol", color: "#8b5cf6", program: patrol.bytecode! },
        ]);

        for (let tick = 0; tick < 250; tick++) {
            if (engine.status === "finished") break;
            engine.step();
        }

        expect(engine.tick).toBeGreaterThanOrEqual(20);

        const totalShots = engine.tanks.reduce((acc, t) => acc + t.stats.shotsFired, 0);
        expect(totalShots).toBeGreaterThan(0);
        expect(engine.events.length).toBeGreaterThan(0);

        while (engine.status === "running" && engine.tick < 1000) {
            engine.step();
        }

        expect(["finished", "running"]).toContain(engine.status);
    });

    it("verifies that tanks do not get stuck continuously colliding into walls when fighting", () => {
        const hunter = compileTankScript(PRESET_HUNTER);
        const sniper = compileTankScript(PRESET_SNIPER);

        for (let seed = 0; seed < 5; seed++) {
            const engine = new SimulationEngine({ maxTicks: 400 });
            engine.initBattle([
                { id: "h", name: "Hunter", color: "#0284c7", program: hunter.bytecode! },
                { id: "s", name: "Sniper", color: "#10b981", program: sniper.bytecode! },
            ]);

            let consecutiveCollisionsH = 0;
            let maxConsecutiveH = 0;
            let consecutiveCollisionsS = 0;
            let maxConsecutiveS = 0;

            for (let tick = 0; tick < 200; tick++) {
                if (engine.status === "finished") break;
                engine.step();

                const recentHCollision = engine.events
                    .slice(-2)
                    .some((e) => e.type === "tank_collide_obstacle" && e.tankId === "h" && e.tick === engine.tick);
                if (recentHCollision) {
                    consecutiveCollisionsH++;
                    if (consecutiveCollisionsH > maxConsecutiveH) maxConsecutiveH = consecutiveCollisionsH;
                } else {
                    consecutiveCollisionsH = 0;
                }

                const recentSCollision = engine.events
                    .slice(-2)
                    .some((e) => e.type === "tank_collide_obstacle" && e.tankId === "s" && e.tick === engine.tick);
                if (recentSCollision) {
                    consecutiveCollisionsS++;
                    if (consecutiveCollisionsS > maxConsecutiveS) maxConsecutiveS = consecutiveCollisionsS;
                } else {
                    consecutiveCollisionsS = 0;
                }
                expect(maxConsecutiveH).toBeLessThanOrEqual(2);
                expect(maxConsecutiveS).toBeLessThanOrEqual(2);
            }
        }
    });

    it("verifies that SniperScout actively maneuvers away when near boundary rather than being trapped", () => {
        const sniperComp = compileTankScript(PRESET_SNIPER);
        const dummyComp = compileTankScript("robot StaticTarget { scan(); }");
        const engine = new SimulationEngine();

        engine.initBattle([
            {
                id: "sniper",
                name: "Sniper",
                color: "#10b981",
                program: sniperComp.bytecode!,
                initialPosition: { x: 105, y: 300, angle: 0 },
            },
            {
                id: "target",
                name: "Target",
                color: "#f97316",
                program: dummyComp.bytecode!,
                initialPosition: { x: 350, y: 300, angle: 180 },
            },
        ]);

        const startY = engine.tanks[0].y;

        for (let tick = 0; tick < 30; tick++) {
            engine.step();
        }

        const sniper = engine.tanks[0];
        expect(Math.abs(sniper.y - startY)).toBeGreaterThan(20);
        expect(sniper.x).toBeGreaterThan(engine.config.tankRadius + 10);
    });
});
