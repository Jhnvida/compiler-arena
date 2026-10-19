import React, { useState } from "react";
import type { CompilationResult } from "../compiler/compiler.ts";

interface CompilerModalProps {
    isOpen: boolean;
    onClose: () => void;
    result: CompilationResult | null;
    tankName: string;
}

type TabType = "tokens" | "ast" | "symbols" | "ir" | "bytecode" | "errors";

export const CompilerModal: React.FC<CompilerModalProps> = ({ isOpen, onClose, result, tankName }) => {
    const [activeTab, setActiveTab] = useState<TabType>("ir");

    if (!isOpen || !result) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-5xl h-[88vh] bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">⚙️</span>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold tracking-tight text-white">
                                    Inspetor de Compilação: {tankName}
                                </h2>
                                {result.success ? (
                                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                        Compilado com Sucesso
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                        {result.errors.length} Erro(s)
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-400">
                                Pipeline: Lexer → Parser AST → Semântica → TAC → Otimizador → Bytecode VM
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Fechar (Esc)"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-800 bg-slate-900/40">
                    <button
                        onClick={() => setActiveTab("ir")}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-all cursor-pointer ${
                            activeTab === "ir"
                                ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
                                : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        Código Intermediário (TAC)
                    </button>
                    <button
                        onClick={() => setActiveTab("bytecode")}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-all cursor-pointer ${
                            activeTab === "bytecode"
                                ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
                                : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        Bytecode VM
                    </button>
                    <button
                        onClick={() => setActiveTab("symbols")}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-all cursor-pointer ${
                            activeTab === "symbols"
                                ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
                                : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        Tabela de Símbolos
                    </button>
                    <button
                        onClick={() => setActiveTab("ast")}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-all cursor-pointer ${
                            activeTab === "ast"
                                ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
                                : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        Árvore Sintática (AST)
                    </button>
                    <button
                        onClick={() => setActiveTab("tokens")}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-all cursor-pointer ${
                            activeTab === "tokens"
                                ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
                                : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        Tokens ({result.tokens.length})
                    </button>
                    {result.errors.length > 0 && (
                        <button
                            onClick={() => setActiveTab("errors")}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all cursor-pointer ${
                                activeTab === "errors"
                                    ? "border-rose-400 text-rose-300 bg-rose-950/20"
                                    : "border-transparent text-rose-400 hover:text-rose-200"
                            }`}
                        >
                            Erros ({result.errors.length})
                        </button>
                    )}
                </div>

                <div className="flex-1 p-6 overflow-y-auto font-mono text-sm">
                    {activeTab === "ir" && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-3 p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs">
                                <div>
                                    <span className="text-slate-400">Total Otimizações:</span>
                                    <p className="text-base font-bold text-cyan-400">
                                        {result.optimizationStats.constantFolds +
                                            result.optimizationStats.algebraicSimplifications +
                                            result.optimizationStats.constantPropagations +
                                            result.optimizationStats.deadCodeRemoved}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-slate-400">Constant Folding:</span>
                                    <p className="text-base font-bold text-emerald-400">
                                        {result.optimizationStats.constantFolds}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-slate-400">Simplificação Algébrica:</span>
                                    <p className="text-base font-bold text-amber-400">
                                        {result.optimizationStats.algebraicSimplifications}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-slate-400">Dead Code Eliminado:</span>
                                    <p className="text-base font-bold text-rose-400">
                                        {result.optimizationStats.deadCodeRemoved}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800">
                                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs text-slate-400">
                                        <span>IR Bruto (Three-Address Code)</span>
                                        <span>{result.rawIR.length} instruções</span>
                                    </div>
                                    <pre className="text-xs text-slate-300 overflow-x-auto whitespace-pre font-mono leading-relaxed max-h-[50vh]">
                                        {result.rawIRText || "(Vazio)"}
                                    </pre>
                                </div>

                                <div className="bg-slate-950/70 p-4 rounded-lg border border-cyan-900/40">
                                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs text-cyan-400">
                                        <span>IR Otimizado (TAC Otimizado)</span>
                                        <span>{result.optimizedIR.length} instruções</span>
                                    </div>
                                    <pre className="text-xs text-emerald-300 overflow-x-auto whitespace-pre font-mono leading-relaxed max-h-[50vh]">
                                        {result.optimizedIRText || "(Vazio)"}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "bytecode" && (
                        <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800">
                            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800 text-xs text-slate-400">
                                <span>Desmontagem do Bytecode (Instruções Virtuais)</span>
                                <span>
                                    {result.bytecode?.instructions.length ?? 0} instruções /{" "}
                                    {result.bytecode?.variableNames.length ?? 0} variáveis
                                </span>
                            </div>
                            <pre className="text-xs text-cyan-300 overflow-x-auto whitespace-pre font-mono leading-relaxed max-h-[60vh]">
                                {result.bytecodeDisassembly || "(Bytecode não gerado devido a erros)"}
                            </pre>
                        </div>
                    )}

                    {activeTab === "symbols" && (
                        <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800">
                            <div className="pb-2 mb-3 border-b border-slate-800 text-xs text-slate-400">
                                Variáveis Registradas na Tabela de Símbolos
                            </div>
                            {result.symbols.length === 0 ? (
                                <p className="text-slate-500 italic text-xs">Nenhum símbolo declarado no escopo.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-800 text-slate-400">
                                                <th className="py-2 px-3">Nome</th>
                                                <th className="py-2 px-3">Nome Único</th>
                                                <th className="py-2 px-3">Tipo</th>
                                                <th className="py-2 px-3">Escopo</th>
                                                <th className="py-2 px-3">Inicializada?</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60">
                                            {result.symbols.map((sym, idx) => (
                                                <tr key={idx} className="hover:bg-slate-800/40">
                                                    <td className="py-2 px-3 text-cyan-300 font-bold">{sym.name}</td>
                                                    <td className="py-2 px-3 text-slate-400 font-mono">
                                                        {sym.uniqueName}
                                                    </td>
                                                    <td className="py-2 px-3 text-purple-300">{sym.type}</td>
                                                    <td className="py-2 px-3 text-slate-300">
                                                        Nível {sym.scopeLevel} (ID {sym.scopeId})
                                                    </td>
                                                    <td className="py-2 px-3 text-slate-300">
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
                        <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800">
                            <div className="pb-2 mb-3 border-b border-slate-800 text-xs text-slate-400">
                                Representação JSON da Abstract Syntax Tree
                            </div>
                            <pre className="text-xs text-amber-300 overflow-x-auto whitespace-pre font-mono max-h-[60vh]">
                                {result.ast ? JSON.stringify(result.ast, null, 2) : "(AST Indisponível)"}
                            </pre>
                        </div>
                    )}

                    {activeTab === "tokens" && (
                        <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800">
                            <div className="pb-2 mb-3 border-b border-slate-800 text-xs text-slate-400">
                                Fluxo de Tokens Léxicos Reconhecidos ({result.tokens.length})
                            </div>
                            <div className="overflow-x-auto max-h-[60vh]">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-800 text-slate-400 sticky top-0 bg-slate-950">
                                            <th className="py-2 px-3">#</th>
                                            <th className="py-2 px-3">Tipo do Token</th>
                                            <th className="py-2 px-3">Lexema / Literal</th>
                                            <th className="py-2 px-3">Linha</th>
                                            <th className="py-2 px-3">Coluna</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {result.tokens.map((tok, idx) => (
                                            <tr key={idx} className="hover:bg-slate-800/40">
                                                <td className="py-1.5 px-3 text-slate-500">{idx}</td>
                                                <td className="py-1.5 px-3 text-cyan-400 font-semibold">{tok.type}</td>
                                                <td className="py-1.5 px-3 text-emerald-300 font-mono">
                                                    {tok.literal !== undefined ? String(tok.literal) : tok.lexeme}
                                                </td>
                                                <td className="py-1.5 px-3 text-slate-400">{tok.line}</td>
                                                <td className="py-1.5 px-3 text-slate-400">{tok.column}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === "errors" && (
                        <div className="space-y-3">
                            {result.errors.map((err, idx) => (
                                <div
                                    key={idx}
                                    className="p-4 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs space-y-1"
                                >
                                    <div className="flex items-center gap-2 font-bold text-rose-300">
                                        <span>⚠️ Erro de Compilação [{err.stage}]</span>
                                        <span>•</span>
                                        <span>
                                            Linha {err.line}, Coluna {err.column}
                                        </span>
                                    </div>
                                    <p className="text-slate-200">{err.message}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
