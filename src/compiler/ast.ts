export type DataType = "int" | "float" | "bool" | "void";

export type ActionName = "move" | "back" | "rotate" | "scan" | "fire";

export type BinaryOperator = "+" | "-" | "*" | "/" | "%" | "<" | "<=" | ">" | ">=" | "==" | "!=" | "&&" | "||";

export type UnaryOperator = "-" | "+" | "!";

export interface ASTNodeBase {
    kind: string;
    line: number;
    column: number;
}

export interface ProgramNode extends ASTNodeBase {
    kind: "Program";
    robotName: string;
    body: StatementNode[];
}

export type StatementNode = VarDeclNode | AssignNode | IfNode | WhileNode | BlockNode | ActionNode;

export interface VarDeclNode extends ASTNodeBase {
    kind: "VarDecl";
    varType: DataType;
    name: string;
    scopedName?: string;
    initializer?: ExpressionNode;
}

export interface AssignNode extends ASTNodeBase {
    kind: "Assign";
    target: string;
    scopedTarget?: string;
    value: ExpressionNode;
}

export interface IfNode extends ASTNodeBase {
    kind: "If";
    condition: ExpressionNode;
    thenBranch: BlockNode;
    elseBranch?: BlockNode | IfNode;
}

export interface WhileNode extends ASTNodeBase {
    kind: "While";
    condition: ExpressionNode;
    body: BlockNode;
}

export interface BlockNode extends ASTNodeBase {
    kind: "Block";
    statements: StatementNode[];
}

export interface ActionNode extends ASTNodeBase {
    kind: "Action";
    action: ActionName;
    args: ExpressionNode[];
}

export type ExpressionNode = LiteralNode | IdentifierNode | SensorAccessNode | BinaryOpNode | UnaryOpNode;

export interface LiteralNode extends ASTNodeBase {
    kind: "Literal";
    value: number | boolean;
    literalType: DataType;
}

export interface IdentifierNode extends ASTNodeBase {
    kind: "Identifier";
    name: string;
    scopedName?: string;
}

export interface SensorAccessNode extends ASTNodeBase {
    kind: "SensorAccess";
    sensor: string;
    property?: string;
    fullName: string;
}

export interface BinaryOpNode extends ASTNodeBase {
    kind: "BinaryOp";
    operator: BinaryOperator;
    left: ExpressionNode;
    right: ExpressionNode;
}

export interface UnaryOpNode extends ASTNodeBase {
    kind: "UnaryOp";
    operator: UnaryOperator;
    operand: ExpressionNode;
}
