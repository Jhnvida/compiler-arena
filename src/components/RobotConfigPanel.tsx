import {
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    FileCode,
    Plus,
    Terminal,
    Trash2,
    Upload,
} from "lucide-react";
import React, { useState } from "react";
import type { CompilationResult } from "../compiler/compiler.ts";
import {
    PRESET_ERRORS_DEMO,
    PRESET_HUNTER,
    PRESET_OPTIMIZATION_DEMO,
    PRESET_PATROL,
    PRESET_SNIPER,
    PRESET_STRIKER,
} from "../compiler/presets.ts";

export interface TankConfig {
    id: string;
    name: string;
    color: string;
    code: string;
}

interface RobotConfigPanelProps {
    tanks: TankConfig[];
    selectedIndex: number;
    onSelectTank: (index: number) => void;
    onAddTank: () => void;
    onRemoveTank: (id: string) => void;
    onCodeChange: (tankId: string, code: string) => void;
    compilationResults: Record<string, CompilationResult>;
    onInspectTank: (index: number) => void;
    canAdd: boolean;
    canRemove: boolean;
}

const PRESET_OPTIONS = [
    { label: "Hunter (Oficial)", value: "hunter", code: PRESET_HUNTER },
    { label: "Sniper Scout (Longo Alcance)", value: "sniper", code: PRESET_SNIPER },
    { label: "Aggressive Striker (Ofensivo)", value: "striker", code: PRESET_STRIKER },
    { label: "Wandering Patrol (Patrulha)", value: "patrol", code: PRESET_PATROL },
    { label: "Demo de Otimizações", value: "opt", code: PRESET_OPTIMIZATION_DEMO },
    { label: "Demo de Erros Sintáticos", value: "errors", code: PRESET_ERRORS_DEMO },
];

export const RobotConfigPanel: React.FC<RobotConfigPanelProps> = ({
    tanks,
    selectedIndex,
    onSelectTank,
    onAddTank,
    onRemoveTank,
    onCodeChange,
    compilationResults,
    onInspectTank,
    canAdd,
    canRemove,
}) => {
    const [selectedPreset, setSelectedPreset] = useState<string>("custom");

    const currentTank = tanks[selectedIndex] ?? tanks[0];
    const currentCompResult = currentTank ? compilationResults[currentTank.id] : null;

    const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedPreset(val);
        const found = PRESET_OPTIONS.find((p) => p.value === val);
        if (found && currentTank) {
            onCodeChange(currentTank.id, found.code);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentTank) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result;
            if (typeof content === "string") {
                onCodeChange(currentTank.id, content);
                setSelectedPreset("custom");
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    };

    const lineCount = currentTank ? currentTank.code.split("\n").length : 1;
    const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join("\n");

    return (
        <div className="flex flex-col md:flex-row bg-neutral-900/95 border border-neutral-800 rounded-lg overflow-hidden shadow-xl min-h-[360px] max-h-[500px]">
            <div className="w-full md:w-64 bg-neutral-950/70 border-b md:border-b-0 md:border-r border-neutral-800 flex flex-col shrink-0">
                <div className="flex items-center justify-between p-3 border-b border-neutral-800/80 bg-neutral-950/80">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                            Robôs
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
                            {tanks.length}/10
                        </span>
                    </div>

                    {canAdd && (
                        <button
                            type="button"
                            onClick={onAddTank}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer shadow-xs"
                            title="Adicionar mais um robô à arena (máximo 10)"
                        >
                            <Plus className="w-3 h-3 text-neutral-400" />
                            <span>Adicionar</span>
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                    {tanks.map((tank, idx) => {
                        const isSelected = idx === selectedIndex;
                        const res = compilationResults[tank.id];
                        const isCompiled = res?.success;

                        return (
                            <div
                                key={tank.id}
                                onClick={() => {
                                    onSelectTank(idx);
                                    setSelectedPreset("custom");
                                }}
                                className={`flex items-center justify-between px-3 py-2 rounded-md border text-xs cursor-pointer transition-all ${
                                    isSelected
                                        ? "bg-neutral-800/90 border-neutral-600 text-white shadow-xs"
                                        : "bg-neutral-900/40 border-neutral-800/80 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
                                }`}
                            >
                                <div className="flex items-center gap-2.5 truncate">
                                    <span
                                        className="w-3 h-3 rounded-full shrink-0 shadow-xs border border-white/20"
                                        style={{ backgroundColor: tank.color }}
                                    />
                                    <span className="font-semibold truncate">{tank.name}</span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                    {isCompiled ? (
                                        <span title="Compilado com sucesso">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        </span>
                                    ) : (
                                        <span title="Erros na compilação">
                                            <AlertCircle className="w-3 h-3 text-rose-400" />
                                        </span>
                                    )}

                                    {canRemove && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemoveTank(tank.id);
                                            }}
                                            className="p-1 text-neutral-500 hover:text-rose-400 hover:bg-neutral-700/60 rounded transition-colors"
                                            title={`Excluir ${tank.name}`}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {currentTank ? (
                <div className="flex-1 flex flex-col bg-neutral-900/90 min-w-0 overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 bg-neutral-950/80 border-b border-neutral-800">
                        <div className="flex items-center gap-2.5">
                            <span
                                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs border border-white/20"
                                style={{ backgroundColor: currentTank.color }}
                            />
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold text-white tracking-wide">
                                    {currentTank.name}
                                </h3>
                                {currentCompResult?.success ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                                        <CheckCircle2 className="w-2.5 h-2.5" />
                                        <span>Compilado</span>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-rose-950/60 text-rose-400 border border-rose-800/60">
                                        <AlertCircle className="w-2.5 h-2.5" />
                                        <span>{currentCompResult?.errors.length ?? 0} Erro(s)</span>
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <select
                                    value={selectedPreset}
                                    onChange={handlePresetChange}
                                    className="appearance-none bg-neutral-800 text-neutral-200 border border-neutral-700 rounded px-2.5 py-1 pr-6 text-[11px] font-medium focus:outline-none focus:border-neutral-500 transition-colors cursor-pointer"
                                >
                                    <option value="custom">Preset Manual</option>
                                    {PRESET_OPTIONS.map((p) => (
                                        <option key={p.value} value={p.value}>
                                            {p.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="w-3 h-3 text-neutral-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>

                            <label
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition-colors cursor-pointer"
                                title="Carregar script .tank do seu computador"
                            >
                                <Upload className="w-3 h-3 text-neutral-400" />
                                <span>Upload .tank</span>
                                <input
                                    type="file"
                                    accept=".tank,.txt"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </label>

                            <button
                                type="button"
                                onClick={() => onInspectTank(selectedIndex)}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded text-neutral-200 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition-colors cursor-pointer"
                                title="Inspecionar tokens, AST, tabela de símbolos, TAC e bytecode"
                            >
                                <Terminal className="w-3 h-3 text-neutral-400" />
                                <span>Inspetor</span>
                            </button>
                        </div>
                    </div>

                    <div className="relative flex flex-1 min-h-[220px] max-h-[340px] bg-neutral-950 font-mono text-xs overflow-hidden">
                        <div className="select-none py-2 px-2 text-right text-neutral-600 border-r border-neutral-800/80 bg-neutral-950/90 leading-relaxed font-mono whitespace-pre text-[10px] min-w-[32px]">
                            {lineNumbers}
                        </div>

                        <textarea
                            value={currentTank.code}
                            onChange={(e) => {
                                onCodeChange(currentTank.id, e.target.value);
                                setSelectedPreset("custom");
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Tab") {
                                    e.preventDefault();
                                    const target = e.target as HTMLTextAreaElement;
                                    const start = target.selectionStart;
                                    const end = target.selectionEnd;
                                    const val = target.value;
                                    const next = val.substring(0, start) + "    " + val.substring(end);
                                    onCodeChange(currentTank.id, next);
                                    setTimeout(() => {
                                        target.selectionStart = target.selectionEnd = start + 4;
                                    }, 0);
                                }
                            }}
                            spellCheck={false}
                            className="flex-1 p-2 bg-transparent text-neutral-200 resize-none focus:outline-none font-mono text-xs leading-relaxed overflow-y-auto selection:bg-neutral-700"
                            placeholder="Escreva o programa em TankScript aqui..."
                        />
                    </div>

                    <div className="px-3.5 py-1.5 bg-neutral-950/90 border-t border-neutral-800 text-[11px] font-mono flex items-center justify-between">
                        {currentCompResult && !currentCompResult.success ? (
                            <div className="flex items-center gap-1.5 text-rose-400 truncate">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                    Linha {currentCompResult.errors[0].line}, Coluna {currentCompResult.errors[0].column}: {currentCompResult.errors[0].message}
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-neutral-400">
                                <FileCode className="w-3 h-3 text-emerald-500" />
                                <span>Código compilado com sucesso • Pronto para simulação</span>
                            </div>
                        )}

                        <span className="text-[10px] text-neutral-600">
                            {lineCount} linhas
                        </span>
                    </div>
                </div>
            ) : null}
        </div>
    );
};
