import { describe, expect, it } from "vitest";
import { compileTankScript } from "../compiler/compiler.ts";
import { SimulationEngine, type TankDefinition } from "../simulation/engine.ts";

describe("Combat Killfeed and Damage Attribution", () => {
    it("atribui corretamente a eliminação de robô para robô com mensagem fidedigna", () => {
        const compShooter = compileTankScript("robot Atacante { fire(2); }");
        const compTarget = compileTankScript("robot Defensor {}");

        const engine = new SimulationEngine();
        const tankDefs: TankDefinition[] = [
            {
                id: "tank_attacker",
                name: "Robô Alfa",
                color: "#10b981",
                program: compShooter.bytecode!,
                initialPosition: { x: 100, y: 200, angle: 0 },
            },
            {
                id: "tank_victim",
                name: "Robô Beta",
                color: "#f43f5e",
                program: compTarget.bytecode!,
                initialPosition: { x: 140, y: 200, angle: 0 },
            },
        ];

        engine.initBattle(tankDefs);
        engine.tanks[1].energy = 10;

        engine.step();
        engine.step();

        expect(engine.tanks[1].isAlive).toBe(false);
        expect(engine.tanks[1].energy).toBe(0);
        expect(engine.tanks[0].stats.kills).toBe(1);

        const killEvent = engine.events.find((e) => e.type === "tank_destroyed");
        expect(killEvent).toBeDefined();
        expect(killEvent?.message).toBe("Robô Alfa eliminou Robô Beta");
        expect(killEvent?.attackerId).toBe("tank_attacker");
        expect(killEvent?.victimId).toBe("tank_victim");
        expect(killEvent?.sourceType).toBe("tank");
    });

    it("atribui dano ambiental à arena sem inventar personagem ou 'abateu'", () => {
        const comp = compileTankScript("robot Sobrevivente {}");
        const engine = new SimulationEngine();

        engine.initBattle([
            {
                id: "t_env",
                name: "Robô Centinela",
                color: "#3b82f6",
                program: comp.bytecode!,
                initialPosition: { x: 200, y: 200, angle: 0 },
            },
            {
                id: "t_other",
                name: "Robô Espectador",
                color: "#f59e0b",
                program: comp.bytecode!,
                initialPosition: { x: 400, y: 400, angle: 0 },
            },
        ]);

        const victim = engine.tanks[0];
        engine.applyDamageToTank(victim, 120, { type: "arena" });

        expect(victim.isAlive).toBe(false);
        expect(victim.energy).toBe(0);
        expect(engine.tanks[1].stats.kills).toBe(0);

        const killEvent = engine.events.find((e) => e.type === "tank_destroyed");
        expect(killEvent).toBeDefined();
        expect(killEvent?.message).toBe("Robô Centinela foi eliminado pela arena");
        expect(killEvent?.attackerId).toBeUndefined();
        expect(killEvent?.victimId).toBe("t_env");
        expect(killEvent?.sourceType).toBe("arena");
    });

    it("lida com eliminação de causa desconhecida sem atribuir à arena nem inventar responsáveis", () => {
        const comp = compileTankScript("robot Alvo {}");
        const engine = new SimulationEngine();

        engine.initBattle([
            {
                id: "t_unknown",
                name: "Robô Fantasma",
                color: "#8b5cf6",
                program: comp.bytecode!,
                initialPosition: { x: 250, y: 250, angle: 0 },
            },
        ]);

        const victim = engine.tanks[0];
        engine.handleTankElimination(victim, { type: "unknown" });

        expect(victim.isAlive).toBe(false);
        expect(victim.energy).toBe(0);

        const killEvent = engine.events.find((e) => e.type === "tank_destroyed");
        expect(killEvent).toBeDefined();
        expect(killEvent?.message).toBe("Robô Fantasma foi destruído");
        expect(killEvent?.attackerId).toBeUndefined();
        expect(killEvent?.victimId).toBe("t_unknown");
        expect(killEvent?.sourceType).toBe("unknown");
    });

    it("atribui o abate ao robô que desferiu o golpe fatal em caso de múltiplos atacantes", () => {
        const comp = compileTankScript("robot Tank {}");
        const engine = new SimulationEngine();

        engine.initBattle([
            { id: "t1", name: "Robô 1", color: "#10b981", program: comp.bytecode! },
            { id: "t2", name: "Robô 2", color: "#3b82f6", program: comp.bytecode! },
            { id: "victim", name: "Robô Vítima", color: "#f43f5e", program: comp.bytecode! },
        ]);

        const target = engine.tanks[2];

        engine.applyDamageToTank(target, 40, { type: "tank", attackerId: "t1" });
        expect(target.energy).toBe(60);
        expect(engine.tanks[0].stats.kills).toBe(0);

        engine.applyDamageToTank(target, 70, { type: "tank", attackerId: "t2" });
        expect(target.isAlive).toBe(false);
        expect(target.energy).toBe(0);

        expect(engine.tanks[0].stats.kills).toBe(0);
        expect(engine.tanks[1].stats.kills).toBe(1);

        const killEvent = engine.events.find((e) => e.type === "tank_destroyed");
        expect(killEvent).toBeDefined();
        expect(killEvent?.message).toBe("Robô 2 eliminou Robô Vítima");
        expect(killEvent?.attackerId).toBe("t2");
        expect(killEvent?.victimId).toBe("victim");
    });
});
