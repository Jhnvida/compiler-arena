import { describe, expect, it } from "vitest";
import { compileTankScript } from "../compiler/compiler.ts";
import type { TankSensors } from "../vm/types.ts";
import { VirtualMachine } from "../vm/virtualMachine.ts";

describe("Academic Specs & Edge Cases", () => {
    it("compiles and executes the exact Hunter example from the professor specifications", () => {
        const code = `
      robot Hunter {
          int distancia;
          
          scan();
          if (enemy.visible) {
              distancia = enemy.distance;
              rotate(enemy.direction);
              if (distancia < 120) {
                  fire(3);
              } else {
                  fire(1);
                  move(20);
              }
          } else {
              rotate(30);
              move(15);
          }
      }
    `;

        const result = compileTankScript(code);
        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.robotName).toBe("Hunter");
        expect(result.bytecode).not.toBeNull();
        expect(result.rawIR.length).toBeGreaterThan(0);
        expect(result.optimizedIR.length).toBeGreaterThan(0);

        const closeEnemySensors: TankSensors = {
            energy: 100,
            position: { x: 10, y: 10 },
            enemy: { visible: true, distance: 80, direction: 45 },
        };

        const vm1 = new VirtualMachine(result.bytecode!);
        const tick1 = vm1.runTick(closeEnemySensors);
        expect(tick1.actions[0]).toEqual({ type: "scan" });

        const tick2 = vm1.runTick(closeEnemySensors);
        expect(tick2.actions[0]).toEqual({ type: "rotate", value: 45 });

        const tick3 = vm1.runTick(closeEnemySensors);
        expect(tick3.actions[0]).toEqual({ type: "fire", value: 3 });

        const noEnemySensors: TankSensors = {
            energy: 100,
            position: { x: 10, y: 10 },
            enemy: { visible: false, distance: 999, direction: 0 },
        };

        const vm2 = new VirtualMachine(result.bytecode!);
        const t1 = vm2.runTick(noEnemySensors);
        expect(t1.actions[0]).toEqual({ type: "scan" });

        const t2 = vm2.runTick(noEnemySensors);
        expect(t2.actions[0]).toEqual({ type: "rotate", value: 30 });

        const t3 = vm2.runTick(noEnemySensors);
        expect(t3.actions[0]).toEqual({ type: "move", value: 15 });
    });

    it("handles empty robot gracefully", () => {
        const code = `robot Ghost {}`;
        const result = compileTankScript(code);
        expect(result.success).toBe(true);
        expect(result.robotName).toBe("Ghost");

        const vm = new VirtualMachine(result.bytecode!);
        const tick = vm.runTick({
            energy: 100,
            position: { x: 0, y: 0 },
            enemy: { visible: false, distance: 0, direction: 0 },
        });
        expect(tick.actions).toHaveLength(0);
    });

    it("handles division by zero safely without throwing or crashing", () => {
        const code = `
      robot DivZero {
        int x = 10 / 0;
        int y = 10 % 0;
        move(x);
      }
    `;
        const result = compileTankScript(code);
        expect(result.success).toBe(true);

        const vm = new VirtualMachine(result.bytecode!);
        const tick = vm.runTick({
            energy: 100,
            position: { x: 0, y: 0 },
            enemy: { visible: false, distance: 0, direction: 0 },
        });

        expect(tick.actions[0]).toEqual({ type: "move", value: 0 });
    });

    it("handles chained else-if blocks properly", () => {
        const code = `
      robot Chained {
        int x = 2;
        if (x == 1) {
          move(10);
        } else if (x == 2) {
          move(20);
        } else {
          move(30);
        }
      }
    `;
        const result = compileTankScript(code);
        expect(result.success).toBe(true);

        const vm = new VirtualMachine(result.bytecode!);
        const tick = vm.runTick({
            energy: 100,
            position: { x: 0, y: 0 },
            enemy: { visible: false, distance: 0, direction: 0 },
        });

        expect(tick.actions[0]).toEqual({ type: "move", value: 20 });
    });

    it("validates boundary values of fire power", () => {
        const validResult = compileTankScript(`robot GoodFire { fire(1); fire(3); }`);
        expect(validResult.success).toBe(true);

        const zeroResult = compileTankScript(`robot BadFire0 { fire(0); }`);
        expect(zeroResult.success).toBe(false);
        expect(zeroResult.errors[0].message).toContain("Potência de tiro inválida");

        const fourResult = compileTankScript(`robot BadFire4 { fire(4); }`);
        expect(fourResult.success).toBe(false);
        expect(fourResult.errors[0].message).toContain("Potência de tiro inválida");
    });

    it("tracks line and column on semantic error correctly", () => {
        const code = `robot PosTest {\n  int a = 1;\n  int a = 2;\n}`;
        const result = compileTankScript(code);
        expect(result.success).toBe(false);
        expect(result.errors[0].line).toBe(3);
        expect(result.errors[0].column).toBe(3);
    });

    it("rejects negative fire power expressions at compile time", () => {
        const neg1 = compileTankScript(`robot NegFire { fire(-1); }`);
        expect(neg1.success).toBe(false);
        expect(neg1.errors[0].message).toContain("Potência de tiro inválida");

        const neg5 = compileTankScript(`robot NegFire5 { fire(-5); }`);
        expect(neg5.success).toBe(false);
        expect(neg5.errors[0].message).toContain("Potência de tiro inválida");
    });

    it("forbids declaring variables with reserved sensor root names", () => {
        const badEnergy = compileTankScript(`robot BadEnergy { int energy = 50; }`);
        expect(badEnergy.success).toBe(false);
        expect(badEnergy.errors[0].message).toContain("é um sensor embutido reservado");

        const badEnemy = compileTankScript(`robot BadEnemy { float enemy = 10; }`);
        expect(badEnemy.success).toBe(false);
        expect(badEnemy.errors[0].message).toContain("é um sensor embutido reservado");

        const badPos = compileTankScript(`robot BadPos { int position = 0; }`);
        expect(badPos.success).toBe(false);
        expect(badPos.errors[0].message).toContain("é um sensor embutido reservado");
    });

    it("eliminates dead blocks in if (false) and unreachable code", () => {
        const code = `
      robot DeadCodeBot {
        if (false) {
          move(999);
          fire(3);
        } else {
          rotate(45);
        }
      }
    `;
        const result = compileTankScript(code);
        expect(result.success).toBe(true);
        expect(result.optimizationStats.deadCodeRemoved).toBeGreaterThan(0);

        const optimizedTAC = result.optimizedIRText;
        expect(optimizedTAC).not.toContain("999");
        expect(optimizedTAC).not.toContain("CALL_ACTION move");
        expect(optimizedTAC).toContain("CALL_ACTION rotate, 1");
    });

    it("isolates shadowed variables across block scopes at runtime", () => {
        const code = `
      robot ScopeIsolation {
        int x = 5;
        if (true) {
          int x = 10;
          move(x);
        }
        move(x);
      }
    `;
        const result = compileTankScript(code);
        expect(result.success).toBe(true);

        const vm = new VirtualMachine(result.bytecode!);
        const tick1 = vm.runTick({
            energy: 100,
            position: { x: 0, y: 0 },
            enemy: { visible: false, distance: 0, direction: 0 },
        });
        expect(tick1.actions[0]).toEqual({ type: "move", value: 10 });

        const tick2 = vm.runTick({
            energy: 100,
            position: { x: 0, y: 0 },
            enemy: { visible: false, distance: 0, direction: 0 },
        });
        expect(tick2.actions[0]).toEqual({ type: "move", value: 5 });
    });

    it("retrieves all symbols across all nested scopes for the inspector UI", () => {
        const code = `
      robot SymbolTreeBot {
        int rootVar = 1;
        if (true) {
          int innerVar = 2;
          while (false) {
            int deepVar = 3;
          }
        }
      }
    `;
        const result = compileTankScript(code);
        expect(result.success).toBe(true);
        const names = result.symbols.map((s) => s.name);
        expect(names).toContain("rootVar");
        expect(names).toContain("innerVar");
        expect(names).toContain("deepVar");
    });

    it("yields cleanly on idle or empty robot without burning 100 quota cycles", () => {
        const code = `robot IdleBot { int x = 1; int y = 2; }`;
        const result = compileTankScript(code);
        expect(result.success).toBe(true);

        const vm = new VirtualMachine(result.bytecode!, { maxInstructionsPerTick: 100 });
        const tick = vm.runTick({
            energy: 100,
            position: { x: 0, y: 0 },
            enemy: { visible: false, distance: 0, direction: 0 },
        });
        expect(tick.yieldReason).toBe("halted");
        expect(tick.instructionsExecuted).toBeLessThan(10);
        expect(tick.actions).toHaveLength(0);
    });

    it("clamps runtime fire power to 1..3 and handles invalid values safely", () => {
        const code = `
      robot WildFire {
        float p = 99.5;
        fire(p);
      }
    `;
        const result = compileTankScript(code);
        expect(result.success).toBe(true);

        const vm = new VirtualMachine(result.bytecode!);
        const tick = vm.runTick({
            energy: 100,
            position: { x: 0, y: 0 },
            enemy: { visible: false, distance: 0, direction: 0 },
        });
        expect(tick.actions[0]).toEqual({ type: "fire", value: 3 });
    });

    it("successfully compiles all standard preset robots", async () => {
        const {
            PRESET_HUNTER,
            PRESET_SNIPER,
            PRESET_STRIKER,
            PRESET_PATROL,
            PRESET_OPTIMIZATION_DEMO,
            PRESET_ERRORS_DEMO,
        } = await import("../compiler/presets.ts");

        const hunterRes = compileTankScript(PRESET_HUNTER);
        expect(hunterRes.success).toBe(true);
        expect(hunterRes.robotName).toBe("Hunter");

        const sniperRes = compileTankScript(PRESET_SNIPER);
        expect(sniperRes.success).toBe(true);
        expect(sniperRes.robotName).toBe("SniperScout");

        const strikerRes = compileTankScript(PRESET_STRIKER);
        expect(strikerRes.success).toBe(true);
        expect(strikerRes.robotName).toBe("AggressiveStriker");

        const patrolRes = compileTankScript(PRESET_PATROL);
        expect(patrolRes.success).toBe(true);
        expect(patrolRes.robotName).toBe("WanderingPatrol");

        const optRes = compileTankScript(PRESET_OPTIMIZATION_DEMO);
        expect(optRes.success).toBe(true);
        expect(optRes.optimizationStats.deadCodeRemoved).toBeGreaterThan(0);

        const errRes = compileTankScript(PRESET_ERRORS_DEMO);
        expect(errRes.success).toBe(false);
        expect(errRes.errors.length).toBeGreaterThanOrEqual(4);
    });
});
