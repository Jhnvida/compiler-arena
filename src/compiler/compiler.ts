import type { ProgramNode } from "./ast.ts";
import { BytecodeGenerator, disassembleBytecode, type BytecodeProgram } from "./bytecode.ts";
import { IRGenerator, formatTAC, type TACInstruction } from "./ir.ts";
import { Lexer } from "./lexer.ts";
import { IROptimizer, type OptimizationStats } from "./optimizer.ts";
import { Parser } from "./parser.ts";
import { SemanticAnalyzer } from "./semantic.ts";
import type { SymbolRecord } from "./symbols.ts";
import type { Token } from "./token.ts";

export type CompilerStage = "lexer" | "parser" | "semantic" | "ir" | "optimizer" | "bytecode" | "complete";

export interface CompilationError {
    stage: CompilerStage;
    message: string;
    line: number;
    column: number;
}

export interface CompilationResult {
    success: boolean;
    robotName: string;
    stageReached: CompilerStage;
    tokens: Token[];
    ast: ProgramNode | null;
    symbols: SymbolRecord[];
    rawIR: TACInstruction[];
    rawIRText: string;
    optimizedIR: TACInstruction[];
    optimizedIRText: string;
    optimizationStats: OptimizationStats;
    bytecode: BytecodeProgram | null;
    bytecodeDisassembly: string[];
    errors: CompilationError[];
}

export function compileTankScript(source: string): CompilationResult {
    const errors: CompilationError[] = [];

    const lexer = new Lexer(source);
    const lexResult = lexer.tokenize();

    for (const err of lexResult.errors) {
        errors.push({
            stage: "lexer",
            message: err.message,
            line: err.line,
            column: err.column,
        });
    }

    if (lexResult.errors.length > 0) {
        return {
            success: false,
            robotName: "",
            stageReached: "lexer",
            tokens: lexResult.tokens,
            ast: null,
            symbols: [],
            rawIR: [],
            rawIRText: "",
            optimizedIR: [],
            optimizedIRText: "",
            optimizationStats: emptyOptimizationStats(),
            bytecode: null,
            bytecodeDisassembly: [],
            errors,
        };
    }

    const parser = new Parser(lexResult.tokens);
    const parseResult = parser.parse();

    for (const err of parseResult.errors) {
        errors.push({
            stage: "parser",
            message: err.message,
            line: err.line,
            column: err.column,
        });
    }

    if (parseResult.errors.length > 0 || !parseResult.ast) {
        return {
            success: false,
            robotName: parseResult.ast?.robotName ?? "",
            stageReached: "parser",
            tokens: lexResult.tokens,
            ast: parseResult.ast,
            symbols: [],
            rawIR: [],
            rawIRText: "",
            optimizedIR: [],
            optimizedIRText: "",
            optimizationStats: emptyOptimizationStats(),
            bytecode: null,
            bytecodeDisassembly: [],
            errors,
        };
    }

    const ast = parseResult.ast;
    const robotName = ast.robotName;

    const semantic = new SemanticAnalyzer();
    const semanticResult = semantic.analyze(ast);

    for (const err of semanticResult.errors) {
        errors.push({
            stage: "semantic",
            message: err.message,
            line: err.line,
            column: err.column,
        });
    }

    const symbols = semanticResult.symbolTable.getAllSymbols();

    if (semanticResult.errors.length > 0) {
        return {
            success: false,
            robotName,
            stageReached: "semantic",
            tokens: lexResult.tokens,
            ast,
            symbols,
            rawIR: [],
            rawIRText: "",
            optimizedIR: [],
            optimizedIRText: "",
            optimizationStats: emptyOptimizationStats(),
            bytecode: null,
            bytecodeDisassembly: [],
            errors,
        };
    }

    const irGen = new IRGenerator();
    const rawIR = irGen.generate(ast);
    const rawIRText = formatTAC(rawIR);

    const optimizer = new IROptimizer();
    const optResult = optimizer.optimize(rawIR);
    const optimizedIR = optResult.instructions;
    const optimizedIRText = formatTAC(optimizedIR);
    const optimizationStats = optResult.stats;

    const bytecodeGen = new BytecodeGenerator();
    const bytecode = bytecodeGen.generate(robotName, optimizedIR);
    const bytecodeDisassembly = disassembleBytecode(bytecode);

    return {
        success: true,
        robotName,
        stageReached: "complete",
        tokens: lexResult.tokens,
        ast,
        symbols,
        rawIR,
        rawIRText,
        optimizedIR,
        optimizedIRText,
        optimizationStats,
        bytecode,
        bytecodeDisassembly,
        errors: [],
    };
}

function emptyOptimizationStats(): OptimizationStats {
    return {
        constantFolds: 0,
        algebraicSimplifications: 0,
        constantPropagations: 0,
        deadCodeRemoved: 0,
        instructionsBefore: 0,
        instructionsAfter: 0,
    };
}
