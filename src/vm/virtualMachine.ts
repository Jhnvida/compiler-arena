import type { BytecodeInstruction, BytecodeProgram } from "../compiler/bytecode.ts";
import type { TankAction, TankSensors, VMExecutionResult } from "./types.ts";

interface TickContext {
    startedAtZero: boolean;
    hasLoopedOnHalt: boolean;
}

export class VirtualMachine {
    public readonly program: BytecodeProgram;
    public ip = 0;
    public stack: (number | boolean)[] = [];
    public variables = new Map<string, number | boolean>();
    public halted = false;
    public error: string | null = null;
    public maxInstructionsPerTick: number;
    public loopOnCompletion: boolean;

    constructor(
        program: BytecodeProgram,
        options?: {
            maxInstructionsPerTick?: number;
            loopOnCompletion?: boolean;
        },
    ) {
        this.program = program;
        this.maxInstructionsPerTick = options?.maxInstructionsPerTick ?? 100;
        this.loopOnCompletion = options?.loopOnCompletion ?? true;
        this.reset();
    }

    public reset(): void {
        this.ip = 0;
        this.stack = [];
        this.variables.clear();
        this.halted = false;
        this.error = null;

        for (const name of this.program.variableNames) {
            this.variables.set(name, 0);
        }
    }

    public runTick(sensors: TankSensors, customMaxInstructions?: number): VMExecutionResult {
        const maxInstructions = customMaxInstructions ?? this.maxInstructionsPerTick;
        const actions: TankAction[] = [];
        const startedAtZero = this.ip === 0;
        const ctx: TickContext = { startedAtZero, hasLoopedOnHalt: false };
        let instructionsExecuted = 0;

        if (this.halted) {
            if (this.loopOnCompletion) {
                this.ip = 0;
                this.halted = false;
            } else {
                return {
                    actions: [],
                    instructionsExecuted: 0,
                    yieldReason: "halted",
                    isHalted: true,
                    error: this.error,
                };
            }
        }

        const instructions = this.program.instructions;
        const totalInstructions = instructions.length;

        while (instructionsExecuted < maxInstructions) {
            if (this.ip >= totalInstructions) {
                if (this.loopOnCompletion) {
                    this.ip = 0;
                } else {
                    this.halted = true;
                    return {
                        actions,
                        instructionsExecuted,
                        yieldReason: "halted",
                        isHalted: true,
                        error: null,
                    };
                }
            }

            const instr = instructions[this.ip];
            this.ip++;
            instructionsExecuted++;

            const yieldAction = this.executeInstruction(instr, sensors, actions, ctx);

            if (this.error !== null) {
                return {
                    actions,
                    instructionsExecuted,
                    yieldReason: "error",
                    isHalted: true,
                    error: this.error,
                };
            }

            if (this.halted) {
                return {
                    actions,
                    instructionsExecuted,
                    yieldReason: "halted",
                    isHalted: true,
                    error: null,
                };
            }

            if (yieldAction) {
                return {
                    actions,
                    instructionsExecuted,
                    yieldReason: actions.length > 0 ? "action" : "halted",
                    isHalted: false,
                    error: null,
                };
            }
        }

        return {
            actions,
            instructionsExecuted,
            yieldReason: "quota_exhausted",
            isHalted: false,
            error: null,
        };
    }

    private executeInstruction(
        instr: BytecodeInstruction,
        sensors: TankSensors,
        actions: TankAction[],
        ctx: TickContext,
    ): boolean {
        switch (instr.op) {
            case "PUSH_CONST": {
                this.stack.push(instr.arg as number | boolean);
                return false;
            }

            case "LOAD_VAR": {
                const varName = instr.arg as string;
                const val = this.variables.get(varName) ?? 0;
                this.stack.push(val);
                return false;
            }

            case "STORE_VAR": {
                const varName = instr.arg as string;
                const val = this.pop();
                this.variables.set(varName, val);
                return false;
            }

            case "READ_SENSOR": {
                const sensorName = instr.arg as string;
                const val = this.getSensorValue(sensorName, sensors);
                this.stack.push(val);
                return false;
            }

            case "ADD": {
                const b = Number(this.pop());
                const a = Number(this.pop());
                const res = a + b;
                this.stack.push(Number.isFinite(res) ? res : 0);
                return false;
            }

            case "SUB": {
                const b = Number(this.pop());
                const a = Number(this.pop());
                const res = a - b;
                this.stack.push(Number.isFinite(res) ? res : 0);
                return false;
            }

            case "MUL": {
                const b = Number(this.pop());
                const a = Number(this.pop());
                const res = a * b;
                this.stack.push(Number.isFinite(res) ? res : 0);
                return false;
            }

            case "DIV": {
                const b = Number(this.pop());
                const a = Number(this.pop());
                if (b === 0) {
                    this.stack.push(0);
                } else {
                    const res = a / b;
                    this.stack.push(Number.isFinite(res) ? res : 0);
                }
                return false;
            }

            case "MOD": {
                const b = Number(this.pop());
                const a = Number(this.pop());
                const res = b === 0 ? 0 : a % b;
                this.stack.push(Number.isFinite(res) ? res : 0);
                return false;
            }

            case "NEG": {
                const a = Number(this.pop());
                const res = -a;
                this.stack.push(Number.isFinite(res) ? res : 0);
                return false;
            }

            case "NOT": {
                const a = this.pop();
                this.stack.push(!a);
                return false;
            }

            case "CMP_LT": {
                const b = Number(this.pop());
                const a = Number(this.pop());
                this.stack.push(a < b);
                return false;
            }

            case "CMP_LE": {
                const b = Number(this.pop());
                const a = Number(this.pop());
                this.stack.push(a <= b);
                return false;
            }

            case "CMP_GT": {
                const b = Number(this.pop());
                const a = Number(this.pop());
                this.stack.push(a > b);
                return false;
            }

            case "CMP_GE": {
                const b = Number(this.pop());
                const a = Number(this.pop());
                this.stack.push(a >= b);
                return false;
            }

            case "CMP_EQ": {
                const b = this.pop();
                const a = this.pop();
                this.stack.push(a === b);
                return false;
            }

            case "CMP_NE": {
                const b = this.pop();
                const a = this.pop();
                this.stack.push(a !== b);
                return false;
            }

            case "LOGICAL_AND": {
                const b = Boolean(this.pop());
                const a = Boolean(this.pop());
                this.stack.push(a && b);
                return false;
            }

            case "LOGICAL_OR": {
                const b = Boolean(this.pop());
                const a = Boolean(this.pop());
                this.stack.push(a || b);
                return false;
            }

            case "JMP": {
                this.ip = instr.arg as number;
                return false;
            }

            case "JZ": {
                const cond = this.pop();
                if (!cond) {
                    this.ip = instr.arg as number;
                }
                return false;
            }

            case "JNZ": {
                const cond = this.pop();
                if (cond) {
                    this.ip = instr.arg as number;
                }
                return false;
            }

            case "ACTION": {
                const actionName = instr.arg as "move" | "back" | "rotate" | "scan" | "fire";
                const argCount = instr.arg2 ?? 0;
                let value: number | undefined = undefined;

                if (argCount > 0) {
                    const rawVal = Number(this.pop());
                    value = Number.isFinite(rawVal) ? rawVal : 0;
                }

                if (actionName === "fire") {
                    value = Math.max(1, Math.min(3, Math.round(value ?? 1)));
                }

                actions.push({
                    type: actionName,
                    value,
                });

                return true;
            }

            case "POP": {
                this.pop();
                return false;
            }

            case "HALT": {
                if (this.loopOnCompletion) {
                    this.ip = 0;
                    this.halted = false;
                    if (actions.length > 0) {
                        return true;
                    }
                    if (ctx.startedAtZero || ctx.hasLoopedOnHalt) {
                        return true;
                    }
                    ctx.hasLoopedOnHalt = true;
                    return false;
                } else {
                    this.halted = true;
                    return true;
                }
            }

            default: {
                this.error = `Instrução de bytecode desconhecida ou inválida: ${(instr as BytecodeInstruction).op}`;
                return false;
            }
        }
    }

    private pop(): number | boolean {
        if (this.stack.length === 0) {
            return 0;
        }
        return this.stack.pop()!;
    }

    private getSensorValue(name: string, sensors: TankSensors): number | boolean {
        switch (name) {
            case "energy":
                return sensors.energy;
            case "position.x":
                return sensors.position.x;
            case "position.y":
                return sensors.position.y;
            case "enemy.visible":
                return sensors.enemy.visible;
            case "enemy.distance":
                return sensors.enemy.distance;
            case "enemy.direction":
                return sensors.enemy.direction;
            default:
                return 0;
        }
    }
}
