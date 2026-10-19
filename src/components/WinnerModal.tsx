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
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-300">
            <div className="w-full max-w-md bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-6 text-center text-white backdrop-blur-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-gradient-to-tr from-amber-500/20 to-yellow-400/20 border border-yellow-500/40 text-3xl shadow-lg shadow-amber-500/10">
                    {isDraw ? "⚖️" : "🏆"}
                </div>

                <h2 className="text-2xl font-black tracking-tight mb-1">
                    {isDraw ? "Empate Técnico!" : "Vitória na Arena!"}
                </h2>

                {isDraw ? (
                    <p className="text-sm text-slate-400 mb-6">
                        Todos os tanques foram destruídos ou a partida atingiu o tempo limite com energia equivalente.
                    </p>
                ) : (
                    <div className="mb-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 mb-2">
                            <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: winner.color }} />
                            <span className="text-sm font-bold text-white">{winner.name}</span>
                        </div>
                        <p className="text-xs text-slate-400">
                            O robô sobreviveu ao combate e superou todos os adversários na simulação.
                        </p>
                    </div>
                )}

                {winner && (
                    <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 mb-6 text-xs">
                        <div>
                            <span className="text-slate-400 text-[10px]">Energia Final</span>
                            <p className="text-base font-bold text-emerald-400">{winner.energy} HP</p>
                        </div>
                        <div>
                            <span className="text-slate-400 text-[10px]">Precisão</span>
                            <p className="text-base font-bold text-cyan-400">{accuracy}%</p>
                        </div>
                        <div>
                            <span className="text-slate-400 text-[10px]">Dano Total</span>
                            <p className="text-base font-bold text-amber-400">{winner.stats.damageDealt}</p>
                        </div>
                        <div>
                            <span className="text-slate-400 text-[10px]">Disparos</span>
                            <p className="text-sm font-semibold text-slate-200">{winner.stats.shotsFired}</p>
                        </div>
                        <div>
                            <span className="text-slate-400 text-[10px]">Acertos</span>
                            <p className="text-sm font-semibold text-slate-200">{winner.stats.shotsHit}</p>
                        </div>
                        <div>
                            <span className="text-slate-400 text-[10px]">Eliminações</span>
                            <p className="text-sm font-semibold text-purple-400">{winner.stats.kills}</p>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onRestart}
                            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                        >
                            🔄 Nova Revanche
                        </button>

                        <button
                            type="button"
                            onClick={onReturnToMenu}
                            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
                        >
                            ⚙ Editor / Menu
                        </button>
                    </div>

                    {onViewArena && (
                        <button
                            type="button"
                            onClick={onViewArena}
                            className="w-full py-2 px-3 rounded-lg text-xs font-medium text-cyan-300 bg-cyan-950/40 hover:bg-cyan-950/80 border border-cyan-800/50 transition-colors cursor-pointer"
                        >
                            👁️ Observar Tanque Vencedor na Arena 3D
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
