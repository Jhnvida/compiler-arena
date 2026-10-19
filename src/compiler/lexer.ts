import type { Token, TokenType } from "./token.ts";
import { KEYWORDS } from "./token.ts";

export interface LexicalError {
    message: string;
    line: number;
    column: number;
}

export interface LexerResult {
    tokens: Token[];
    errors: LexicalError[];
}

export class Lexer {
    private source: string;
    private tokens: Token[] = [];
    private errors: LexicalError[] = [];
    private start = 0;
    private current = 0;
    private line = 1;
    private column = 1;
    private startColumn = 1;

    constructor(source: string) {
        this.source = source;
    }

    public tokenize(): LexerResult {
        this.tokens = [];
        this.errors = [];
        this.start = 0;
        this.current = 0;
        this.line = 1;
        this.column = 1;
        this.startColumn = 1;

        while (!this.isAtEnd()) {
            this.start = this.current;
            this.startColumn = this.column;
            this.scanToken();
        }

        this.tokens.push({
            type: "EOF",
            lexeme: "",
            line: this.line,
            column: this.column,
        });

        return {
            tokens: this.tokens,
            errors: this.errors,
        };
    }

    private scanToken(): void {
        const c = this.advance();

        switch (c) {
            case " ":
            case "\r":
            case "\t":
                break;

            case "\n":
                this.line++;
                this.column = 1;
                break;

            case "(":
                this.addToken("LPAREN");
                break;
            case ")":
                this.addToken("RPAREN");
                break;
            case "{":
                this.addToken("LBRACE");
                break;
            case "}":
                this.addToken("RBRACE");
                break;
            case ";":
                this.addToken("SEMICOLON");
                break;
            case ",":
                this.addToken("COMMA");
                break;
            case ".":
                this.addToken("DOT");
                break;
            case "+":
                this.addToken("PLUS");
                break;
            case "-":
                this.addToken("MINUS");
                break;
            case "*":
                this.addToken("STAR");
                break;
            case "%":
                this.addToken("PERCENT");
                break;

            case "/":
                if (this.match("/")) {
                    while (this.peek() !== "\n" && !this.isAtEnd()) {
                        this.advance();
                    }
                } else if (this.match("*")) {
                    this.multiLineComment();
                } else {
                    this.addToken("SLASH");
                }
                break;

            case "=":
                this.addToken(this.match("=") ? "EQ" : "ASSIGN");
                break;

            case "!":
                this.addToken(this.match("=") ? "NEQ" : "NOT");
                break;

            case "<":
                this.addToken(this.match("=") ? "LTE" : "LT");
                break;

            case ">":
                this.addToken(this.match("=") ? "GTE" : "GT");
                break;

            case "&":
                if (this.match("&")) {
                    this.addToken("AND");
                } else {
                    this.error(`Caractere inesperado '&'. Esperava-se '&&' para operador lógico E.`);
                }
                break;

            case "|":
                if (this.match("|")) {
                    this.addToken("OR");
                } else {
                    this.error(`Caractere inesperado '|'. Esperava-se '||' para operador lógico OU.`);
                }
                break;

            default:
                if (this.isDigit(c)) {
                    this.number();
                } else if (this.isAlpha(c)) {
                    this.identifier();
                } else {
                    this.error(`Caractere desconhecido ou inválido '${c}'.`);
                }
                break;
        }
    }

    private multiLineComment(): void {
        const startLine = this.line;
        const startCol = this.startColumn;

        while (!this.isAtEnd()) {
            if (this.peek() === "*" && this.peekNext() === "/") {
                this.advance();
                this.advance();
                return;
            }
            if (this.peek() === "\n") {
                this.line++;
                this.column = 0;
            }
            this.advance();
        }

        this.errors.push({
            message: `Comentário de múltiplas linhas não finalizado (iniciado na Linha ${startLine}, Coluna ${startCol}).`,
            line: startLine,
            column: startCol,
        });
    }

    private number(): void {
        while (this.isDigit(this.peek())) {
            this.advance();
        }

        let isFloat = false;
        if (this.peek() === "." && this.isDigit(this.peekNext())) {
            isFloat = true;
            this.advance();

            while (this.isDigit(this.peek())) {
                this.advance();
            }
        }

        const valueStr = this.source.substring(this.start, this.current);
        if (isFloat) {
            this.addToken("FLOAT_LITERAL", parseFloat(valueStr));
        } else {
            this.addToken("INT_LITERAL", parseInt(valueStr, 10));
        }
    }

    private identifier(): void {
        while (this.isAlphaNumeric(this.peek())) {
            this.advance();
        }

        const text = this.source.substring(this.start, this.current);
        const keywordType = KEYWORDS[text];

        if (keywordType === "TRUE") {
            this.addToken("TRUE", true);
        } else if (keywordType === "FALSE") {
            this.addToken("FALSE", false);
        } else if (keywordType) {
            this.addToken(keywordType);
        } else {
            this.addToken("IDENTIFIER", text);
        }
    }

    private isDigit(c: string): boolean {
        return c >= "0" && c <= "9";
    }

    private isAlpha(c: string): boolean {
        return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
    }

    private isAlphaNumeric(c: string): boolean {
        return this.isAlpha(c) || this.isDigit(c);
    }

    private advance(): string {
        const c = this.source.charAt(this.current);
        this.current++;
        this.column++;
        return c;
    }

    private match(expected: string): boolean {
        if (this.isAtEnd()) return false;
        if (this.source.charAt(this.current) !== expected) return false;

        this.current++;
        this.column++;
        return true;
    }

    private peek(): string {
        if (this.isAtEnd()) return "\0";
        return this.source.charAt(this.current);
    }

    private peekNext(): string {
        if (this.current + 1 >= this.source.length) return "\0";
        return this.source.charAt(this.current + 1);
    }

    private isAtEnd(): boolean {
        return this.current >= this.source.length;
    }

    private addToken(type: TokenType, literal?: number | boolean | string): void {
        const lexeme = this.source.substring(this.start, this.current);
        this.tokens.push({
            type,
            lexeme,
            literal,
            line: this.line,
            column: this.startColumn,
        });
    }

    private error(message: string): void {
        this.errors.push({
            message,
            line: this.line,
            column: this.startColumn,
        });
    }
}
