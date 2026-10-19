import type { BinaryOperator, DataType } from "./ast.ts";
import type { TACInstruction, TACOperand } from "./ir.ts";

export interface OptimizationStats {
    constantFolds: number;
    algebraicSimplifications: number;
    constantPropagations: number;
    deadCodeRemoved: number;
    instructionsBefore: number;
    instructionsAfter: number;
}

export class IROptimizer {
    private stats: OptimizationStats = {
        constantFolds: 0,
        algebraicSimplifications: 0,
        constantPropagations: 0,
        deadCodeRemoved: 0,
        instructionsBefore: 0,
        instructionsAfter: 0,
    };

    public optimize(instructions: TACInstruction[]): {
        instructions: TACInstruction[];
        stats: OptimizationStats;
    } {
        this.stats = {
            constantFolds: 0,
            algebraicSimplifications: 0,
            constantPropagations: 0,
            deadCodeRemoved: 0,
            instructionsBefore: instructions.length,
            instructionsAfter: 0,
        };

        let current = [...instructions];
        const MAX_PASSES = 10;

        for (let pass = 0; pass < MAX_PASSES; pass++) {
            let changed = false;

            const [folded, p1Changed] = this.passConstantAndAlgebraic(current);
            if (p1Changed) changed = true;
            current = folded;

            const [branchSimplified, p2Changed] = this.passBranchSimplification(current);
            if (p2Changed) changed = true;
            current = branchSimplified;

            const [reachableCode, p3Changed] = this.passUnreachableCodeElimination(current);
            if (p3Changed) changed = true;
            current = reachableCode;

            const [jumpsCleaned, p4Changed] = this.passDeadJumps(current);
            if (p4Changed) changed = true;
            current = jumpsCleaned;

            const [labelsCleaned, p5Changed] = this.passUnreferencedLabels(current);
            if (p5Changed) changed = true;
            current = labelsCleaned;

            const [deadTempsRemoved, p6Changed] = this.passDeadTemporaryElimination(current);
            if (p6Changed) changed = true;
            current = deadTempsRemoved;

            if (!changed) break;
        }

        this.stats.instructionsAfter = current.length;

        return {
            instructions: current,
            stats: this.stats,
        };
    }

    private passConstantAndAlgebraic(instructions: TACInstruction[]): [TACInstruction[], boolean] {
        const result: TACInstruction[] = [];
        let changed = false;

        const knownTemps = new Map<string, { value: number | boolean; type: DataType }>();
        const tempAliases = new Map<string, TACOperand>();

        const resolveOp = (op: TACOperand): TACOperand => {
            if (op.kind === "temp") {
                if (knownTemps.has(op.id)) {
                    const val = knownTemps.get(op.id)!;
                    return { kind: "const", value: val.value, type: val.type };
                }
                if (tempAliases.has(op.id)) {
                    return tempAliases.get(op.id)!;
                }
            }
            return op;
        };

        for (const instr of instructions) {
            if (
                instr.op === "LABEL" ||
                instr.op === "JUMP" ||
                instr.op === "JUMP_IF_FALSE" ||
                instr.op === "JUMP_IF_TRUE"
            ) {
                knownTemps.clear();
                tempAliases.clear();
            }

            switch (instr.op) {
                case "ASSIGN": {
                    const src = resolveOp(instr.src);
                    if (src !== instr.src) {
                        this.stats.constantPropagations++;
                        changed = true;
                    }

                    if (instr.dst.kind === "temp") {
                        if (src.kind === "const") {
                            knownTemps.set(instr.dst.id, { value: src.value, type: src.type });
                        } else if (src.kind === "var" || src.kind === "temp") {
                            tempAliases.set(instr.dst.id, src);
                        }
                    } else if (instr.dst.kind === "var") {
                        for (const [tId, target] of tempAliases.entries()) {
                            if (target.kind === "var" && target.name === instr.dst.name) {
                                tempAliases.delete(tId);
                            }
                        }
                    }

                    result.push({ op: "ASSIGN", dst: instr.dst, src });
                    break;
                }

                case "BINOP": {
                    const arg1 = resolveOp(instr.arg1);
                    const arg2 = resolveOp(instr.arg2);

                    if (arg1 !== instr.arg1 || arg2 !== instr.arg2) {
                        this.stats.constantPropagations++;
                        changed = true;
                    }

                    if (arg1.kind === "const" && arg2.kind === "const") {
                        const folded = this.evalBinaryConst(
                            instr.operator,
                            arg1.value,
                            arg2.value,
                            arg1.type,
                            arg2.type,
                        );
                        if (folded !== null) {
                            this.stats.constantFolds++;
                            changed = true;
                            if (instr.dst.kind === "temp") {
                                knownTemps.set(instr.dst.id, folded);
                            }
                            result.push({
                                op: "ASSIGN",
                                dst: instr.dst,
                                src: { kind: "const", value: folded.value, type: folded.type },
                            });
                            break;
                        }
                    }

                    const simplified = this.evalAlgebraic(instr.operator, arg1, arg2);
                    if (simplified !== null) {
                        this.stats.algebraicSimplifications++;
                        changed = true;
                        if (instr.dst.kind === "temp") {
                            if (simplified.kind === "const") {
                                knownTemps.set(instr.dst.id, { value: simplified.value, type: simplified.type });
                            } else if (simplified.kind === "var" || simplified.kind === "temp") {
                                tempAliases.set(instr.dst.id, simplified);
                            }
                        }
                        result.push({
                            op: "ASSIGN",
                            dst: instr.dst,
                            src: simplified,
                        });
                        break;
                    }

                    result.push({
                        op: "BINOP",
                        dst: instr.dst,
                        operator: instr.operator,
                        arg1,
                        arg2,
                    });
                    break;
                }

                case "UNARYOP": {
                    const arg = resolveOp(instr.arg);
                    if (arg !== instr.arg) {
                        this.stats.constantPropagations++;
                        changed = true;
                    }

                    if (instr.operator === "+") {
                        this.stats.algebraicSimplifications++;
                        changed = true;
                        if (instr.dst.kind === "temp") {
                            if (arg.kind === "const") {
                                knownTemps.set(instr.dst.id, { value: arg.value, type: arg.type });
                            } else {
                                tempAliases.set(instr.dst.id, arg);
                            }
                        }
                        result.push({
                            op: "ASSIGN",
                            dst: instr.dst,
                            src: arg,
                        });
                        break;
                    }

                    if (arg.kind === "const") {
                        const folded = this.evalUnaryConst(instr.operator, arg.value, arg.type);
                        if (folded !== null) {
                            this.stats.constantFolds++;
                            changed = true;
                            if (instr.dst.kind === "temp") {
                                knownTemps.set(instr.dst.id, folded);
                            }
                            result.push({
                                op: "ASSIGN",
                                dst: instr.dst,
                                src: { kind: "const", value: folded.value, type: folded.type },
                            });
                            break;
                        }
                    }

                    result.push({
                        op: "UNARYOP",
                        dst: instr.dst,
                        operator: instr.operator,
                        arg,
                    });
                    break;
                }

                case "PARAM": {
                    const arg = resolveOp(instr.arg);
                    if (arg !== instr.arg) {
                        this.stats.constantPropagations++;
                        changed = true;
                    }
                    result.push({ op: "PARAM", arg });
                    break;
                }

                case "JUMP_IF_FALSE": {
                    const cond = resolveOp(instr.cond);
                    if (cond !== instr.cond) {
                        this.stats.constantPropagations++;
                        changed = true;
                    }
                    result.push({ op: "JUMP_IF_FALSE", cond, target: instr.target });
                    break;
                }

                case "JUMP_IF_TRUE": {
                    const cond = resolveOp(instr.cond);
                    if (cond !== instr.cond) {
                        this.stats.constantPropagations++;
                        changed = true;
                    }
                    result.push({ op: "JUMP_IF_TRUE", cond, target: instr.target });
                    break;
                }

                default:
                    result.push(instr);
                    break;
            }
        }

        return [result, changed];
    }

    private evalBinaryConst(
        op: BinaryOperator,
        v1: number | boolean,
        v2: number | boolean,
        t1: DataType,
        t2: DataType,
    ): { value: number | boolean; type: DataType } | null {
        const isFloat = t1 === "float" || t2 === "float";

        if (typeof v1 === "number" && typeof v2 === "number") {
            switch (op) {
                case "+":
                    return { value: isFloat ? v1 + v2 : Math.trunc(v1 + v2), type: isFloat ? "float" : "int" };
                case "-":
                    return { value: isFloat ? v1 - v2 : Math.trunc(v1 - v2), type: isFloat ? "float" : "int" };
                case "*":
                    return { value: isFloat ? v1 * v2 : Math.trunc(v1 * v2), type: isFloat ? "float" : "int" };
                case "/":
                    if (v2 === 0) return null;
                    return { value: isFloat ? v1 / v2 : Math.trunc(v1 / v2), type: isFloat ? "float" : "int" };
                case "%":
                    if (v2 === 0) return null;
                    return { value: Math.trunc(v1 % v2), type: "int" };
                case "<":
                    return { value: v1 < v2, type: "bool" };
                case "<=":
                    return { value: v1 <= v2, type: "bool" };
                case ">":
                    return { value: v1 > v2, type: "bool" };
                case ">=":
                    return { value: v1 >= v2, type: "bool" };
                case "==":
                    return { value: v1 === v2, type: "bool" };
                case "!=":
                    return { value: v1 !== v2, type: "bool" };
            }
        }

        if (typeof v1 === "boolean" && typeof v2 === "boolean") {
            switch (op) {
                case "&&":
                    return { value: v1 && v2, type: "bool" };
                case "||":
                    return { value: v1 || v2, type: "bool" };
                case "==":
                    return { value: v1 === v2, type: "bool" };
                case "!=":
                    return { value: v1 !== v2, type: "bool" };
            }
        }

        return null;
    }

    private evalUnaryConst(
        op: "-" | "+" | "!",
        val: number | boolean,
        type: DataType,
    ): { value: number | boolean; type: DataType } | null {
        if (typeof val === "number") {
            if (op === "-") return { value: -val, type };
            if (op === "+") return { value: +val, type };
        }
        if (typeof val === "boolean" && op === "!") {
            return { value: !val, type: "bool" };
        }
        return null;
    }

    private evalAlgebraic(op: BinaryOperator, arg1: TACOperand, arg2: TACOperand): TACOperand | null {
        if (op === "+" && this.isConstZero(arg2)) return arg1;
        if (op === "+" && this.isConstZero(arg1)) return arg2;

        if (op === "-" && this.isConstZero(arg2)) return arg1;

        if (op === "-" && this.operandsEqual(arg1, arg2)) {
            return { kind: "const", value: 0, type: "int" };
        }

        if (op === "*" && this.isConstOne(arg2)) return arg1;
        if (op === "*" && this.isConstOne(arg1)) return arg2;

        if (op === "*" && this.isConstZero(arg2)) return { kind: "const", value: 0, type: "int" };
        if (op === "*" && this.isConstZero(arg1)) return { kind: "const", value: 0, type: "int" };

        if (op === "/" && this.isConstOne(arg2)) return arg1;

        if (op === "==" && this.operandsEqual(arg1, arg2)) {
            return { kind: "const", value: true, type: "bool" };
        }

        if (op === "!=" && this.operandsEqual(arg1, arg2)) {
            return { kind: "const", value: false, type: "bool" };
        }

        if (op === "&&" && this.isConstTrue(arg2)) return arg1;
        if (op === "&&" && this.isConstTrue(arg1)) return arg2;

        if (op === "&&" && this.isConstFalse(arg2)) return { kind: "const", value: false, type: "bool" };
        if (op === "&&" && this.isConstFalse(arg1)) return { kind: "const", value: false, type: "bool" };

        if (op === "||" && this.isConstFalse(arg2)) return arg1;
        if (op === "||" && this.isConstFalse(arg1)) return arg2;

        if (op === "||" && this.isConstTrue(arg2)) return { kind: "const", value: true, type: "bool" };
        if (op === "||" && this.isConstTrue(arg1)) return { kind: "const", value: true, type: "bool" };

        return null;
    }

    private operandsEqual(op1: TACOperand, op2: TACOperand): boolean {
        if (op1.kind === "var" && op2.kind === "var") return op1.name === op2.name;
        if (op1.kind === "temp" && op2.kind === "temp") return op1.id === op2.id;
        return false;
    }

    private isConstZero(op: TACOperand): boolean {
        return op.kind === "const" && typeof op.value === "number" && op.value === 0;
    }

    private isConstOne(op: TACOperand): boolean {
        return op.kind === "const" && typeof op.value === "number" && op.value === 1;
    }

    private isConstTrue(op: TACOperand): boolean {
        return op.kind === "const" && typeof op.value === "boolean" && op.value === true;
    }

    private isConstFalse(op: TACOperand): boolean {
        return op.kind === "const" && typeof op.value === "boolean" && op.value === false;
    }

    private passBranchSimplification(instructions: TACInstruction[]): [TACInstruction[], boolean] {
        const result: TACInstruction[] = [];
        let changed = false;

        for (const instr of instructions) {
            if (instr.op === "JUMP_IF_FALSE") {
                if (instr.cond.kind === "const") {
                    if (instr.cond.value === false) {
                        result.push({ op: "JUMP", target: instr.target });
                        this.stats.deadCodeRemoved++;
                        changed = true;
                    } else {
                        this.stats.deadCodeRemoved++;
                        changed = true;
                    }
                    continue;
                }
            }

            if (instr.op === "JUMP_IF_TRUE") {
                if (instr.cond.kind === "const") {
                    if (instr.cond.value === true) {
                        result.push({ op: "JUMP", target: instr.target });
                        this.stats.deadCodeRemoved++;
                        changed = true;
                    } else {
                        this.stats.deadCodeRemoved++;
                        changed = true;
                    }
                    continue;
                }
            }

            result.push(instr);
        }

        return [result, changed];
    }

    private passUnreachableCodeElimination(instructions: TACInstruction[]): [TACInstruction[], boolean] {
        const targetLabels = new Set<string>();
        for (const instr of instructions) {
            if (instr.op === "JUMP" || instr.op === "JUMP_IF_FALSE" || instr.op === "JUMP_IF_TRUE") {
                targetLabels.add(instr.target);
            }
        }

        const result: TACInstruction[] = [];
        let isReachable = true;
        let changed = false;

        for (const instr of instructions) {
            if (instr.op === "LABEL") {
                if (isReachable || targetLabels.has(instr.label)) {
                    isReachable = true;
                    result.push(instr);
                } else {
                    this.stats.deadCodeRemoved++;
                    changed = true;
                }
                continue;
            }

            if (!isReachable) {
                this.stats.deadCodeRemoved++;
                changed = true;
                continue;
            }

            result.push(instr);

            if (instr.op === "JUMP") {
                isReachable = false;
            }
        }

        return [result, changed];
    }

    private passDeadJumps(instructions: TACInstruction[]): [TACInstruction[], boolean] {
        const result: TACInstruction[] = [];
        let changed = false;

        for (let i = 0; i < instructions.length; i++) {
            const instr = instructions[i];
            if (instr.op === "JUMP" && i + 1 < instructions.length) {
                const next = instructions[i + 1];
                if (next.op === "LABEL" && next.label === instr.target) {
                    this.stats.deadCodeRemoved++;
                    changed = true;
                    continue;
                }
            }
            result.push(instr);
        }

        return [result, changed];
    }

    private passUnreferencedLabels(instructions: TACInstruction[]): [TACInstruction[], boolean] {
        const targetLabels = new Set<string>();
        for (const instr of instructions) {
            if (instr.op === "JUMP" || instr.op === "JUMP_IF_FALSE" || instr.op === "JUMP_IF_TRUE") {
                targetLabels.add(instr.target);
            }
        }

        const result: TACInstruction[] = [];
        let changed = false;

        for (const instr of instructions) {
            if (instr.op === "LABEL" && !targetLabels.has(instr.label)) {
                this.stats.deadCodeRemoved++;
                changed = true;
                continue;
            }
            result.push(instr);
        }

        return [result, changed];
    }

    private passDeadTemporaryElimination(instructions: TACInstruction[]): [TACInstruction[], boolean] {
        const tempUsage = new Map<string, number>();

        const recordUse = (op: TACOperand) => {
            if (op.kind === "temp") {
                tempUsage.set(op.id, (tempUsage.get(op.id) || 0) + 1);
            }
        };

        for (const instr of instructions) {
            switch (instr.op) {
                case "ASSIGN":
                    recordUse(instr.src);
                    break;
                case "BINOP":
                    recordUse(instr.arg1);
                    recordUse(instr.arg2);
                    break;
                case "UNARYOP":
                    recordUse(instr.arg);
                    break;
                case "PARAM":
                    recordUse(instr.arg);
                    break;
                case "JUMP_IF_FALSE":
                case "JUMP_IF_TRUE":
                    recordUse(instr.cond);
                    break;
            }
        }

        const result: TACInstruction[] = [];
        let changed = false;

        for (const instr of instructions) {
            if (
                (instr.op === "ASSIGN" || instr.op === "BINOP" || instr.op === "UNARYOP") &&
                instr.dst.kind === "temp"
            ) {
                const uses = tempUsage.get(instr.dst.id) || 0;
                if (uses === 0) {
                    this.stats.deadCodeRemoved++;
                    changed = true;
                    continue;
                }
            }
            result.push(instr);
        }

        return [result, changed];
    }
}
