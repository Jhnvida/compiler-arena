import { describe, expect, it } from "vitest";
import { Lexer } from "../compiler/lexer.ts";
import { Parser } from "../compiler/parser.ts";
import { SemanticAnalyzer } from "../compiler/semantic.ts";

function analyze(source: string) {
    const lexer = new Lexer(source);
    const { tokens } = lexer.tokenize();
    const parser = new Parser(tokens);
    const { ast } = parser.parse();
    if (!ast) throw new Error("Parser failed to produce AST");
    const semantic = new SemanticAnalyzer();
    return semantic.analyze(ast);
}

describe("SemanticAnalyzer", () => {
    it("validates a correct TankScript program without errors", () => {
        const code = `
      robot ValidBot {
        int x = 10;
        float y = 20.5;
        bool ready = false;

        scan();
        if (enemy.visible) {
          rotate(enemy.direction);
          fire(2);
        } else {
          move(15);
        }
      }
    `;
        const result = analyze(code);
        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.symbolTable.getAllSymbols()).toHaveLength(3);
    });

    it("detects variable used before declaration", () => {
        const code = `
      robot TestBot {
        x = 10;
        int x;
      }
    `;
        const result = analyze(code);
        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain("Variável 'x' utilizada antes de ser declarada");
    });

    it("detects duplicate variable declaration in the same scope", () => {
        const code = `
      robot TestBot {
        int speed = 5;
        int speed = 10;
      }
    `;
        const result = analyze(code);
        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain("Variável 'speed' já declarada no escopo atual");
    });

    it("allows variable shadowing in nested block scope", () => {
        const code = `
      robot ScopeBot {
        int x = 5;
        if (true) {
          int x = 10;
          move(x);
        }
      }
    `;
        const result = analyze(code);
        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("detects type mismatch when assigning bool to int", () => {
        const code = `
      robot TypeMismatch {
        int x;
        x = true;
      }
    `;
        const result = analyze(code);
        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain(
            "Incompatibilidade de tipos: não é possível atribuir expressão do tipo 'bool' à variável 'x' do tipo 'int'",
        );
    });

    it("detects non-boolean condition in if statement", () => {
        const code = `
      robot CondCheck {
        int x = 5;
        if (x + 2) {
          move(10);
        }
      }
    `;
        const result = analyze(code);
        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain("Condição da estrutura 'if' deve ser do tipo 'bool'");
    });

    it("detects invalid fire power outside 1..3", () => {
        const code = `
      robot Artillery {
        fire(10);
      }
    `;
        const result = analyze(code);
        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain("Potência de tiro inválida: deve ser entre 1 e 3 (recebido: 10)");
    });

    it("accepts valid fire power 1, 2, 3", () => {
        const code = `
      robot Artillery {
        fire(1);
        fire(2);
        fire(3);
      }
    `;
        const result = analyze(code);
        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("detects invalid argument type for move(false)", () => {
        const code = `
      robot BadMove {
        move(false);
      }
    `;
        const result = analyze(code);
        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain("Comando 'move()' espera argumento numérico");
    });

    it("detects extra arguments for scan()", () => {
        const code = `
      robot BadScan {
        scan(42);
      }
    `;
        const result = analyze(code);
        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain("Comando 'scan()' não aceita argumentos");
    });

    it("forbids assignment to read-only sensors", () => {
        const code = `
      robot HackerBot {
        energy = 100;
      }
    `;
        const result = analyze(code);
        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain("Sensores da arena são de apenas leitura");
    });

    it("detects unknown sensor properties", () => {
        const code = `
      robot SensorCheck {
        if (enemy.shield > 0) {
          move(10);
        }
      }
    `;
        const result = analyze(code);
        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain("Sensor ou propriedade desconhecida: 'enemy.shield'");
    });
});
