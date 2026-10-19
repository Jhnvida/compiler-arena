import type { BinaryOperator } from "./ast.ts";
import type { TACInstruction, TACOperand } from "./ir.ts";

export type BytecodeOp =
    | "PUSH_CONST"
    | "LOAD_VAR"
    | "STORE_VAR"
    | "READ_SENSOR"
    | "ADD"
    | "SUB"
    | "MUL"
    | "DIV"
    | "MOD"
    | "NEG"
    | "NOT"
    | "CMP_LT"
    | "CMP_LE"
    | "CMP_GT"
    | "CMP_GE"
    | "CMP_EQ"
    | "CMP_NE"
    | "LOGICAL_AND"
    | "LOGICAL_OR"
    | "JMP"
    | "JZ"
    | "JNZ"
    | "ACTION"
    | "POP"
    | "HALT";

export interface BytecodeInstruction {
    op: BytecodeOp;
    arg?: string | number | boolean;
    arg2?: number;
    sourceLabel?: string;
}

export interface BytecodeProgram {
    robotName: string;
    instructions: BytecodeInstruction[];
    variableNames: string[];
}

export class BytecodeGenerator {
    public generate(robotName: string, ir: TACInstruction[]): BytecodeProgram {
        const rawInstructions: BytecodeInstruction[] = [];
        const labelToAddress = new Map<string, number>();
        const pendingJumps: { index: number; targetLabel: string }[] = [];
        const variables = new Set<string>();

        const pushOperand = (op: TACOperand) => {
            switch (op.kind) {
                case "const":
                    rawInstructions.push({ op: "PUSH_CONST", arg: op.value });
                    break;
                case "var":
                    variables.add(op.name);
                    rawInstructions.push({ op: "LOAD_VAR", arg: op.name });
                    break;
                case "temp":
                    variables.add(op.id);
                    rawInstructions.push({ op: "LOAD_VAR", arg: op.id });
                    break;
                case "sensor":
                    rawInstructions.push({ op: "READ_SENSOR", arg: op.name });
                    break;
            }
        };

        const storeOperand = (op: TACOperand) => {
            if (op.kind === "var") {
                variables.add(op.name);
                rawInstructions.push({ op: "STORE_VAR", arg: op.name });
            } else if (op.kind === "temp") {
                variables.add(op.id);
                rawInstructions.push({ op: "STORE_VAR", arg: op.id });
            }
        };

        for (const instr of ir) {
            switch (instr.op) {
                case "LABEL":
                    labelToAddress.set(instr.label, rawInstructions.length);
                    break;

                case "ASSIGN":
                    pushOperand(instr.src);
                    storeOperand(instr.dst);
                    break;

                case "BINOP": {
                    pushOperand(instr.arg1);
                    pushOperand(instr.arg2);
                    const binOp = this.mapBinaryOp(instr.operator);
                    rawInstructions.push({ op: binOp });
                    storeOperand(instr.dst);
                    break;
                }

                case "UNARYOP": {
                    pushOperand(instr.arg);
                    if (instr.operator === "!") {
                        rawInstructions.push({ op: "NOT" });
                    } else if (instr.operator === "-") {
                        rawInstructions.push({ op: "NEG" });
                    }
                    storeOperand(instr.dst);
                    break;
                }

                case "READ_SENSOR":
                    rawInstructions.push({ op: "READ_SENSOR", arg: instr.sensor });
                    storeOperand(instr.dst);
                    break;

                case "PARAM":
                    pushOperand(instr.arg);
                    break;

                case "ACTION":
                    rawInstructions.push({ op: "ACTION", arg: instr.name, arg2: instr.argCount });
                    break;

                case "JUMP":
                    pendingJumps.push({ index: rawInstructions.length, targetLabel: instr.target });
                    rawInstructions.push({ op: "JMP", arg: 0, sourceLabel: instr.target });
                    break;

                case "JUMP_IF_FALSE":
                    pushOperand(instr.cond);
                    pendingJumps.push({ index: rawInstructions.length, targetLabel: instr.target });
                    rawInstructions.push({ op: "JZ", arg: 0, sourceLabel: instr.target });
                    break;

                case "JUMP_IF_TRUE":
                    pushOperand(instr.cond);
                    pendingJumps.push({ index: rawInstructions.length, targetLabel: instr.target });
                    rawInstructions.push({ op: "JNZ", arg: 0, sourceLabel: instr.target });
                    break;
            }
        }

        rawInstructions.push({ op: "HALT" });

        for (const pending of pendingJumps) {
            const address = labelToAddress.get(pending.targetLabel);
            if (address !== undefined) {
                rawInstructions[pending.index].arg = address;
            } else {
                rawInstructions[pending.index].arg = rawInstructions.length - 1;
            }
        }

        return {
            robotName,
            instructions: rawInstructions,
            variableNames: Array.from(variables),
        };
    }

    private mapBinaryOp(op: BinaryOperator): BytecodeOp {
        switch (op) {
            case "+":
                return "ADD";
            case "-":
                return "SUB";
            case "*":
                return "MUL";
            case "/":
                return "DIV";
            case "%":
                return "MOD";
            case "<":
                return "CMP_LT";
            case "<=":
                return "CMP_LE";
            case ">":
                return "CMP_GT";
            case ">=":
                return "CMP_GE";
            case "==":
                return "CMP_EQ";
            case "!=":
                return "CMP_NE";
            case "&&":
                return "LOGICAL_AND";
            case "||":
                return "LOGICAL_OR";
        }
    }
}

export function disassembleBytecode(program: BytecodeProgram): string[] {
    return program.instructions.map((instr, idx) => {
        const padIdx = idx.toString().padStart(4, "0");
        let detail = `${instr.op}`;
        if (instr.arg !== undefined) {
            detail += ` ${instr.arg}`;
        }
        if (instr.arg2 !== undefined) {
            detail += `, ${instr.arg2}`;
        }
        if (instr.sourceLabel) {
            detail += ` (${instr.sourceLabel})`;
        }
        return `${padIdx}: ${detail}`;
    });
}
