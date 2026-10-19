import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { compileTankScript } from "../compiler/compiler.ts";
import { PRESET_HUNTER, PRESET_SNIPER, PRESET_STRIKER } from "../compiler/presets.ts";
import { TankMeshController } from "../graphics/tankMesh.ts";
import { DEFAULT_ARENA_CONFIG } from "../simulation/arena.ts";
import { SimulationEngine, type TankDefinition } from "../simulation/engine.ts";
import { getSystemTankColor, getSystemTankName, SYSTEM_TANK_COLORS } from "../simulation/index.ts";

describe("Rematch, HUD, and Open Arena Overhaul", () => {
    it("ensures default arena configuration has zero internal obstacles and square 900x900 proportions", () => {
        expect(DEFAULT_ARENA_CONFIG.obstacles).toHaveLength(0);
        expect(DEFAULT_ARENA_CONFIG.width).toBe(900);
        expect(DEFAULT_ARENA_CONFIG.height).toBe(900);
    });

    it("verifies 3D TankMeshController has no floating health bars or text badges", () => {
        const hunterComp = compileTankScript(PRESET_HUNTER);
        const engine = new SimulationEngine();
        engine.initBattle([
            { id: "h1", name: "Hunter", color: "#0284c7", program: hunterComp.bytecode! },
            { id: "s1", name: "Striker", color: "#f97316", program: hunterComp.bytecode! },
        ]);

        const tank = engine.tanks[0];
        const meshCtrl = new TankMeshController(tank, 900, 900);

        expect((meshCtrl as unknown as { healthBarGroup?: unknown }).healthBarGroup).toBeUndefined();
        expect((meshCtrl as unknown as { healthBarFill?: unknown }).healthBarFill).toBeUndefined();

        meshCtrl.group.traverse((child) => {
            expect(child.name).not.toContain("health");
        });

        meshCtrl.dispose();
    });

    it("verifies immediate rematch cleanly resets state without pause interaction", () => {
        const hunterComp = compileTankScript(PRESET_HUNTER);
        const strikerComp = compileTankScript(PRESET_STRIKER);

        const engine = new SimulationEngine();
        const defs = [
            { id: "h1", name: "Hunter", color: "#0284c7", program: hunterComp.bytecode! },
            {
                id: "s1",
                name: "Striker",
                color: "#f97316",
                program: strikerComp.bytecode!,
                initialPosition: { x: 200, y: 300, angle: 0 },
            },
        ];

        engine.initBattle(defs);
        engine.start();

        for (let i = 0; i < 40; i++) {
            if (engine.status === "finished") break;
            engine.step();
        }

        expect(engine.tick).toBeGreaterThan(10);

        const rematchEngine = new SimulationEngine();
        rematchEngine.initBattle(defs);
        rematchEngine.start();

        expect(rematchEngine.tick).toBe(0);
        expect(rematchEngine.status).toBe("running");
        expect(rematchEngine.projectiles).toHaveLength(0);
        expect(rematchEngine.winner).toBeNull();
        expect(rematchEngine.isDraw).toBe(false);

        const snap = rematchEngine.getSnapshot();
        expect(snap.tick).toBe(0);
        expect(snap.status).toBe("running");
        expect(snap.tanks[0].energy).toBe(100);
        expect(snap.tanks[1].energy).toBe(100);
        expect(snap.tanks[0].isAlive).toBe(true);
        expect(snap.tanks[1].isAlive).toBe(true);
    });

    it("verifies getSnapshot returns immutable references for React reactivity", () => {
        const hunterComp = compileTankScript(PRESET_HUNTER);
        const engine = new SimulationEngine();
        engine.initBattle([
            { id: "h1", name: "Hunter", color: "#0284c7", program: hunterComp.bytecode! },
            { id: "s1", name: "Striker", color: "#f97316", program: hunterComp.bytecode! },
        ]);

        const snap1 = engine.getSnapshot();
        engine.step();
        const snap2 = engine.getSnapshot();

        expect(snap1).not.toBe(snap2);
        expect(snap1.tanks).not.toBe(snap2.tanks);
        expect(snap1.tanks[0]).not.toBe(snap2.tanks[0]);
    });

    it("verifies pause, resume, and step-forward tick progression", () => {
        const hunterComp = compileTankScript(PRESET_HUNTER);
        const engine = new SimulationEngine();
        engine.initBattle([
            { id: "h1", name: "Hunter", color: "#0284c7", program: hunterComp.bytecode! },
            { id: "s1", name: "Striker", color: "#f97316", program: hunterComp.bytecode! },
        ]);

        engine.start();
        expect(engine.status).toBe("running");

        engine.step();
        expect(engine.tick).toBe(1);

        engine.pause();
        expect(engine.status).toBe("paused");

        engine.step();
        expect(engine.tick).toBe(2);

        engine.resume();
        expect(engine.status).toBe("running");

        engine.step();
        expect(engine.tick).toBe(3);
    });

    it("verifies multiple tanks navigate open arena with wall avoidance and no continuous collision", () => {
        const hunterComp = compileTankScript(PRESET_HUNTER);
        const sniperComp = compileTankScript(PRESET_SNIPER);
        const strikerComp = compileTankScript(PRESET_STRIKER);

        const engine = new SimulationEngine();
        engine.initBattle([
            { id: "h1", name: "Hunter", color: "#0284c7", program: hunterComp.bytecode! },
            { id: "s1", name: "Sniper", color: "#10b981", program: sniperComp.bytecode! },
            { id: "st1", name: "Striker", color: "#f97316", program: strikerComp.bytecode! },
        ]);

        let consecutiveWallCollisions = 0;
        let maxConsecutiveWallCollisions = 0;

        for (let tick = 0; tick < 120; tick++) {
            if (engine.status === "finished") break;
            const snap = engine.step();

            const hadWallCollision = snap.recentEvents.some(
                (e) => e.tick === snap.tick && e.type === "tank_collide_obstacle" && e.message.includes("barreira"),
            );

            if (hadWallCollision) {
                consecutiveWallCollisions++;
                if (consecutiveWallCollisions > maxConsecutiveWallCollisions) {
                    maxConsecutiveWallCollisions = consecutiveWallCollisions;
                }
            } else {
                consecutiveWallCollisions = 0;
            }
        }

        expect(maxConsecutiveWallCollisions).toBeLessThanOrEqual(2);
    });

    it("verifies destroyed tank mesh is fully restored to pristine state upon rematch", () => {
        const hunterComp = compileTankScript(PRESET_HUNTER);
        const engine = new SimulationEngine();
        engine.initBattle([
            { id: "h1", name: "Hunter", color: "#0284c7", program: hunterComp.bytecode! },
            { id: "s1", name: "Striker", color: "#f97316", program: hunterComp.bytecode! },
        ]);

        const tank = engine.tanks[0];
        const dummyCamera = { position: { x: 0, y: 0, z: 0 } } as unknown as THREE.Camera;
        const meshCtrl = new TankMeshController(tank, 900, 900);

        expect(meshCtrl.group.rotation.z).toBe(0);
        expect(meshCtrl.group.rotation.x).toBe(0);

        tank.isAlive = false;
        meshCtrl.update(tank, dummyCamera, 900, 900, 0.016, false);

        expect(meshCtrl.group.rotation.z).toBeCloseTo(0.14);
        expect(meshCtrl.group.rotation.x).toBeCloseTo(-0.08);

        tank.isAlive = true;
        tank.energy = 100;
        tank.x = 350;
        tank.y = 250;

        meshCtrl.reset(tank, 900, 900);

        expect(meshCtrl.group.rotation.z).toBe(0);
        expect(meshCtrl.group.rotation.x).toBe(0);

        tank.isAlive = false;
        meshCtrl.update(tank, dummyCamera, 900, 900, 0.016, false);
        expect(meshCtrl.group.rotation.z).toBeCloseTo(0.14);

        tank.isAlive = true;
        meshCtrl.update(tank, dummyCamera, 900, 900, 0.016, false);
        expect(meshCtrl.group.rotation.z).toBe(0);
        expect(meshCtrl.group.rotation.x).toBe(0);

        meshCtrl.dispose();
    });

    it("verifies spawn positions are randomized across matches and revanches without static patterns", () => {
        const hunterComp = compileTankScript(PRESET_HUNTER);
        const strikerComp = compileTankScript(PRESET_STRIKER);

        const defs: TankDefinition[] = [
            { id: "h1", name: "Hunter", color: "#0284c7", program: hunterComp.bytecode! },
            { id: "s1", name: "Striker", color: "#f97316", program: strikerComp.bytecode! },
        ];

        const recordedPositions: { h1: { x: number; y: number }; s1: { x: number; y: number } }[] = [];

        for (let match = 0; match < 10; match++) {
            const engine = new SimulationEngine();
            engine.initBattle(defs);

            const t1 = engine.tanks.find((t) => t.id === "h1")!;
            const t2 = engine.tanks.find((t) => t.id === "s1")!;

            const margin = engine.config.tankRadius + 40;
            expect(t1.x).toBeGreaterThanOrEqual(margin);
            expect(t1.x).toBeLessThanOrEqual(engine.config.width - margin);
            expect(t1.y).toBeGreaterThanOrEqual(margin);
            expect(t1.y).toBeLessThanOrEqual(engine.config.height - margin);

            expect(t2.x).toBeGreaterThanOrEqual(margin);
            expect(t2.x).toBeLessThanOrEqual(engine.config.width - margin);
            expect(t2.y).toBeGreaterThanOrEqual(margin);
            expect(t2.y).toBeLessThanOrEqual(engine.config.height - margin);

            const dist = Math.hypot(t1.x - t2.x, t1.y - t2.y);
            expect(dist).toBeGreaterThanOrEqual(200);

            recordedPositions.push({
                h1: { x: t1.x, y: t1.y },
                s1: { x: t2.x, y: t2.y },
            });
        }

        const uniqueH1Positions = new Set(recordedPositions.map((p) => `${p.h1.x},${p.h1.y}`));
        const uniqueS1Positions = new Set(recordedPositions.map((p) => `${p.s1.x},${p.s1.y}`));

        expect(uniqueH1Positions.size).toBeGreaterThanOrEqual(8);
        expect(uniqueS1Positions.size).toBeGreaterThanOrEqual(8);

        const h1Xs = recordedPositions.map((p) => p.h1.x);
        const h1Ys = recordedPositions.map((p) => p.h1.y);
        const minX = Math.min(...h1Xs);
        const maxX = Math.max(...h1Xs);
        const minY = Math.min(...h1Ys);
        const maxY = Math.max(...h1Ys);

        expect(maxX - minX).toBeGreaterThan(180);
        expect(maxY - minY).toBeGreaterThan(120);
    });

    it("verifies standardized sequential robot naming (Robo 1, Robo 2, ...) and fixed system colors", () => {
        expect(getSystemTankName(0)).toBe("Robo 1");
        expect(getSystemTankName(1)).toBe("Robo 2");
        expect(getSystemTankName(2)).toBe("Robo 3");
        expect(getSystemTankName(3)).toBe("Robo 4");

        expect(getSystemTankColor(0)).toBe(SYSTEM_TANK_COLORS[0]);
        expect(getSystemTankColor(1)).toBe(SYSTEM_TANK_COLORS[1]);
        expect(getSystemTankColor(2)).toBe(SYSTEM_TANK_COLORS[2]);
        expect(getSystemTankColor(3)).toBe(SYSTEM_TANK_COLORS[3]);

        const comp = compileTankScript("robot Test { scan(); }");
        const engine = new SimulationEngine();
        engine.initBattle([
            { id: "t1", name: getSystemTankName(0), color: getSystemTankColor(0), program: comp.bytecode! },
            { id: "t2", name: getSystemTankName(1), color: getSystemTankColor(1), program: comp.bytecode! },
            { id: "t3", name: getSystemTankName(2), color: getSystemTankColor(2), program: comp.bytecode! },
        ]);

        const snap = engine.getSnapshot();
        expect(snap.tanks[0].name).toBe("Robo 1");
        expect(snap.tanks[1].name).toBe("Robo 2");
        expect(snap.tanks[2].name).toBe("Robo 3");

        expect(snap.tanks[0].color).toBe(SYSTEM_TANK_COLORS[0]);
        expect(snap.tanks[1].color).toBe(SYSTEM_TANK_COLORS[1]);
        expect(snap.tanks[2].color).toBe(SYSTEM_TANK_COLORS[2]);

        const spawnMessages = snap.recentEvents.filter((e) => e.type === "tank_spawn").map((e) => e.message);
        expect(spawnMessages.some((m) => m.includes("Robo 1"))).toBe(true);
        expect(spawnMessages.some((m) => m.includes("Robo 2"))).toBe(true);
        expect(spawnMessages.some((m) => m.includes("Robo 3"))).toBe(true);
    });

    it("verifies 10 concurrent robots configuration, distinct system colors, collision-free spawn and execution", () => {
        expect(SYSTEM_TANK_COLORS.length).toBeGreaterThanOrEqual(10);

        for (let i = 0; i < 10; i++) {
            expect(getSystemTankName(i)).toBe(`Robo ${i + 1}`);
            expect(getSystemTankColor(i)).toBe(SYSTEM_TANK_COLORS[i]);
        }

        const uniqueColors = new Set(SYSTEM_TANK_COLORS.slice(0, 10));
        expect(uniqueColors.size).toBe(10);

        const comp = compileTankScript(PRESET_HUNTER);
        expect(comp.success).toBe(true);
        expect(comp.bytecode).toBeDefined();

        const defs: TankDefinition[] = [];
        for (let i = 0; i < 10; i++) {
            defs.push({
                id: `tank-${i + 1}`,
                name: getSystemTankName(i),
                color: getSystemTankColor(i),
                program: comp.bytecode!,
            });
        }

        const engine = new SimulationEngine();
        engine.initBattle(defs);
        engine.start();

        const snap = engine.getSnapshot();
        expect(snap.tanks).toHaveLength(10);

        const margin = engine.config.tankRadius + 10;
        for (const tank of snap.tanks) {
            expect(tank.x).toBeGreaterThanOrEqual(margin);
            expect(tank.x).toBeLessThanOrEqual(engine.config.width - margin);
            expect(tank.y).toBeGreaterThanOrEqual(margin);
            expect(tank.y).toBeLessThanOrEqual(engine.config.height - margin);
        }

        const minDistanceBetweenTanks = engine.config.tankRadius * 2 + 10;
        for (let i = 0; i < snap.tanks.length; i++) {
            for (let j = i + 1; j < snap.tanks.length; j++) {
                const dist = Math.hypot(
                    snap.tanks[i].x - snap.tanks[j].x,
                    snap.tanks[i].y - snap.tanks[j].y,
                );
                expect(dist).toBeGreaterThanOrEqual(minDistanceBetweenTanks);
            }
        }

        for (let t = 0; t < 30; t++) {
            engine.step();
        }

        const afterSnap = engine.getSnapshot();
        expect(afterSnap.tick).toBe(30);
        expect(afterSnap.tanks).toHaveLength(10);
    });
});



