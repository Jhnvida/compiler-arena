import { describe, expect, it } from "vitest";
import { IRGenerator, formatTAC } from "../compiler/ir.ts";
import { Lexer } from "../compiler/lexer.ts";
import { IROptimizer } from "../compiler/optimizer.ts";
import { Parser } from "../compiler/parser.ts";

function compileToIR(source: string) {
    const lexer = new Lexer(source);
    const { tokens } = lexer.tokenize();
    const parser = new Parser(tokens);
    const { ast } = parser.parse();
    if (!ast) throw new Error("Parser failed to produce AST");
    const irGen = new IRGenerator();
    return irGen.generate(ast);
}

describe("IRGenerator & Optimizer", () => {
    it("generates Three-Address Code with temporaries and labels", () => {
        const code = `
      robot IRBot {
        int dist = 10 + 5;
        if (enemy.visible) {
          fire(3);
        }
      }
    `;
        const ir = compileToIR(code);
        expect(ir.length).toBeGreaterThan(0);

        const formatted = formatTAC(ir);
        expect(formatted).toContain("t0 = 10 + 5");
        expect(formatted).toContain("dist = t0");
        expect(formatted).toContain("READ_SENSOR(enemy.visible)");
        expect(formatted).toContain("CALL_ACTION fire, 1");
    });

    it("folds constant expressions (Constant Folding)", () => {
        const code = `
      robot FoldBot {
        int x;
        x = 10 + 20 * 2;
      }
    `;
        const rawIR = compileToIR(code);
        const optimizer = new IROptimizer();
        const { instructions: optIR, stats } = optimizer.optimize(rawIR);

        expect(stats.constantFolds).toBeGreaterThanOrEqual(2);
        const formatted = formatTAC(optIR);
        expect(formatted).toContain("x = 50");
    });

    it("performs algebraic simplifications (x + 0, x * 1, x * 0)", () => {
        const code = `
      robot AlgBot {
        int a = 15;
        int b;
        int c;
        int d;
        b = a + 0;
        c = a * 1;
        d = a * 0;
      }
    `;
        const rawIR = compileToIR(code);
        const optimizer = new IROptimizer();
        const { instructions: optIR, stats } = optimizer.optimize(rawIR);

        expect(stats.algebraicSimplifications).toBeGreaterThanOrEqual(3);
        const formatted = formatTAC(optIR);
        expect(formatted).toContain("b = a");
        expect(formatted).toContain("c = a");
        expect(formatted).toContain("d = 0");
    });

    it("eliminates dead jumps and optimizes conditional branches", () => {
        const code = `
      robot BranchBot {
        if (true) {
          move(10);
        }
      }
    `;
        const rawIR = compileToIR(code);
        const optimizer = new IROptimizer();
        const { instructions: optIR, stats } = optimizer.optimize(rawIR);

        expect(stats.deadCodeRemoved).toBeGreaterThan(0);
        const formatted = formatTAC(optIR);
        expect(formatted).not.toContain("IF_FALSE true");
    });

    it("reduces total instruction count after optimization", () => {
        const code = `
      robot Reducer {
        int val;
        val = 100 + 200 + 300;
        val = val * 1 + 0;
      }
    `;
        const rawIR = compileToIR(code);
        const optimizer = new IROptimizer();
        const { instructions: optIR, stats } = optimizer.optimize(rawIR);

        expect(stats.instructionsAfter).toBeLessThan(stats.instructionsBefore);
        expect(optIR.length).toBeLessThan(rawIR.length);
    });
});
