import { ArrowLeft, Eye, RotateCcw, Scale, Trophy } from "lucide-react";
import React from "react";
import type { SimulationSnapshot } from "../simulation/types.ts";

interface WinnerModalProps {
    snapshot: SimulationSnapshot;
    onRestart: () => void;
    onReturnToMenu: () => void;
    onViewArena?: () => void;
}

export const WinnerModal: React.FC<WinnerModalProps> = ({ snapshot, onRestart, onReturnToMenu, onViewArena }) => {
    if (snapshot.status !== "finished") return null;

    const winner = snapshot.winner;
    const isDraw = snapshot.isDraw || !winner;

    const accuracy = winner
        ? winner.stats.shotsFired > 0
            ? Math.round((winner.stats.shotsHit / winner.stats.shotsFired) * 100)
            : 0
        : 0;

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl overflow-hidden p-5 text-center text-neutral-100">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center bg-neutral-800 border border-neutral-700 text-neutral-300">
                    {isDraw ? (
                        <Scale className="w-6 h-6 text-neutral-400" />
                    ) : (
                        <Trophy className="w-6 h-6 text-amber-400" />
                    )}
                </div>

                <h2 className="text-base font-bold tracking-tight mb-1">
                    {isDraw ? "Empate Técnico" : "Vitória na Arena"}
                </h2>

                {isDraw ? (
                    <p className="text-xs text-neutral-400 mb-4">
                        Todos os tanques foram destruídos ou a partida atingiu o tempo limite com energia equivalente.
                    </p>
                ) : (
                    <div className="mb-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-950 border border-neutral-800 mb-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: winner.color }} />
                            <span className="text-xs font-semibold text-white">{winner.name}</span>
                        </div>
                        <p className="text-[11px] text-neutral-400">
                            Sobreviveu ao combate e superou todos os adversários na arena.
                        </p>
                    </div>
                )}

                {winner && (
                    <div className="grid grid-cols-3 gap-2 p-3 bg-neutral-950 rounded border border-neutral-800 mb-4 text-xs font-mono">
                        <div>
                            <span className="text-neutral-500 text-[10px] block font-sans">Energia</span>
                            <span className="text-sm font-bold text-emerald-400">{winner.energy} HP</span>
                        </div>
                        <div>
                            <span className="text-neutral-500 text-[10px] block font-sans">Precisão</span>
                            <span className="text-sm font-bold text-neutral-200">{accuracy}%</span>
                        </div>
                        <div>
                            <span className="text-neutral-500 text-[10px] block font-sans">Dano Total</span>
                            <span className="text-sm font-bold text-neutral-200">{winner.stats.damageDealt}</span>
                        </div>
                        <div>
                            <span className="text-neutral-500 text-[10px] block font-sans">Disparos</span>
                            <span className="text-xs font-semibold text-neutral-300">{winner.stats.shotsFired}</span>
                        </div>
                        <div>
                            <span className="text-neutral-500 text-[10px] block font-sans">Acertos</span>
                            <span className="text-xs font-semibold text-neutral-300">{winner.stats.shotsHit}</span>
                        </div>
                        <div>
                            <span className="text-neutral-500 text-[10px] block font-sans">Eliminações</span>
                            <span className="text-xs font-semibold text-neutral-300">{winner.stats.kills}</span>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onRestart}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Nova Revanche</span>
                        </button>

                        <button
                            type="button"
                            onClick={onReturnToMenu}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Menu / Editor</span>
                        </button>
                    </div>

                    {onViewArena && (
                        <button
                            type="button"
                            onClick={onViewArena}
                            className="flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded text-xs font-medium text-neutral-400 hover:text-white bg-neutral-950/60 hover:bg-neutral-950 border border-neutral-800 transition-colors cursor-pointer"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Observar Arena</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
