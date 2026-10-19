import type {
    ActionName,
    BinaryOperator,
    BlockNode,
    DataType,
    ExpressionNode,
    IfNode,
    ProgramNode,
    StatementNode,
    UnaryOperator,
} from "./ast.ts";
import type { Token, TokenType } from "./token.ts";

export interface ParseError {
    message: string;
    line: number;
    column: number;
}

export interface ParserResult {
    ast: ProgramNode | null;
    errors: ParseError[];
}

export class Parser {
    private tokens: Token[];
    private current = 0;
    private errors: ParseError[] = [];

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    public parse(): ParserResult {
        this.current = 0;
        this.errors = [];

        try {
            const ast = this.program();
            return {
                ast,
                errors: this.errors,
            };
        } catch {
            return {
                ast: null,
                errors: this.errors,
            };
        }
    }

    private program(): ProgramNode | null {
        if (!this.check("ROBOT")) {
            const tok = this.peek();
            this.error(
                tok,
                `Esperava-se 'robot <Nome>' no início do programa, mas foi encontrado '${tok.lexeme || tok.type}'.`,
            );
            return null;
        }

        const robotToken = this.advance();
        const nameToken = this.consume("IDENTIFIER", "Esperava-se o nome do robô após a palavra-chave 'robot'.");
        const robotName = nameToken ? nameToken.lexeme : "UnknownRobot";

        this.consume("LBRACE", "Esperava-se '{' após o nome do robô.");

        const body: StatementNode[] = [];
        while (!this.check("RBRACE") && !this.isAtEnd()) {
            const stmt = this.declaration();
            if (stmt) {
                body.push(stmt);
            }
        }

        this.consume("RBRACE", "Esperava-se '}' para fechar o corpo do robô.");

        if (!this.isAtEnd()) {
            const extraTok = this.peek();
            this.error(extraTok, `Código inesperado '${extraTok.lexeme}' após o término do bloco do robô.`);
        }

        return {
            kind: "Program",
            robotName,
            body,
            line: robotToken.line,
            column: robotToken.column,
        };
    }

    private declaration(): StatementNode | null {
        try {
            if (this.check("INT") || this.check("FLOAT") || this.check("BOOL")) {
                return this.varDeclaration();
            }
            return this.statement();
        } catch {
            this.synchronize();
            return null;
        }
    }

    private varDeclaration(): StatementNode {
        const typeToken = this.advance();
        let varType: DataType = "int";
        if (typeToken.type === "FLOAT") varType = "float";
        else if (typeToken.type === "BOOL") varType = "bool";

        const nameToken = this.consume(
            "IDENTIFIER",
            `Esperava-se o nome da variável após o tipo '${typeToken.lexeme}'.`,
        );
        const varName = nameToken ? nameToken.lexeme : "<anon>";

        let initializer: ExpressionNode | undefined = undefined;
        if (this.match("ASSIGN")) {
            initializer = this.expression();
        }

        this.consume("SEMICOLON", `Esperava-se ';' após a declaração da variável '${varName}'.`);

        return {
            kind: "VarDecl",
            varType,
            name: varName,
            initializer,
            line: typeToken.line,
            column: typeToken.column,
        };
    }

    private statement(): StatementNode {
        if (this.check("IF")) {
            return this.ifStatement();
        }
        if (this.check("WHILE")) {
            return this.whileStatement();
        }
        if (this.check("LBRACE")) {
            return this.blockStatement();
        }
        if (this.isActionToken(this.peek().type)) {
            return this.actionStatement();
        }
        return this.assignmentStatement();
    }

    private ifStatement(): IfNode {
        const ifToken = this.consume("IF", "Esperava-se 'if'.")!;
        this.consume("LPAREN", "Esperava-se '(' após 'if'.");
        const condition = this.expression();
        this.consume("RPAREN", "Esperava-se ')' após a condição do 'if'.");

        const thenBranch = this.blockStatement();
        let elseBranch: BlockNode | IfNode | undefined = undefined;

        if (this.match("ELSE")) {
            if (this.check("IF")) {
                elseBranch = this.ifStatement();
            } else {
                elseBranch = this.blockStatement();
            }
        }

        return {
            kind: "If",
            condition,
            thenBranch,
            elseBranch,
            line: ifToken.line,
            column: ifToken.column,
        };
    }

    private whileStatement(): StatementNode {
        const whileToken = this.consume("WHILE", "Esperava-se 'while'.")!;
        this.consume("LPAREN", "Esperava-se '(' após 'while'.");
        const condition = this.expression();
        this.consume("RPAREN", "Esperava-se ')' após a condição do 'while'.");

        const body = this.blockStatement();

        return {
            kind: "While",
            condition,
            body,
            line: whileToken.line,
            column: whileToken.column,
        };
    }

    private blockStatement(): BlockNode {
        const lbrace = this.consume("LBRACE", "Esperava-se '{' no início do bloco.")!;
        const statements: StatementNode[] = [];

        while (!this.check("RBRACE") && !this.isAtEnd()) {
            const stmt = this.declaration();
            if (stmt) {
                statements.push(stmt);
            }
        }

        this.consume("RBRACE", "Esperava-se '}' no final do bloco.");

        return {
            kind: "Block",
            statements,
            line: lbrace ? lbrace.line : this.peek().line,
            column: lbrace ? lbrace.column : this.peek().column,
        };
    }

    private actionStatement(): StatementNode {
        const actionToken = this.advance();
        const actionName = this.tokenToActionName(actionToken.type);

        this.consume("LPAREN", `Esperava-se '(' após o comando '${actionToken.lexeme}'.`);

        const args: ExpressionNode[] = [];
        if (!this.check("RPAREN")) {
            do {
                args.push(this.expression());
            } while (this.match("COMMA"));
        }

        this.consume("RPAREN", `Esperava-se ')' após os argumentos do comando '${actionToken.lexeme}'.`);
        this.consume("SEMICOLON", `Esperava-se ';' após a chamada do comando '${actionToken.lexeme}'.`);

        return {
            kind: "Action",
            action: actionName,
            args,
            line: actionToken.line,
            column: actionToken.column,
        };
    }

    private assignmentStatement(): StatementNode {
        const nameToken = this.consume("IDENTIFIER", "Esperava-se nome de variável na atribuição ou comando válido.");
        let target = nameToken ? nameToken.lexeme : "<desconhecido>";

        if (this.match("DOT")) {
            const propToken = this.consume("IDENTIFIER", `Esperava-se propriedade após '${target}.'.`);
            if (propToken) {
                target = `${target}.${propToken.lexeme}`;
            }
        }

        this.consume("ASSIGN", `Esperava-se '=' após a variável '${target}'.`);
        const value = this.expression();
        this.consume("SEMICOLON", `Esperava-se ';' após o valor atribuído a '${target}'.`);

        return {
            kind: "Assign",
            target,
            value,
            line: nameToken ? nameToken.line : this.peek().line,
            column: nameToken ? nameToken.column : this.peek().column,
        };
    }

    private expression(): ExpressionNode {
        return this.logicOr();
    }

    private logicOr(): ExpressionNode {
        let expr = this.logicAnd();

        while (this.match("OR")) {
            const opToken = this.previous();
            const right = this.logicAnd();
            expr = {
                kind: "BinaryOp",
                operator: "||",
                left: expr,
                right,
                line: opToken.line,
                column: opToken.column,
            };
        }

        return expr;
    }

    private logicAnd(): ExpressionNode {
        let expr = this.equality();

        while (this.match("AND")) {
            const opToken = this.previous();
            const right = this.equality();
            expr = {
                kind: "BinaryOp",
                operator: "&&",
                left: expr,
                right,
                line: opToken.line,
                column: opToken.column,
            };
        }

        return expr;
    }

    private equality(): ExpressionNode {
        let expr = this.comparison();

        while (this.match("EQ", "NEQ")) {
            const opToken = this.previous();
            const operator: BinaryOperator = opToken.type === "EQ" ? "==" : "!=";
            const right = this.comparison();
            expr = {
                kind: "BinaryOp",
                operator,
                left: expr,
                right,
                line: opToken.line,
                column: opToken.column,
            };
        }

        return expr;
    }

    private comparison(): ExpressionNode {
        let expr = this.term();

        while (this.match("LT", "LTE", "GT", "GTE")) {
            const opToken = this.previous();
            let operator: BinaryOperator = "<";
            if (opToken.type === "LTE") operator = "<=";
            else if (opToken.type === "GT") operator = ">";
            else if (opToken.type === "GTE") operator = ">=";

            const right = this.term();
            expr = {
                kind: "BinaryOp",
                operator,
                left: expr,
                right,
                line: opToken.line,
                column: opToken.column,
            };
        }

        return expr;
    }

    private term(): ExpressionNode {
        let expr = this.factor();

        while (this.match("PLUS", "MINUS")) {
            const opToken = this.previous();
            const operator: BinaryOperator = opToken.type === "PLUS" ? "+" : "-";
            const right = this.factor();
            expr = {
                kind: "BinaryOp",
                operator,
                left: expr,
                right,
                line: opToken.line,
                column: opToken.column,
            };
        }

        return expr;
    }

    private factor(): ExpressionNode {
        let expr = this.unary();

        while (this.match("STAR", "SLASH", "PERCENT")) {
            const opToken = this.previous();
            let operator: BinaryOperator = "*";
            if (opToken.type === "SLASH") operator = "/";
            else if (opToken.type === "PERCENT") operator = "%";

            const right = this.unary();
            expr = {
                kind: "BinaryOp",
                operator,
                left: expr,
                right,
                line: opToken.line,
                column: opToken.column,
            };
        }

        return expr;
    }

    private unary(): ExpressionNode {
        if (this.match("NOT", "MINUS", "PLUS")) {
            const opToken = this.previous();
            let operator: UnaryOperator = "!";
            if (opToken.type === "MINUS") operator = "-";
            else if (opToken.type === "PLUS") operator = "+";

            const operand = this.unary();
            return {
                kind: "UnaryOp",
                operator,
                operand,
                line: opToken.line,
                column: opToken.column,
            };
        }

        return this.primary();
    }

    private primary(): ExpressionNode {
        if (this.match("FALSE")) {
            const tok = this.previous();
            return {
                kind: "Literal",
                value: false,
                literalType: "bool",
                line: tok.line,
                column: tok.column,
            };
        }

        if (this.match("TRUE")) {
            const tok = this.previous();
            return {
                kind: "Literal",
                value: true,
                literalType: "bool",
                line: tok.line,
                column: tok.column,
            };
        }

        if (this.match("INT_LITERAL")) {
            const tok = this.previous();
            return {
                kind: "Literal",
                value: tok.literal as number,
                literalType: "int",
                line: tok.line,
                column: tok.column,
            };
        }

        if (this.match("FLOAT_LITERAL")) {
            const tok = this.previous();
            return {
                kind: "Literal",
                value: tok.literal as number,
                literalType: "float",
                line: tok.line,
                column: tok.column,
            };
        }

        if (this.match("IDENTIFIER")) {
            const idToken = this.previous();

            if (this.match("DOT")) {
                const propToken = this.consume(
                    "IDENTIFIER",
                    `Esperava-se propriedade do sensor após '${idToken.lexeme}.'.`,
                );
                const propName = propToken ? propToken.lexeme : "";
                return {
                    kind: "SensorAccess",
                    sensor: idToken.lexeme,
                    property: propName,
                    fullName: `${idToken.lexeme}.${propName}`,
                    line: idToken.line,
                    column: idToken.column,
                };
            }

            if (idToken.lexeme === "energy") {
                return {
                    kind: "SensorAccess",
                    sensor: "energy",
                    fullName: "energy",
                    line: idToken.line,
                    column: idToken.column,
                };
            }

            return {
                kind: "Identifier",
                name: idToken.lexeme,
                line: idToken.line,
                column: idToken.column,
            };
        }

        if (this.match("LPAREN")) {
            const expr = this.expression();
            this.consume("RPAREN", "Esperava-se ')' após a expressão.");
            return expr;
        }

        const tok = this.peek();
        this.error(tok, `Expressão esperada, mas foi encontrado '${tok.lexeme || tok.type}'.`);
        throw new Error("ParseError");
    }

    private isActionToken(type: TokenType): boolean {
        return (
            type === "ACTION_MOVE" ||
            type === "ACTION_BACK" ||
            type === "ACTION_ROTATE" ||
            type === "ACTION_SCAN" ||
            type === "ACTION_FIRE"
        );
    }

    private tokenToActionName(type: TokenType): ActionName {
        switch (type) {
            case "ACTION_MOVE":
                return "move";
            case "ACTION_BACK":
                return "back";
            case "ACTION_ROTATE":
                return "rotate";
            case "ACTION_SCAN":
                return "scan";
            case "ACTION_FIRE":
                return "fire";
            default:
                return "scan";
        }
    }

    private match(...types: TokenType[]): boolean {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    private check(type: TokenType): boolean {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }

    private advance(): Token {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }

    private isAtEnd(): boolean {
        return this.peek().type === "EOF";
    }

    private peek(): Token {
        return this.tokens[this.current];
    }

    private previous(): Token {
        return this.tokens[this.current - 1];
    }

    private consume(type: TokenType, message: string): Token | null {
        if (this.check(type)) return this.advance();
        this.error(this.peek(), message);
        return null;
    }

    private error(token: Token, message: string): void {
        this.errors.push({
            message: `${message} (Linha ${token.line}, Coluna ${token.column})`,
            line: token.line,
            column: token.column,
        });
    }

    private synchronize(): void {
        this.advance();

        while (!this.isAtEnd()) {
            if (this.previous().type === "SEMICOLON") return;

            switch (this.peek().type) {
                case "INT":
                case "FLOAT":
                case "BOOL":
                case "IF":
                case "WHILE":
                case "ACTION_MOVE":
                case "ACTION_BACK":
                case "ACTION_ROTATE":
                case "ACTION_SCAN":
                case "ACTION_FIRE":
                case "RBRACE":
                    return;
            }

            this.advance();
        }
    }
}
