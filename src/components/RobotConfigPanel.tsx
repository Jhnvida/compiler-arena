import { AlertCircle, CheckCircle2, ChevronDown, Plus, Terminal, Upload, X } from "lucide-react";
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
    { label: "Caçador (Equilibrado)", value: "hunter", code: PRESET_HUNTER },
    { label: "Franco-atirador (Longo Alcance)", value: "sniper", code: PRESET_SNIPER },
    { label: "Atacante (Ofensivo)", value: "striker", code: PRESET_STRIKER },
    { label: "Patrulheiro (Exploração)", value: "patrol", code: PRESET_PATROL },
    { label: "Demonstração de Otimizações", value: "opt", code: PRESET_OPTIMIZATION_DEMO },
    { label: "Demonstração de Erros", value: "errors", code: PRESET_ERRORS_DEMO },
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
        <div className="flex flex-col bg-neutral-950/90 backdrop-blur-md border border-neutral-800 rounded shadow-xl font-sans text-neutral-100 overflow-hidden w-full max-h-[46vh] min-h-[220px]">
            <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-3 pt-1 gap-3 shrink-0">
                <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 flex-1 py-0.5">
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
                                className={`group flex items-center gap-2 h-7 px-2.5 text-xs font-semibold cursor-pointer border rounded-t transition-all shrink-0 ${
                                    isSelected
                                        ? "bg-neutral-900 border-neutral-700 text-white shadow-xs"
                                        : "bg-transparent border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
                                }`}
                            >
                                <span
                                    className="w-2.5 h-2.5 rounded-xs shrink-0 border border-white/20 shadow-xs"
                                    style={{ backgroundColor: tank.color }}
                                />

                                <span className="tracking-wide truncate max-w-[100px]">{tank.name}</span>

                                <span title={isCompiled ? "Compilado com sucesso" : "Erros de compilação"}>
                                    {isCompiled ? (
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                    ) : (
                                        <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                                    )}
                                </span>

                                {canRemove && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveTank(tank.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-500 hover:text-rose-400 transition-opacity cursor-pointer ml-0.5"
                                        title={`Remover ${tank.name}`}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    {canAdd && (
                        <button
                            type="button"
                            onClick={onAddTank}
                            className="btn-compact h-7 shrink-0 text-neutral-400 hover:text-neutral-100"
                            title="Adicionar mais um robô (máximo 10)"
                        >
                            <Plus className="w-3 h-3" />
                            <span>Novo</span>
                        </button>
                    )}
                </div>

                <div className="shrink-0 flex items-center pl-3 border-l border-neutral-800 text-[11px] font-mono text-neutral-400">
                    <span>{tanks.length} de 10 robôs</span>
                </div>
            </div>

            {currentTank ? (
                <div className="flex flex-col flex-1 min-h-0 bg-neutral-900/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-neutral-950/80 border-b border-neutral-800 text-xs shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                            {currentCompResult?.success ? (
                                <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Código compilado e pronto para o combate</span>
                                </span>
                            ) : (
                                <span className="text-[11px] font-medium text-rose-400 flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                                    <span>{currentCompResult?.errors.length ?? 0} erro(s) de compilação</span>
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                            <div className="relative">
                                <select
                                    value={selectedPreset}
                                    onChange={handlePresetChange}
                                    className="appearance-none bg-neutral-900 hover:bg-neutral-850 text-neutral-200 border border-neutral-800 rounded h-7 px-2.5 pr-6 text-xs font-medium focus:outline-none focus:border-neutral-600 transition-colors cursor-pointer"
                                >
                                    <option value="custom">Código Personalizado</option>
                                    {PRESET_OPTIONS.map((p) => (
                                        <option key={p.value} value={p.value}>
                                            {p.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="w-3 h-3 text-neutral-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>

                            <label
                                className="btn-compact h-7 cursor-pointer"
                                title="Carregar script .tank do seu dispositivo"
                            >
                                <Upload className="w-3.5 h-3.5 text-neutral-400" />
                                <span className="hidden sm:inline">Carregar Arquivo</span>
                                <input type="file" accept=".tank,.txt" onChange={handleFileUpload} className="hidden" />
                            </label>

                            <button
                                type="button"
                                onClick={() => onInspectTank(selectedIndex)}
                                className="btn-compact h-7 cursor-pointer"
                                title="Inspecionar AST, TAC e Bytecode da VM"
                            >
                                <Terminal className="w-3.5 h-3.5 text-neutral-400" />
                                <span>Inspetor do Compilador</span>
                            </button>
                        </div>
                    </div>

                    {/* Code Editor Body */}
                    <div className="relative flex flex-1 min-h-[120px] bg-neutral-950 font-mono text-xs overflow-hidden">
                        <div className="select-none py-2 px-2.5 text-right text-neutral-600 border-r border-neutral-850 bg-neutral-950 leading-relaxed font-mono whitespace-pre text-[11px] min-w-[34px]">
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

                    <div className="px-3 py-1 bg-neutral-950 border-t border-neutral-850 text-xs font-mono flex items-center justify-between shrink-0">
                        {currentCompResult && !currentCompResult.success ? (
                            <div className="flex items-center gap-1.5 text-rose-400 truncate">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">
                                    Linha {currentCompResult.errors[0].line}, Coluna{" "}
                                    {currentCompResult.errors[0].column}: {currentCompResult.errors[0].message}
                                </span>
                            </div>
                        ) : (
                            <span className="text-[11px] text-neutral-500">Nenhum erro detectado</span>
                        )}

                        <span className="text-[11px] text-neutral-500 shrink-0">
                            {lineCount} {lineCount === 1 ? "linha" : "linhas"}
                        </span>
                    </div>
                </div>
            ) : null}
        </div>
    );
};
