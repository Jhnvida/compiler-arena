import { describe, expect, it } from "vitest";
import { Lexer } from "../compiler/lexer.ts";

describe("Lexer", () => {
    it("tokenizes keywords, identifiers, and literals", () => {
        const code = `robot Striker {
      int speed = 10;
      float distance = 45.5;
      bool active = true;
    }`;
        const lexer = new Lexer(code);
        const { tokens, errors } = lexer.tokenize();

        expect(errors).toHaveLength(0);
        expect(tokens.map((t) => t.type)).toEqual([
            "ROBOT",
            "IDENTIFIER",
            "LBRACE",
            "INT",
            "IDENTIFIER",
            "ASSIGN",
            "INT_LITERAL",
            "SEMICOLON",
            "FLOAT",
            "IDENTIFIER",
            "ASSIGN",
            "FLOAT_LITERAL",
            "SEMICOLON",
            "BOOL",
            "IDENTIFIER",
            "ASSIGN",
            "TRUE",
            "SEMICOLON",
            "RBRACE",
            "EOF",
        ]);

        expect(tokens[1].lexeme).toBe("Striker");
        expect(tokens[6].literal).toBe(10);
        expect(tokens[11].literal).toBe(45.5);
        expect(tokens[16].literal).toBe(true);
    });

    it("correctly tracks line and column numbers", () => {
        const code = `robot Test {\n  int x = 5;\n}`;
        const lexer = new Lexer(code);
        const { tokens } = lexer.tokenize();

        expect(tokens[0].line).toBe(1);
        expect(tokens[0].column).toBe(1);
        expect(tokens[1].line).toBe(1);
        expect(tokens[1].column).toBe(7);
        expect(tokens[2].line).toBe(1);
        expect(tokens[2].column).toBe(12);

        expect(tokens[3].line).toBe(2);
        expect(tokens[3].column).toBe(3);
        expect(tokens[4].column).toBe(7);
        expect(tokens[5].column).toBe(9);
        expect(tokens[6].column).toBe(11);
    });

    it("ignores single-line and multi-line comments", () => {
        const code = `
      // Single line comment
      robot CommentBot {
        /* Multi-line
           comment block */
        scan();
      }
    `;
        const lexer = new Lexer(code);
        const { tokens, errors } = lexer.tokenize();

        expect(errors).toHaveLength(0);
        const types = tokens.map((t) => t.type);
        expect(types).toContain("ROBOT");
        expect(types).toContain("ACTION_SCAN");
        expect(types).toContain("RBRACE");
    });

    it("reports error on unterminated multi-line comment", () => {
        const code = `robot Broken { /* unterminated comment`;
        const lexer = new Lexer(code);
        const { errors } = lexer.tokenize();

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain("Comentário de múltiplas linhas não finalizado");
    });

    it("reports error on invalid characters", () => {
        const code = `robot Invalid { @ $ }`;
        const lexer = new Lexer(code);
        const { errors } = lexer.tokenize();

        expect(errors.length).toBe(2);
        expect(errors[0].message).toContain("Caractere desconhecido ou inválido '@'");
        expect(errors[1].message).toContain("Caractere desconhecido ou inválido '$'");
    });

    it("tokenizes comparison and logical operators correctly", () => {
        const code = `robot Ops { if (x <= 10 && y >= 20 || !flag && a != b && c == d) {} }`;
        const lexer = new Lexer(code);
        const { tokens, errors } = lexer.tokenize();

        expect(errors).toHaveLength(0);
        const types = tokens.map((t) => t.type);
        expect(types).toContain("LTE");
        expect(types).toContain("GTE");
        expect(types).toContain("AND");
        expect(types).toContain("OR");
        expect(types).toContain("NOT");
        expect(types).toContain("NEQ");
        expect(types).toContain("EQ");
    });
});
