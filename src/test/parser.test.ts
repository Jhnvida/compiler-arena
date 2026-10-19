import { describe, expect, it } from "vitest";
import type { ActionNode, BinaryOpNode, IfNode, VarDeclNode, WhileNode } from "../compiler/ast.ts";
import { Lexer } from "../compiler/lexer.ts";
import { Parser } from "../compiler/parser.ts";

function parse(source: string) {
    const lexer = new Lexer(source);
    const { tokens } = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
}

describe("Parser", () => {
    it("parses a complete robot program into AST", () => {
        const code = `
      robot Hunter {
        int distancia;
        distancia = 50;
        scan();
        if (enemy.visible) {
          fire(3);
        } else {
          move(20);
        }
      }
    `;
        const result = parse(code);

        expect(result.errors).toHaveLength(0);
        expect(result.ast).not.toBeNull();
        expect(result.ast?.robotName).toBe("Hunter");
        expect(result.ast?.body).toHaveLength(4);

        const [decl, assign, scan, ifStmt] = result.ast!.body;
        expect(decl.kind).toBe("VarDecl");
        expect((decl as VarDeclNode).name).toBe("distancia");
        expect(assign.kind).toBe("Assign");
        expect(scan.kind).toBe("Action");
        expect((scan as ActionNode).action).toBe("scan");

        expect(ifStmt.kind).toBe("If");
        const ifNode = ifStmt as IfNode;
        expect(ifNode.thenBranch.statements[0].kind).toBe("Action");
        expect(ifNode.elseBranch).toBeDefined();
    });

    it("respects operator precedence in arithmetic and logical expressions", () => {
        const code = `
      robot MathBot {
        int res;
        res = 2 + 3 * 4;
      }
    `;
        const result = parse(code);
        expect(result.errors).toHaveLength(0);

        const assign = result.ast!.body[1] as any;
        expect(assign.value.kind).toBe("BinaryOp");
        const topOp = assign.value as BinaryOpNode;
        expect(topOp.operator).toBe("+");
        expect(topOp.left.kind).toBe("Literal");
        expect(topOp.right.kind).toBe("BinaryOp");
        expect((topOp.right as BinaryOpNode).operator).toBe("*");
    });

    it("parses while loops correctly", () => {
        const code = `
      robot Looper {
        int count = 0;
        while (count < 10) {
          count = count + 1;
          rotate(36);
        }
      }
    `;
        const result = parse(code);
        expect(result.errors).toHaveLength(0);

        const whileStmt = result.ast!.body[1] as WhileNode;
        expect(whileStmt.kind).toBe("While");
        expect(whileStmt.condition.kind).toBe("BinaryOp");
        expect(whileStmt.body.statements).toHaveLength(2);
    });

    it("reports syntax error with line and column for missing robot keyword", () => {
        const code = `Hunter { int x = 10; }`;
        const result = parse(code);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].message).toContain("Esperava-se 'robot <Nome>'");
    });

    it("reports syntax error for missing semicolon", () => {
        const code = `
      robot SyntaxErr {
        int x = 10
        move(5);
      }
    `;
        const result = parse(code);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].message).toContain("Esperava-se ';'");
    });
});
