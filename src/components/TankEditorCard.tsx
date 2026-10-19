import { AlertCircle, CheckCircle2, ChevronDown, FileCode, Terminal, Trash2 } from "lucide-react";
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

interface TankEditorCardProps {
    tankIndex: number;
    name: string;
    color: string;
    code: string;
    setCode: (code: string) => void;
    compilationResult: CompilationResult | null;
    onInspect: () => void;
    onRemove?: () => void;
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

export const TankEditorCard: React.FC<TankEditorCardProps> = ({
    tankIndex,
    name,
    color,
    code,
    setCode,
    compilationResult,
    onInspect,
    onRemove,
    canRemove,
}) => {
    const [selectedPreset, setSelectedPreset] = useState<string>("custom");

    const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedPreset(val);
        const found = PRESET_OPTIONS.find((p) => p.value === val);
        if (found) {
            setCode(found.code);
        }
    };

    const lineCount = code.split("\n").length;
    const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join("\n");

    return (
        <div className="flex flex-col bg-neutral-900/95 border border-neutral-800 rounded-lg overflow-hidden shadow-sm transition-all duration-200 hover:border-neutral-700 min-w-[280px]">
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-neutral-950/80 border-b border-neutral-800">
                <div className="flex items-center gap-2.5">
                    <div
                        className="w-3.5 h-3.5 rounded-full border border-neutral-600/80 shadow-xs shrink-0"
                        style={{ backgroundColor: color }}
                        title={`Cor do ${name}`}
                    />

                    <div className="flex flex-col">
                        <span className="text-xs font-semibold text-neutral-100">
                            {name}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">Tanque #{tankIndex + 1}</span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onInspect}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition-colors cursor-pointer"
                        title="Abrir Inspetor de Compilação"
                    >
                        <Terminal className="w-3 h-3 text-neutral-400" />
                        <span>Inspetor</span>
                    </button>

                    {canRemove && onRemove && (
                        <button
                            type="button"
                            onClick={onRemove}
                            className="p-1 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                            title="Remover Tanque"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="px-3 py-1.5 bg-neutral-950/40 border-b border-neutral-800/80 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-neutral-400 text-[11px]">
                    <FileCode className="w-3 h-3 text-neutral-500" />
                    <span>Script:</span>
                </div>
                <div className="relative flex-1">
                    <select
                        value={selectedPreset}
                        onChange={handlePresetChange}
                        className="w-full appearance-none bg-neutral-800/90 text-neutral-200 border border-neutral-700/80 rounded px-2 py-0.5 pr-6 text-[11px] focus:outline-none focus:border-neutral-500 transition-colors cursor-pointer"
                    >
                        <option value="custom">Personalizado</option>
                        {PRESET_OPTIONS.map((p) => (
                            <option key={p.value} value={p.value}>
                                {p.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="w-3 h-3 text-neutral-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
            </div>

            <div className="relative flex flex-1 min-h-[160px] max-h-[220px] bg-neutral-950/90 font-mono text-xs overflow-hidden">
                <div className="select-none py-2 px-2 text-right text-neutral-600 border-r border-neutral-800/80 bg-neutral-950/60 leading-relaxed font-mono whitespace-pre text-[10px] min-w-[28px]">
                    {lineNumbers}
                </div>

                <textarea
                    value={code}
                    onChange={(e) => {
                        setCode(e.target.value);
                        setSelectedPreset("custom");
                    }}
                    spellCheck={false}
                    className="flex-1 p-2 bg-transparent text-neutral-200 focus:outline-none resize-none leading-relaxed font-mono text-[11px] whitespace-pre overflow-y-auto"
                    placeholder="robot MeuTanque { ... }"
                />
            </div>

            <div className="px-3 py-1.5 bg-neutral-950/80 border-t border-neutral-800 flex items-center justify-between text-[11px]">
                {compilationResult ? (
                    compilationResult.success ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span className="truncate">
                                Bytecode ({compilationResult.bytecode?.instructions.length} instrs)
                            </span>
                        </div>
                    ) : (
                        <div
                            className="flex items-center gap-1.5 text-rose-400 font-medium truncate max-w-[190px]"
                            title={compilationResult.errors[0]?.message}
                        >
                            <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                            <span className="truncate">{compilationResult.errors[0]?.message}</span>
                        </div>
                    )
                ) : (
                    <span className="text-neutral-500 text-[10px]">Aguardando compilação</span>
                )}

                <span className="text-[10px] text-neutral-500 font-mono">{lineCount} lin</span>
            </div>
        </div>
    );
};
