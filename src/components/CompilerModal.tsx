import { AlertTriangle, CheckCircle2, Code2, Cpu, GitBranch, Layers, ListTree, Terminal, X } from "lucide-react";
import React, { useState } from "react";
import type { CompilationResult } from "../compiler/compiler.ts";

interface CompilerModalProps {
    isOpen: boolean;
    onClose: () => void;
    result: CompilationResult | null;
    tankName: string;
}

type TabType = "ir" | "bytecode" | "symbols" | "ast" | "tokens" | "errors";

export const CompilerModal: React.FC<CompilerModalProps> = ({ isOpen, onClose, result, tankName }) => {
    const [activeTab, setActiveTab] = useState<TabType>("ir");

    if (!isOpen || !result) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 font-sans select-none text-neutral-100">
            <div className="relative w-full max-w-5xl h-[84vh] max-h-[780px] bg-neutral-950 border border-neutral-800 rounded shadow-2xl flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 bg-neutral-950">
                    <div className="flex items-center gap-2.5">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        <div className="flex items-center gap-2">
                            <h2 className="text-xs font-bold tracking-wider uppercase text-white font-mono">
                                Inspetor de Compilação {"//"} {tankName}
                            </h2>
                            {result.success ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    <span>COMPILADO</span>
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded bg-rose-950/60 text-rose-300 border border-rose-800/60">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    <span>{result.errors.length} ERRO(S)</span>
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded transition-colors cursor-pointer"
                        title="Fechar [Esc]"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center gap-1 px-4 pt-1.5 border-b border-neutral-850 bg-neutral-950/60 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab("ir")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t border-t border-x transition-colors cursor-pointer ${
                            activeTab === "ir"
                                ? "bg-neutral-900 border-neutral-700 text-white"
                                : "bg-transparent border-transparent text-neutral-400 hover:text-neutral-200"
                        }`}
                    >
                        <Code2 className="w-3.5 h-3.5" />
                        <span>TAC (Código Intermediário)</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("bytecode")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t border-t border-x transition-colors cursor-pointer ${
                            activeTab === "bytecode"
                                ? "bg-neutral-900 border-neutral-700 text-white"
                                : "bg-transparent border-transparent text-neutral-400 hover:text-neutral-200"
                        }`}
                    >
                        <Cpu className="w-3.5 h-3.5" />
                        <span>Bytecode VM</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("symbols")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t border-t border-x transition-colors cursor-pointer ${
                            activeTab === "symbols"
                                ? "bg-neutral-900 border-neutral-700 text-white"
                                : "bg-transparent border-transparent text-neutral-400 hover:text-neutral-200"
                        }`}
                    >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Símbolos</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("ast")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t border-t border-x transition-colors cursor-pointer ${
                            activeTab === "ast"
                                ? "bg-neutral-900 border-neutral-700 text-white"
                                : "bg-transparent border-transparent text-neutral-400 hover:text-neutral-200"
                        }`}
                    >
                        <GitBranch className="w-3.5 h-3.5" />
                        <span>AST</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("tokens")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t border-t border-x transition-colors cursor-pointer ${
                            activeTab === "tokens"
                                ? "bg-neutral-900 border-neutral-700 text-white"
                                : "bg-transparent border-transparent text-neutral-400 hover:text-neutral-200"
                        }`}
                    >
                        <ListTree className="w-3.5 h-3.5" />
                        <span>Tokens</span>
                    </button>

                    {result.errors.length > 0 && (
                        <button
                            onClick={() => setActiveTab("errors")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t border-t border-x transition-colors cursor-pointer ${
                                activeTab === "errors"
                                    ? "bg-rose-950/50 border-rose-800 text-rose-200"
                                    : "bg-transparent border-transparent text-rose-400 hover:text-rose-300"
                            }`}
                        >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Erros ({result.errors.length})</span>
                        </button>
                    )}
                </div>

                <div className="flex-1 p-4 overflow-y-auto bg-neutral-950 font-mono text-xs leading-relaxed text-neutral-200">
                    {activeTab === "ir" && (
                        <div className="space-y-2">
                            <div className="text-[11px] text-neutral-400 font-sans mb-2">
                                Instruções TAC Otimizadas de Três Endereços:
                            </div>
                            <pre className="p-3 bg-neutral-900/60 border border-neutral-850 rounded text-[11px] overflow-x-auto text-emerald-300 font-mono selection:bg-neutral-700">
                                {result.optimizedIRText || result.rawIRText || "Nenhum TAC gerado."}
                            </pre>
                        </div>
                    )}

                    {activeTab === "bytecode" && (
                        <div className="space-y-2">
                            <div className="text-[11px] text-neutral-400 font-sans mb-2">
                                Desmontagem do Bytecode binário executável pela VM:
                            </div>
                            <pre className="p-3 bg-neutral-900/60 border border-neutral-850 rounded text-[11px] overflow-x-auto text-neutral-200 font-mono selection:bg-neutral-700">
                                {result.bytecodeDisassembly && result.bytecodeDisassembly.length > 0
                                    ? result.bytecodeDisassembly.join("\n")
                                    : "Nenhum bytecode gerado."}
                            </pre>
                        </div>
                    )}

                    {activeTab === "symbols" && (
                        <div className="space-y-2">
                            <div className="text-[11px] text-neutral-400 font-sans mb-2">
                                Tabela de símbolos e variáveis alocadas:
                            </div>
                            <pre className="p-3 bg-neutral-900/60 border border-neutral-850 rounded text-[11px] overflow-x-auto text-neutral-300 font-mono selection:bg-neutral-700">
                                {result.symbols
                                    ? JSON.stringify(result.symbols, null, 2)
                                    : "Nenhum símbolo registrado."}
                            </pre>
                        </div>
                    )}

                    {activeTab === "ast" && (
                        <div className="space-y-2">
                            <div className="text-[11px] text-neutral-400 font-sans mb-2">
                                Árvore Sintática Abstrata (Abstract Syntax Tree):
                            </div>
                            <pre className="p-3 bg-neutral-900/60 border border-neutral-850 rounded text-[11px] overflow-x-auto text-neutral-300 font-mono selection:bg-neutral-700">
                                {result.ast ? JSON.stringify(result.ast, null, 2) : "Nenhuma AST gerada."}
                            </pre>
                        </div>
                    )}

                    {activeTab === "tokens" && (
                        <div className="space-y-2">
                            <div className="text-[11px] text-neutral-400 font-sans mb-2">
                                Sequência de Tokens produzida pelo analisador léxico:
                            </div>
                            <pre className="p-3 bg-neutral-900/60 border border-neutral-850 rounded text-[11px] overflow-x-auto text-neutral-300 font-mono selection:bg-neutral-700">
                                {result.tokens
                                    ? result.tokens
                                          .map((tok) => `[${tok.type}] '${tok.lexeme}' (L${tok.line}:C${tok.column})`)
                                          .join("\n")
                                    : "Nenhum token disponível."}
                            </pre>
                        </div>
                    )}

                    {activeTab === "errors" && (
                        <div className="space-y-2">
                            <div className="text-[11px] text-rose-400 font-sans mb-2 font-semibold">
                                Lista de erros identificados na análise:
                            </div>
                            <div className="space-y-1.5">
                                {result.errors.map((err, i) => (
                                    <div
                                        key={i}
                                        className="p-2.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs"
                                    >
                                        <div className="font-bold text-rose-300">
                                            Linha {err.line}, Coluna {err.column}:
                                        </div>
                                        <div className="mt-0.5">{err.message}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between px-4 py-2 border-t border-neutral-800 bg-neutral-950 text-[11px] font-mono text-neutral-500">
                    <span>STATUS: {result.success ? "OPERAÇÃO CONCLUÍDA" : "FALHA NA COMPILAÇÃO"}</span>
                    <button
                        onClick={onClose}
                        className="px-3 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 rounded text-xs transition-colors cursor-pointer"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};
