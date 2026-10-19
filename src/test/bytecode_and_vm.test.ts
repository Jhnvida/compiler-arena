import { describe, expect, it } from "vitest";
import { compileTankScript } from "../compiler/compiler.ts";
import type { TankSensors } from "../vm/types.ts";
import { VirtualMachine } from "../vm/virtualMachine.ts";

const mockSensors: TankSensors = {
    energy: 100,
    position: { x: 50, y: 75 },
    enemy: {
        visible: true,
        distance: 80,
        direction: 45,
    },
};

describe("Bytecode & VirtualMachine", () => {
    it("compiles high-level code and runs it in the VM", () => {
        const code = `
      robot Sniper {
        int targetDist;
        if (enemy.visible) {
          targetDist = enemy.distance;
          rotate(enemy.direction);
          fire(3);
        } else {
          move(20);
        }
      }
    `;
        const compilation = compileTankScript(code);
        expect(compilation.success).toBe(true);
        expect(compilation.bytecode).not.toBeNull();
        expect(compilation.bytecodeDisassembly.length).toBeGreaterThan(0);

        const vm = new VirtualMachine(compilation.bytecode!);

        const tick1 = vm.runTick(mockSensors);
        expect(tick1.actions).toHaveLength(1);
        expect(tick1.actions[0]).toEqual({ type: "rotate", value: 45 });
        expect(tick1.yieldReason).toBe("action");

        const tick2 = vm.runTick(mockSensors);
        expect(tick2.actions).toHaveLength(1);
        expect(tick2.actions[0]).toEqual({ type: "fire", value: 3 });
    });

    it("reads sensor values accurately during execution", () => {
        const code = `
      robot SensorBot {
        float myEnergy = energy;
        float posX = position.x;
        float posY = position.y;
        move(myEnergy);
      }
    `;
        const compilation = compileTankScript(code);
        expect(compilation.success).toBe(true);

        const vm = new VirtualMachine(compilation.bytecode!);
        const tick = vm.runTick(mockSensors);

        expect(tick.actions).toHaveLength(1);
        expect(tick.actions[0]).toEqual({ type: "move", value: 100 });
        expect(vm.variables.get("posX")).toBe(50);
        expect(vm.variables.get("posY")).toBe(75);
    });

    it("prevents browser freeze on infinite loops by respecting instruction quota", () => {
        const code = `
      robot LoopBot {
        int x = 0;
        while (true) {
          x = x + 1;
        }
      }
    `;
        const compilation = compileTankScript(code);
        expect(compilation.success).toBe(true);

        const vm = new VirtualMachine(compilation.bytecode!, { maxInstructionsPerTick: 50 });
        const tick = vm.runTick(mockSensors);

        expect(tick.yieldReason).toBe("quota_exhausted");
        expect(tick.instructionsExecuted).toBe(50);
        expect(tick.isHalted).toBe(false);
        expect(vm.variables.get("x")).toBeGreaterThan(0);
    });

    it("persists variables and state across ticks", () => {
        const code = `
      robot Patrol {
        int stepCount;
        stepCount = stepCount + 1;
        move(stepCount * 10);
      }
    `;
        const compilation = compileTankScript(code);
        expect(compilation.success).toBe(true);

        const vm = new VirtualMachine(compilation.bytecode!, { loopOnCompletion: true });

        const tick1 = vm.runTick(mockSensors);
        expect(tick1.actions[0]).toEqual({ type: "move", value: 10 });
        expect(vm.variables.get("stepCount")).toBe(1);

        const tick2 = vm.runTick(mockSensors);
        expect(tick2.actions[0]).toEqual({ type: "move", value: 20 });
        expect(vm.variables.get("stepCount")).toBe(2);
    });
});
