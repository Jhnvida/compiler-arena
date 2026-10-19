import type {
    ActionNode,
    AssignNode,
    BinaryOperator,
    BlockNode,
    DataType,
    ExpressionNode,
    IfNode,
    ProgramNode,
    StatementNode,
    VarDeclNode,
    WhileNode,
} from "./ast.ts";

export type TACOperand =
    | { kind: "const"; value: number | boolean; type: DataType }
    | { kind: "var"; name: string }
    | { kind: "temp"; id: string }
    | { kind: "sensor"; name: string };

export type TACInstruction =
    | { op: "ASSIGN"; dst: TACOperand; src: TACOperand }
    | { op: "BINOP"; dst: TACOperand; operator: BinaryOperator; arg1: TACOperand; arg2: TACOperand }
    | { op: "UNARYOP"; dst: TACOperand; operator: "-" | "+" | "!"; arg: TACOperand }
    | { op: "READ_SENSOR"; dst: TACOperand; sensor: string }
    | { op: "PARAM"; arg: TACOperand }
    | { op: "ACTION"; name: string; argCount: number }
    | { op: "LABEL"; label: string }
    | { op: "JUMP"; target: string }
    | { op: "JUMP_IF_FALSE"; cond: TACOperand; target: string }
    | { op: "JUMP_IF_TRUE"; cond: TACOperand; target: string };

export class IRGenerator {
    private instructions: TACInstruction[] = [];
    private tempCounter = 0;
    private labelCounter = 0;

    public generate(program: ProgramNode): TACInstruction[] {
        this.instructions = [];
        this.tempCounter = 0;
        this.labelCounter = 0;

        for (const stmt of program.body) {
            this.generateStatement(stmt);
        }

        return this.instructions;
    }

    private nextTemp(): TACOperand {
        const id = `t${this.tempCounter++}`;
        return { kind: "temp", id };
    }

    private nextLabel(prefix = "L"): string {
        return `${prefix}${this.labelCounter++}`;
    }

    private emit(instr: TACInstruction): void {
        this.instructions.push(instr);
    }

    private generateStatement(stmt: StatementNode): void {
        switch (stmt.kind) {
            case "VarDecl":
                this.generateVarDecl(stmt);
                break;
            case "Assign":
                this.generateAssign(stmt);
                break;
            case "If":
                this.generateIf(stmt);
                break;
            case "While":
                this.generateWhile(stmt);
                break;
            case "Block":
                this.generateBlock(stmt);
                break;
            case "Action":
                this.generateAction(stmt);
                break;
        }
    }

    private generateVarDecl(node: VarDeclNode): void {
        if (node.initializer) {
            const src = this.generateExpression(node.initializer);
            const varName = node.scopedName ?? node.name;
            this.emit({
                op: "ASSIGN",
                dst: { kind: "var", name: varName },
                src,
            });
        }
    }

    private generateAssign(node: AssignNode): void {
        const src = this.generateExpression(node.value);
        const varName = node.scopedTarget ?? node.target;
        this.emit({
            op: "ASSIGN",
            dst: { kind: "var", name: varName },
            src,
        });
    }

    private generateIf(node: IfNode): void {
        const cond = this.generateExpression(node.condition);
        const elseLabel = this.nextLabel("L_else");
        const endLabel = this.nextLabel("L_endif");

        this.emit({
            op: "JUMP_IF_FALSE",
            cond,
            target: node.elseBranch ? elseLabel : endLabel,
        });

        this.generateBlock(node.thenBranch);

        if (node.elseBranch) {
            this.emit({ op: "JUMP", target: endLabel });
            this.emit({ op: "LABEL", label: elseLabel });

            if (node.elseBranch.kind === "If") {
                this.generateIf(node.elseBranch);
            } else {
                this.generateBlock(node.elseBranch);
            }
        }

        this.emit({ op: "LABEL", label: endLabel });
    }

    private generateWhile(node: WhileNode): void {
        const startLabel = this.nextLabel("L_while_start");
        const endLabel = this.nextLabel("L_while_end");

        this.emit({ op: "LABEL", label: startLabel });
        const cond = this.generateExpression(node.condition);

        this.emit({
            op: "JUMP_IF_FALSE",
            cond,
            target: endLabel,
        });

        this.generateBlock(node.body);

        this.emit({ op: "JUMP", target: startLabel });
        this.emit({ op: "LABEL", label: endLabel });
    }

    private generateBlock(node: BlockNode): void {
        for (const stmt of node.statements) {
            this.generateStatement(stmt);
        }
    }

    private generateAction(node: ActionNode): void {
        const argOperands: TACOperand[] = [];
        for (const arg of node.args) {
            argOperands.push(this.generateExpression(arg));
        }

        for (const argOp of argOperands) {
            this.emit({ op: "PARAM", arg: argOp });
        }

        this.emit({
            op: "ACTION",
            name: node.action,
            argCount: node.args.length,
        });
    }

    private generateExpression(expr: ExpressionNode): TACOperand {
        switch (expr.kind) {
            case "Literal":
                return {
                    kind: "const",
                    value: expr.value,
                    type: expr.literalType,
                };

            case "Identifier":
                return { kind: "var", name: expr.scopedName ?? expr.name };

            case "SensorAccess": {
                const dst = this.nextTemp();
                this.emit({
                    op: "READ_SENSOR",
                    dst,
                    sensor: expr.fullName,
                });
                return dst;
            }

            case "BinaryOp": {
                const arg1 = this.generateExpression(expr.left);
                const arg2 = this.generateExpression(expr.right);
                const dst = this.nextTemp();
                this.emit({
                    op: "BINOP",
                    dst,
                    operator: expr.operator,
                    arg1,
                    arg2,
                });
                return dst;
            }

            case "UnaryOp": {
                const arg = this.generateExpression(expr.operand);
                const dst = this.nextTemp();
                this.emit({
                    op: "UNARYOP",
                    dst,
                    operator: expr.operator,
                    arg,
                });
                return dst;
            }
        }
    }
}

export function formatOperand(op: TACOperand): string {
    switch (op.kind) {
        case "const":
            return typeof op.value === "boolean" ? (op.value ? "true" : "false") : `${op.value}`;
        case "var":
            return op.name;
        case "temp":
            return op.id;
        case "sensor":
            return op.name;
    }
}

export function formatTAC(instructions: TACInstruction[]): string {
    const lines: string[] = [];

    for (const instr of instructions) {
        switch (instr.op) {
            case "LABEL":
                lines.push(`${instr.label}:`);
                break;
            case "ASSIGN":
                lines.push(`  ${formatOperand(instr.dst)} = ${formatOperand(instr.src)}`);
                break;
            case "BINOP":
                lines.push(
                    `  ${formatOperand(instr.dst)} = ${formatOperand(instr.arg1)} ${instr.operator} ${formatOperand(instr.arg2)}`,
                );
                break;
            case "UNARYOP":
                lines.push(`  ${formatOperand(instr.dst)} = ${instr.operator}${formatOperand(instr.arg)}`);
                break;
            case "READ_SENSOR":
                lines.push(`  ${formatOperand(instr.dst)} = READ_SENSOR(${instr.sensor})`);
                break;
            case "PARAM":
                lines.push(`  PARAM ${formatOperand(instr.arg)}`);
                break;
            case "ACTION":
                lines.push(`  CALL_ACTION ${instr.name}, ${instr.argCount}`);
                break;
            case "JUMP":
                lines.push(`  GOTO ${instr.target}`);
                break;
            case "JUMP_IF_FALSE":
                lines.push(`  IF_FALSE ${formatOperand(instr.cond)} GOTO ${instr.target}`);
                break;
            case "JUMP_IF_TRUE":
                lines.push(`  IF_TRUE ${formatOperand(instr.cond)} GOTO ${instr.target}`);
                break;
        }
    }

    return lines.join("\n");
}
