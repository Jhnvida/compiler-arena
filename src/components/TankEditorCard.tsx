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
    setName: (name: string) => void;
    color: string;
    setColor: (color: string) => void;
    code: string;
    setCode: (code: string) => void;
    compilationResult: CompilationResult | null;
    onInspect: () => void;
    onRemove?: () => void;
    canRemove: boolean;
}

const PRESET_OPTIONS = [
    { label: "🎯 Hunter (Referência Professor)", value: "hunter", code: PRESET_HUNTER },
    { label: "🔭 Sniper Scout (Longo Alcance)", value: "sniper", code: PRESET_SNIPER },
    { label: "⚡ Aggressive Striker (Ofensivo)", value: "striker", code: PRESET_STRIKER },
    { label: "🛡️ Wandering Patrol (Patrulheiro)", value: "patrol", code: PRESET_PATROL },
    { label: "✨ Demo de Otimizações", value: "opt", code: PRESET_OPTIMIZATION_DEMO },
    { label: "🐛 Demo de Diagnósticos de Erros", value: "errors", code: PRESET_ERRORS_DEMO },
];

const COLOR_PALETTE = [
    "#06b6d4",
    "#f97316",
    "#10b981",
    "#ec4899",
    "#8b5cf6",
    "#eab308",
];

export const TankEditorCard: React.FC<TankEditorCardProps> = ({
    tankIndex,
    name,
    setName,
    color,
    setColor,
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
        <div className="flex flex-col bg-slate-900/80 backdrop-blur-md border border-slate-700/80 rounded-xl overflow-hidden shadow-xl transition-all duration-300 hover:border-slate-600">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-950/70 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <div
                            className="w-5 h-5 rounded-full border-2 border-white/40 shadow-sm cursor-pointer"
                            style={{ backgroundColor: color }}
                            title="Clique para escolher a cor"
                        />
                        <div className="absolute left-0 top-7 hidden group-hover:flex items-center gap-1.5 p-1.5 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-20">
                            {COLOR_PALETTE.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`w-4 h-4 rounded-full border cursor-pointer ${
                                        color === c ? "border-white scale-110" : "border-transparent"
                                    }`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={`Tanque #${tankIndex + 1}`}
                            className="text-sm font-bold bg-transparent text-white border-b border-transparent hover:border-slate-600 focus:border-cyan-400 focus:outline-none transition-colors px-1"
                        />
                        <span className="text-[10px] text-slate-400 px-1">Tanque #{tankIndex + 1}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {canRemove && onRemove && (
                        <button
                            type="button"
                            onClick={onRemove}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors text-xs cursor-pointer"
                            title="Remover Tanque"
                        >
                            🗑️
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onInspect}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 transition-colors shadow-sm cursor-pointer"
                    >
                        <span>⚙️</span>
                        <span>Inspecionar</span>
                    </button>
                </div>
            </div>

            <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/60 flex items-center justify-between gap-3 text-xs">
                <label className="text-slate-400 font-medium whitespace-nowrap">Script:</label>
                <select
                    value={selectedPreset}
                    onChange={handlePresetChange}
                    className="flex-1 bg-slate-800/90 text-slate-200 border border-slate-700 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-cyan-400 transition-colors cursor-pointer"
                >
                    <option value="custom">✍️ Script Personalizado</option>
                    {PRESET_OPTIONS.map((p) => (
                        <option key={p.value} value={p.value}>
                            {p.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="relative flex flex-1 min-h-[220px] max-h-[340px] bg-slate-950/90 font-mono text-xs overflow-hidden">
                <div className="select-none py-3 px-2 text-right text-slate-600 border-r border-slate-800/80 bg-slate-950/60 leading-relaxed font-mono whitespace-pre text-[11px] min-w-[32px]">
                    {lineNumbers}
                </div>

                <textarea
                    value={code}
                    onChange={(e) => {
                        setCode(e.target.value);
                        setSelectedPreset("custom");
                    }}
                    spellCheck={false}
                    className="flex-1 p-3 bg-transparent text-slate-200 focus:outline-none resize-none leading-relaxed font-mono text-[11px] whitespace-pre overflow-y-auto"
                    placeholder="robot MyTank { ... }"
                />
            </div>

            <div className="px-4 py-2 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between text-xs">
                {compilationResult ? (
                    compilationResult.success ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                            <span>✓</span>
                            <span>Bytecode Pronto ({compilationResult.bytecode?.instructions.length} instrs)</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-rose-400 font-medium">
                            <span>⚠️</span>
                            <span>{compilationResult.errors[0]?.message.slice(0, 38)}...</span>
                        </div>
                    )
                ) : (
                    <span className="text-slate-500">Aguardando compilação</span>
                )}

                <span className="text-[10px] text-slate-500">{lineCount} linhas</span>
            </div>
        </div>
    );
};
