import type {
    ActionNode,
    AssignNode,
    BinaryOpNode,
    BlockNode,
    DataType,
    ExpressionNode,
    IfNode,
    ProgramNode,
    StatementNode,
    UnaryOpNode,
    VarDeclNode,
    WhileNode,
} from "./ast.ts";
import { SymbolTable, resetScopeCounter } from "./symbols.ts";

export interface SemanticError {
    message: string;
    line: number;
    column: number;
}

export interface SemanticResult {
    success: boolean;
    errors: SemanticError[];
    symbolTable: SymbolTable;
    nodeTypes: Map<ExpressionNode, DataType>;
}

export const SENSOR_TYPES: Record<string, DataType> = {
    energy: "float",
    "position.x": "float",
    "position.y": "float",
    "enemy.visible": "bool",
    "enemy.distance": "float",
    "enemy.direction": "float",
};

const VALID_SENSOR_ROOTS = new Set(["energy", "position", "enemy"]);

export class SemanticAnalyzer {
    private currentScope: SymbolTable;
    private errors: SemanticError[] = [];
    private nodeTypes = new Map<ExpressionNode, DataType>();

    constructor() {
        this.currentScope = new SymbolTable();
    }

    public analyze(program: ProgramNode): SemanticResult {
        resetScopeCounter();
        this.currentScope = new SymbolTable();
        this.errors = [];
        this.nodeTypes.clear();

        for (const stmt of program.body) {
            this.analyzeStatement(stmt);
        }

        return {
            success: this.errors.length === 0,
            errors: this.errors,
            symbolTable: this.currentScope,
            nodeTypes: this.nodeTypes,
        };
    }

    private analyzeStatement(stmt: StatementNode): void {
        switch (stmt.kind) {
            case "VarDecl":
                this.analyzeVarDecl(stmt);
                break;
            case "Assign":
                this.analyzeAssign(stmt);
                break;
            case "If":
                this.analyzeIf(stmt);
                break;
            case "While":
                this.analyzeWhile(stmt);
                break;
            case "Block":
                this.analyzeBlock(stmt);
                break;
            case "Action":
                this.analyzeAction(stmt);
                break;
        }
    }

    private analyzeVarDecl(node: VarDeclNode): void {
        if (VALID_SENSOR_ROOTS.has(node.name) || node.name in SENSOR_TYPES) {
            this.error(
                `Nome de variável inválido: '${node.name}' é um sensor embutido reservado.`,
                node.line,
                node.column,
            );
            return;
        }

        const defined = this.currentScope.define({
            name: node.name,
            type: node.varType,
            line: node.line,
            column: node.column,
            isInitialized: node.initializer !== undefined,
        });

        if (!defined) {
            this.error(`Variável '${node.name}' já declarada no escopo atual.`, node.line, node.column);
            return;
        }

        const symbol = this.currentScope.lookupCurrentScope(node.name);
        if (symbol) {
            node.scopedName = symbol.uniqueName;
        }

        if (node.initializer) {
            const initType = this.analyzeExpression(node.initializer);
            if (initType !== "void") {
                if (!this.isAssignable(node.varType, initType)) {
                    this.error(
                        `Incompatibilidade de tipos: não é possível atribuir expressão do tipo '${initType}' à variável '${node.name}' do tipo '${node.varType}'.`,
                        node.initializer.line,
                        node.initializer.column,
                    );
                }
            }
        }
    }

    private analyzeAssign(node: AssignNode): void {
        const root = node.target.split(".")[0];
        if (VALID_SENSOR_ROOTS.has(root) || node.target in SENSOR_TYPES) {
            this.error(
                `Tentativa de modificação de sensor '${node.target}'. Sensores da arena são de apenas leitura.`,
                node.line,
                node.column,
            );
            return;
        }

        const symbol = this.currentScope.lookup(node.target);
        if (!symbol) {
            this.error(
                `Variável '${node.target}' utilizada antes de ser declarada ou inexistente.`,
                node.line,
                node.column,
            );
            this.analyzeExpression(node.value);
            return;
        }

        node.scopedTarget = symbol.uniqueName;

        const valueType = this.analyzeExpression(node.value);
        if (valueType !== "void" && !this.isAssignable(symbol.type, valueType)) {
            this.error(
                `Incompatibilidade de tipos: não é possível atribuir expressão do tipo '${valueType}' à variável '${node.target}' do tipo '${symbol.type}'.`,
                node.value.line,
                node.value.column,
            );
        } else {
            symbol.isInitialized = true;
        }
    }

    private analyzeIf(node: IfNode): void {
        const condType = this.analyzeExpression(node.condition);
        if (condType !== "void" && condType !== "bool") {
            this.error(
                `Condição da estrutura 'if' deve ser do tipo 'bool', mas recebeu '${condType}'.`,
                node.condition.line,
                node.condition.column,
            );
        }

        this.analyzeBlock(node.thenBranch);

        if (node.elseBranch) {
            if (node.elseBranch.kind === "If") {
                this.analyzeIf(node.elseBranch);
            } else {
                this.analyzeBlock(node.elseBranch);
            }
        }
    }

    private analyzeWhile(node: WhileNode): void {
        const condType = this.analyzeExpression(node.condition);
        if (condType !== "void" && condType !== "bool") {
            this.error(
                `Condição da estrutura 'while' deve ser do tipo 'bool', mas recebeu '${condType}'.`,
                node.condition.line,
                node.condition.column,
            );
        }

        this.analyzeBlock(node.body);
    }

    private analyzeBlock(node: BlockNode): void {
        const previousScope = this.currentScope;
        this.currentScope = new SymbolTable(previousScope, previousScope.scopeLevel + 1);

        for (const stmt of node.statements) {
            this.analyzeStatement(stmt);
        }

        this.currentScope = previousScope;
    }

    private analyzeAction(node: ActionNode): void {
        switch (node.action) {
            case "scan": {
                if (node.args.length !== 0) {
                    this.error(
                        `Comando 'scan()' não aceita argumentos, mas recebeu ${node.args.length}.`,
                        node.line,
                        node.column,
                    );
                }
                break;
            }
            case "move":
            case "back":
            case "rotate": {
                if (node.args.length !== 1) {
                    this.error(
                        `Comando '${node.action}()' espera exatamente 1 argumento, mas recebeu ${node.args.length}.`,
                        node.line,
                        node.column,
                    );
                    return;
                }
                const argType = this.analyzeExpression(node.args[0]);
                if (argType !== "void" && argType !== "int" && argType !== "float") {
                    this.error(
                        `Comando '${node.action}()' espera argumento numérico (int ou float), mas recebeu '${argType}'.`,
                        node.args[0].line,
                        node.args[0].column,
                    );
                }
                break;
            }
            case "fire": {
                if (node.args.length !== 1) {
                    this.error(
                        `Comando 'fire()' espera exatamente 1 argumento (potência de 1 a 3), mas recebeu ${node.args.length}.`,
                        node.line,
                        node.column,
                    );
                    return;
                }
                const arg = node.args[0];
                const argType = this.analyzeExpression(arg);
                if (argType !== "void" && argType !== "int" && argType !== "float") {
                    this.error(
                        `Comando 'fire()' espera argumento numérico (potência entre 1 e 3), mas recebeu '${argType}'.`,
                        arg.line,
                        arg.column,
                    );
                    return;
                }

                const power = this.getConstantNumericValue(arg);
                if (power !== null) {
                    if (power < 1 || power > 3 || !Number.isInteger(power)) {
                        this.error(
                            `Potência de tiro inválida: deve ser entre 1 e 3 (recebido: ${power}).`,
                            arg.line,
                            arg.column,
                        );
                    }
                }
                break;
            }
        }
    }

    private getConstantNumericValue(expr: ExpressionNode): number | null {
        if (expr.kind === "Literal" && typeof expr.value === "number") {
            return expr.value;
        }
        if (expr.kind === "UnaryOp") {
            const inner = this.getConstantNumericValue(expr.operand);
            if (inner !== null) {
                if (expr.operator === "-") return -inner;
                if (expr.operator === "+") return +inner;
            }
        }
        return null;
    }

    private analyzeExpression(expr: ExpressionNode): DataType {
        const type = this.computeExpressionType(expr);
        this.nodeTypes.set(expr, type);
        return type;
    }

    private computeExpressionType(expr: ExpressionNode): DataType {
        switch (expr.kind) {
            case "Literal":
                return expr.literalType;

            case "Identifier": {
                const symbol = this.currentScope.lookup(expr.name);
                if (!symbol) {
                    if (expr.name === "energy") {
                        return "float";
                    }
                    if (expr.name === "enemy" || expr.name === "position") {
                        this.error(
                            `Sensor '${expr.name}' requer propriedade (ex: ${expr.name === "enemy" ? "enemy.visible, enemy.distance" : "position.x, position.y"}).`,
                            expr.line,
                            expr.column,
                        );
                        return "void";
                    }
                    this.error(
                        `Variável '${expr.name}' utilizada antes de ser declarada ou inexistente.`,
                        expr.line,
                        expr.column,
                    );
                    return "void";
                }
                expr.scopedName = symbol.uniqueName;
                return symbol.type;
            }

            case "SensorAccess": {
                const sensorType = SENSOR_TYPES[expr.fullName];
                if (!sensorType) {
                    this.error(
                        `Sensor ou propriedade desconhecida: '${expr.fullName}'. Sensores válidos: energy, position.x, position.y, enemy.visible, enemy.distance, enemy.direction.`,
                        expr.line,
                        expr.column,
                    );
                    return "void";
                }
                return sensorType;
            }

            case "BinaryOp":
                return this.analyzeBinaryOp(expr);

            case "UnaryOp":
                return this.analyzeUnaryOp(expr);
        }
    }

    private analyzeBinaryOp(node: BinaryOpNode): DataType {
        const leftType = this.analyzeExpression(node.left);
        const rightType = this.analyzeExpression(node.right);

        if (leftType === "void" || rightType === "void") {
            return "void";
        }

        const op = node.operator;

        if (op === "+" || op === "-" || op === "*" || op === "/" || op === "%") {
            if (!this.isNumeric(leftType) || !this.isNumeric(rightType)) {
                this.error(
                    `Operador aritmético '${op}' incompatível com tipos '${leftType}' e '${rightType}'. Esperava operandos numéricos.`,
                    node.line,
                    node.column,
                );
                return "void";
            }
            if (op === "%") {
                if (leftType !== "int" || rightType !== "int") {
                    this.error(
                        `Operador de módulo '%' requer operandos inteiros ('int'), mas recebeu '${leftType}' e '${rightType}'.`,
                        node.line,
                        node.column,
                    );
                }
                return "int";
            }
            if (leftType === "float" || rightType === "float" || op === "/") {
                return leftType === "float" || rightType === "float" ? "float" : "int";
            }
            return "int";
        }

        if (op === "<" || op === "<=" || op === ">" || op === ">=") {
            if (!this.isNumeric(leftType) || !this.isNumeric(rightType)) {
                this.error(
                    `Operador relacional '${op}' requer operandos numéricos, mas recebeu '${leftType}' e '${rightType}'.`,
                    node.line,
                    node.column,
                );
                return "bool";
            }
            return "bool";
        }

        if (op === "==" || op === "!=") {
            if (
                (this.isNumeric(leftType) && this.isNumeric(rightType)) ||
                (leftType === "bool" && rightType === "bool")
            ) {
                return "bool";
            }
            this.error(
                `Operador de igualdade '${op}' incompatível entre '${leftType}' e '${rightType}'.`,
                node.line,
                node.column,
            );
            return "bool";
        }

        if (op === "&&" || op === "||") {
            if (leftType !== "bool" || rightType !== "bool") {
                this.error(
                    `Operador lógico '${op}' requer operandos booleanos ('bool'), mas recebeu '${leftType}' e '${rightType}'.`,
                    node.line,
                    node.column,
                );
            }
            return "bool";
        }

        return "void";
    }

    private analyzeUnaryOp(node: UnaryOpNode): DataType {
        const operandType = this.analyzeExpression(node.operand);
        if (operandType === "void") return "void";

        if (node.operator === "!") {
            if (operandType !== "bool") {
                this.error(
                    `Operador de negação lógica '!' requer operando booleano, mas recebeu '${operandType}'.`,
                    node.line,
                    node.column,
                );
            }
            return "bool";
        }

        if (node.operator === "-" || node.operator === "+") {
            if (!this.isNumeric(operandType)) {
                this.error(
                    `Operador unário '${node.operator}' requer operando numérico, mas recebeu '${operandType}'.`,
                    node.line,
                    node.column,
                );
                return "void";
            }
            return operandType;
        }

        return "void";
    }

    private isNumeric(type: DataType): boolean {
        return type === "int" || type === "float";
    }

    private isAssignable(targetType: DataType, sourceType: DataType): boolean {
        if (targetType === sourceType) return true;
        if (this.isNumeric(targetType) && this.isNumeric(sourceType)) return true;
        return false;
    }

    private error(message: string, line: number, column: number): void {
        this.errors.push({
            message: `${message} (Linha ${line}, Coluna ${column})`,
            line,
            column,
        });
    }
}
