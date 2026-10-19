import React, { useEffect, useRef, useState } from "react";
import type { SimulationSnapshot } from "../simulation/types.ts";

interface BattleHUDProps {
    snapshot: SimulationSnapshot;
    speed: number;
    setSpeed: (speed: number) => void;
    isPaused: boolean;
    onTogglePause: () => void;
    onStep: () => void;
    onRestart: () => void;
    onReturnToMenu: () => void;
    onOpenWinnerModal?: () => void;
}

const SPEED_OPTIONS = [0.5, 1, 2, 5, 10];

export const BattleHUD: React.FC<BattleHUDProps> = ({
    snapshot,
    speed,
    setSpeed,
    isPaused,
    onTogglePause,
    onStep,
    onRestart,
    onReturnToMenu,
    onOpenWinnerModal,
}) => {
    const [logExpanded, setLogExpanded] = useState(true);
    const logContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [snapshot.recentEvents]);

    const aliveTanksCount = snapshot.tanks.filter((t) => t.isAlive).length;

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-30 select-none">
            <header className="pointer-events-auto flex items-center justify-between gap-4 p-3 bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">⚔️</span>
                        <div>
                            <h1 className="text-sm font-black tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">
                                Compiler Arena 3D
                            </h1>
                            <p className="text-[10px] text-slate-400 font-mono">
                                {aliveTanksCount} / {snapshot.tanks.length} Tanques Ativos
                            </p>
                        </div>
                    </div>

                    <div className="h-6 w-px bg-slate-800" />

                    <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800 text-xs font-mono">
                        <span className="text-slate-400">Tick:</span>
                        <span className="text-cyan-400 font-bold">{snapshot.tick}</span>
                        <span className="text-slate-500 text-[10px]">/ {snapshot.config.maxTicks}</span>
                    </div>

                    <span
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                            snapshot.status === "running"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : snapshot.status === "paused"
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                  : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                        }`}
                    >
                        {snapshot.status === "running"
                            ? "● Em Combate"
                            : snapshot.status === "paused"
                              ? "❚❚ Pausado"
                              : "★ Finalizado"}
                    </span>

                    {snapshot.status === "finished" && onOpenWinnerModal && (
                        <button
                            type="button"
                            onClick={onOpenWinnerModal}
                            className="px-3 py-1 text-xs font-bold rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-md shadow-amber-500/20 hover:brightness-110 transition-all cursor-pointer animate-pulse"
                        >
                            🏆 Ver Estatísticas Finais
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onTogglePause}
                        className={`px-4 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                            isPaused
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-emerald-950/40"
                                : "bg-amber-600 hover:bg-amber-500 text-white border-amber-500 shadow-amber-950/40"
                        }`}
                    >
                        {isPaused ? "▶ Retomar" : "❚❚ Pausar"}
                    </button>

                    <button
                        type="button"
                        onClick={onStep}
                        disabled={!isPaused && snapshot.status === "running"}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Avançar 1 Tick"
                    >
                        ⏭ Passo
                    </button>

                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
                        {SPEED_OPTIONS.map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setSpeed(s)}
                                className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                                    speed === s
                                        ? "bg-cyan-500 text-slate-950 font-bold"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                {s}x
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onRestart}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                        title="Reiniciar partida com os mesmos scripts"
                    >
                        🔄 Reiniciar
                    </button>

                    <button
                        type="button"
                        onClick={onReturnToMenu}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 transition-colors cursor-pointer"
                    >
                        ⚙ Editor / Menu
                    </button>
                </div>
            </header>

            <footer className="pointer-events-auto flex items-end justify-between gap-4">
                <div className="flex flex-col gap-2 max-w-sm w-full">
                    {snapshot.tanks.map((tank) => {
                        const hpRatio = Math.max(0, Math.min(1, tank.energy / tank.maxEnergy));
                        const hpPercent = Math.round(hpRatio * 100);

                        return (
                            <div
                                key={tank.id}
                                className={`p-3 rounded-xl border backdrop-blur-md transition-all ${
                                    tank.isAlive
                                        ? "bg-slate-950/80 border-slate-800 shadow-lg"
                                        : "bg-slate-950/40 border-slate-900 opacity-60"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="w-3.5 h-3.5 rounded-full shadow-sm"
                                            style={{ backgroundColor: tank.color }}
                                        />
                                        <span className="text-xs font-bold text-white tracking-wide">{tank.name}</span>
                                    </div>

                                    <div className="flex items-center gap-2 text-[11px] font-mono">
                                        {tank.lastAction && tank.isAlive ? (
                                            <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px] font-bold uppercase">
                                                {tank.lastAction.type} {tank.lastAction.value ?? ""}
                                            </span>
                                        ) : null}
                                        <span
                                            className={`font-bold ${
                                                hpPercent > 50
                                                    ? "text-emerald-400"
                                                    : hpPercent > 25
                                                      ? "text-amber-400"
                                                      : "text-rose-400"
                                            }`}
                                        >
                                            {tank.isAlive ? `${hpPercent} HP` : "💀 DESTRUÍDO"}
                                        </span>
                                    </div>
                                </div>

                                <div className="w-full h-2.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50">
                                    <div
                                        className={`h-full transition-all duration-300 rounded-full ${
                                            hpPercent > 50
                                                ? "bg-gradient-to-r from-emerald-500 to-green-400"
                                                : hpPercent > 25
                                                  ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                                                  : "bg-gradient-to-r from-rose-600 to-red-500"
                                        }`}
                                        style={{ width: `${hpPercent}%` }}
                                    />
                                </div>

                                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 font-mono">
                                    <span>Disparos: {tank.stats.shotsFired}</span>
                                    <span>Acertos: {tank.stats.shotsHit}</span>
                                    <span>Dano: {tank.stats.damageDealt}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div
                    className={`flex flex-col bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl transition-all duration-300 ${
                        logExpanded ? "w-96 h-56" : "w-72 h-10"
                    }`}
                >
                    <div
                        onClick={() => setLogExpanded(!logExpanded)}
                        className="flex items-center justify-between px-3 py-2 bg-slate-900/60 border-b border-slate-800 cursor-pointer text-xs"
                    >
                        <div className="flex items-center gap-2 font-bold text-slate-300">
                            <span>📡</span>
                            <span>Log de Combate ({snapshot.recentEvents.length})</span>
                        </div>
                        <button type="button" className="text-slate-400 hover:text-white text-xs">
                            {logExpanded ? "▼" : "▲"}
                        </button>
                    </div>

                    {logExpanded && (
                        <div
                            ref={logContainerRef}
                            className="flex-1 p-2.5 overflow-y-auto space-y-1.5 font-mono text-[11px] leading-relaxed"
                        >
                            {snapshot.recentEvents.length === 0 ? (
                                <p className="text-slate-500 italic text-[10px]">Aguardando eventos...</p>
                            ) : (
                                snapshot.recentEvents.map((ev) => (
                                    <div
                                        key={ev.id}
                                        className={`px-2 py-1 rounded text-[10px] border ${
                                            ev.type === "projectile_hit_tank"
                                                ? "bg-rose-950/40 text-rose-300 border-rose-900/40"
                                                : ev.type === "tank_destroyed"
                                                  ? "bg-purple-950/60 text-purple-300 border-purple-800/60 font-bold"
                                                  : ev.type === "tank_fire"
                                                    ? "bg-amber-950/30 text-amber-300 border-amber-900/30"
                                                    : ev.type === "battle_end"
                                                      ? "bg-emerald-950/60 text-emerald-300 border-emerald-800 font-bold"
                                                      : "bg-slate-900/40 text-slate-300 border-slate-800/60"
                                        }`}
                                    >
                                        <span className="text-slate-500 mr-1.5">[{ev.tick}]</span>
                                        {ev.message}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </footer>
        </div>
    );
};
