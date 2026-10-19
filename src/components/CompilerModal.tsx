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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="relative w-full max-w-5xl h-[86vh] bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl flex flex-col overflow-hidden text-neutral-100">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-neutral-950/70">
                    <div className="flex items-center gap-3">
                        <Terminal className="w-5 h-5 text-neutral-400" />
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-sm font-semibold tracking-wide text-white">
                                    Inspetor de Compilação: {tankName}
                                </h2>
                                {result.success ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        <span>Compilado com Sucesso</span>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-rose-950/60 text-rose-400 border border-rose-800/60">
                                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                                        <span>{result.errors.length} Erro(s)</span>
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
                                Pipeline: Lexer → Parser AST → Semântica → TAC → Otimizador → Bytecode VM
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                        title="Fechar (Esc)"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center gap-1 px-5 pt-2 border-b border-neutral-800 bg-neutral-950/40">
                    <button
                        onClick={() => setActiveTab("ir")}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                            activeTab === "ir"
                                ? "border-neutral-200 text-white bg-neutral-800/40"
                                : "border-transparent text-neutral-400 hover:text-neutral-200"
                        }`}
                    >
                        <Code2 className="w-3.5 h-3.5" />
                        <span>Código Intermediário (TAC)</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("bytecode")}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                            activeTab === "bytecode"
                                ? "border-neutral-200 text-white bg-neutral-800/40"
                                : "border-transparent text-neutral-400 hover:text-neutral-200"
                        }`}
                    >
                        <Cpu className="w-3.5 h-3.5" />
                        <span>Bytecode VM</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("symbols")}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                            activeTab === "symbols"
                                ? "border-neutral-200 text-white bg-neutral-800/40"
                                : "border-transparent text-neutral-400 hover:text-neutral-200"
                        }`}
                    >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Tabela de Símbolos</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("ast")}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                            activeTab === "ast"
                                ? "border-neutral-200 text-white bg-neutral-800/40"
                                : "border-transparent text-neutral-400 hover:text-neutral-200"
                        }`}
                    >
                        <GitBranch className="w-3.5 h-3.5" />
                        <span>Árvore Sintática (AST)</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("tokens")}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                            activeTab === "tokens"
                                ? "border-neutral-200 text-white bg-neutral-800/40"
                                : "border-transparent text-neutral-400 hover:text-neutral-200"
                        }`}
                    >
                        <ListTree className="w-3.5 h-3.5" />
                        <span>Tokens ({result.tokens.length})</span>
                    </button>
                    {result.errors.length > 0 && (
                        <button
                            onClick={() => setActiveTab("errors")}
                            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                                activeTab === "errors"
                                    ? "border-rose-500 text-rose-300 bg-rose-950/20"
                                    : "border-transparent text-rose-400 hover:text-rose-200"
                            }`}
                        >
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                            <span>Erros ({result.errors.length})</span>
                        </button>
                    )}
                </div>

                <div className="flex-1 p-5 overflow-y-auto font-mono text-xs">
                    {activeTab === "ir" && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-3 p-3 bg-neutral-950 rounded border border-neutral-800 text-xs">
                                <div>
                                    <span className="text-neutral-500 text-[11px]">Total Otimizações</span>
                                    <p className="text-base font-bold text-neutral-200">
                                        {result.optimizationStats.constantFolds +
                                            result.optimizationStats.algebraicSimplifications +
                                            result.optimizationStats.constantPropagations +
                                            result.optimizationStats.deadCodeRemoved}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-neutral-500 text-[11px]">Constant Folding</span>
                                    <p className="text-base font-bold text-emerald-400">
                                        {result.optimizationStats.constantFolds}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-neutral-500 text-[11px]">Simplificação Algébrica</span>
                                    <p className="text-base font-bold text-amber-400">
                                        {result.optimizationStats.algebraicSimplifications}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-neutral-500 text-[11px]">Dead Code Eliminado</span>
                                    <p className="text-base font-bold text-neutral-400">
                                        {result.optimizationStats.deadCodeRemoved}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-neutral-950 p-3.5 rounded border border-neutral-800">
                                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800 text-[11px] text-neutral-400 font-sans">
                                        <span className="font-semibold text-neutral-300">IR Bruto (TAC)</span>
                                        <span>{result.rawIR.length} instruções</span>
                                    </div>
                                    <pre className="text-[11px] text-neutral-300 overflow-x-auto whitespace-pre font-mono leading-relaxed max-h-[46vh]">
                                        {result.rawIRText || "(Vazio)"}
                                    </pre>
                                </div>

                                <div className="bg-neutral-950 p-3.5 rounded border border-neutral-800">
                                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800 text-[11px] text-neutral-400 font-sans">
                                        <span className="font-semibold text-emerald-400">IR Otimizado (TAC)</span>
                                        <span>{result.optimizedIR.length} instruções</span>
                                    </div>
                                    <pre className="text-[11px] text-emerald-300/90 overflow-x-auto whitespace-pre font-mono leading-relaxed max-h-[46vh]">
                                        {result.optimizedIRText || "(Vazio)"}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "bytecode" && (
                        <div className="bg-neutral-950 p-4 rounded border border-neutral-800">
                            <div className="flex items-center justify-between pb-2 mb-3 border-b border-neutral-800 text-xs text-neutral-400 font-sans">
                                <span className="font-semibold text-neutral-300">Desmontagem de Bytecode</span>
                                <span>
                                    {result.bytecode?.instructions.length ?? 0} instruções /{" "}
                                    {result.bytecode?.variableNames.length ?? 0} variáveis
                                </span>
                            </div>
                            <pre className="text-xs text-neutral-300 overflow-x-auto whitespace-pre font-mono leading-relaxed max-h-[58vh]">
                                {result.bytecodeDisassembly || "(Bytecode não gerado devido a erros)"}
                            </pre>
                        </div>
                    )}

                    {activeTab === "symbols" && (
                        <div className="bg-neutral-950 p-4 rounded border border-neutral-800">
                            <div className="pb-2 mb-3 border-b border-neutral-800 text-xs text-neutral-400 font-sans font-semibold">
                                Símbolos Registrados
                            </div>
                            {result.symbols.length === 0 ? (
                                <p className="text-neutral-500 italic text-xs">Nenhum símbolo declarado no escopo.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse font-sans">
                                        <thead>
                                            <tr className="border-b border-neutral-800 text-neutral-400 text-[11px]">
                                                <th className="py-2 px-3">Nome</th>
                                                <th className="py-2 px-3">Nome Único</th>
                                                <th className="py-2 px-3">Tipo</th>
                                                <th className="py-2 px-3">Escopo</th>
                                                <th className="py-2 px-3">Inicializada?</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-800/60 font-mono text-xs">
                                            {result.symbols.map((sym, idx) => (
                                                <tr key={idx} className="hover:bg-neutral-800/40">
                                                    <td className="py-2 px-3 text-neutral-200 font-semibold">
                                                        {sym.name}
                                                    </td>
                                                    <td className="py-2 px-3 text-neutral-400">{sym.uniqueName}</td>
                                                    <td className="py-2 px-3 text-neutral-300">{sym.type}</td>
                                                    <td className="py-2 px-3 text-neutral-400">
                                                        Nível {sym.scopeLevel} (ID {sym.scopeId})
                                                    </td>
                                                    <td className="py-2 px-3 text-neutral-400">
                                                        {sym.isInitialized ? "Sim" : "Não"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "ast" && (
                        <div className="bg-neutral-950 p-4 rounded border border-neutral-800">
                            <div className="pb-2 mb-3 border-b border-neutral-800 text-xs text-neutral-400 font-sans font-semibold">
                                Representação JSON da Abstract Syntax Tree (AST)
                            </div>
                            <pre className="text-xs text-neutral-300 overflow-x-auto whitespace-pre font-mono max-h-[58vh]">
                                {result.ast ? JSON.stringify(result.ast, null, 2) : "(AST Indisponível)"}
                            </pre>
                        </div>
                    )}

                    {activeTab === "tokens" && (
                        <div className="bg-neutral-950 p-4 rounded border border-neutral-800">
                            <div className="pb-2 mb-3 border-b border-neutral-800 text-xs text-neutral-400 font-sans font-semibold">
                                Fluxo de Tokens Léxicos ({result.tokens.length})
                            </div>
                            <div className="overflow-x-auto max-h-[58vh]">
                                <table className="w-full text-left text-xs border-collapse font-sans">
                                    <thead>
                                        <tr className="border-b border-neutral-800 text-neutral-400 text-[11px]">
                                            <th className="py-1.5 px-3">Linha:Coluna</th>
                                            <th className="py-1.5 px-3">Tipo do Token</th>
                                            <th className="py-1.5 px-3">Valor / Lexema</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-800/60 font-mono text-xs">
                                        {result.tokens.map((tok, idx) => (
                                            <tr key={idx} className="hover:bg-neutral-800/40">
                                                <td className="py-1.5 px-3 text-neutral-500">
                                                    {tok.line}:{tok.column}
                                                </td>
                                                <td className="py-1.5 px-3 text-neutral-300">{tok.type}</td>
                                                <td className="py-1.5 px-3 text-emerald-400">{tok.lexeme}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === "errors" && (
                        <div className="space-y-2">
                            {result.errors.map((err, idx) => (
                                <div
                                    key={idx}
                                    className="p-3 bg-neutral-950 rounded border border-rose-900/60 text-xs font-sans"
                                >
                                    <div className="flex items-center gap-2 text-rose-400 font-semibold mb-1">
                                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                                        <span>
                                            Erro na linha {err.line}, coluna {err.column}
                                        </span>
                                    </div>
                                    <p className="text-neutral-300 font-mono text-[11px] pl-6">{err.message}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
