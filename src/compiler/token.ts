export type TokenType =
    | "ROBOT"
    | "INT"
    | "FLOAT"
    | "BOOL"
    | "IF"
    | "ELSE"
    | "WHILE"
    | "TRUE"
    | "FALSE"
    | "ACTION_MOVE"
    | "ACTION_BACK"
    | "ACTION_ROTATE"
    | "ACTION_SCAN"
    | "ACTION_FIRE"
    | "IDENTIFIER"
    | "INT_LITERAL"
    | "FLOAT_LITERAL"
    | "PLUS"
    | "MINUS"
    | "STAR"
    | "SLASH"
    | "PERCENT"
    | "ASSIGN"
    | "EQ"
    | "NEQ"
    | "LT"
    | "LTE"
    | "GT"
    | "GTE"
    | "AND"
    | "OR"
    | "NOT"
    | "LPAREN"
    | "RPAREN"
    | "LBRACE"
    | "RBRACE"
    | "SEMICOLON"
    | "COMMA"
    | "DOT"
    | "EOF";

export interface SourceLocation {
    line: number;
    column: number;
}

export interface Token {
    type: TokenType;
    lexeme: string;
    literal?: number | boolean | string;
    line: number;
    column: number;
}

export const KEYWORDS: Record<string, TokenType> = {
    robot: "ROBOT",
    int: "INT",
    float: "FLOAT",
    bool: "BOOL",
    if: "IF",
    else: "ELSE",
    while: "WHILE",
    true: "TRUE",
    false: "FALSE",
    move: "ACTION_MOVE",
    back: "ACTION_BACK",
    rotate: "ACTION_ROTATE",
    scan: "ACTION_SCAN",
    fire: "ACTION_FIRE",
};
