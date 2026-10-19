import {
    Activity,
    ChevronDown,
    ChevronUp,
    Crosshair,
    Pause,
    Play,
    RotateCcw,
    ScrollText,
    Sliders,
    StepForward,
    Trophy,
} from "lucide-react";
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
    const [logExpanded, setLogExpanded] = useState(false);
    const logContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [snapshot.recentEvents]);

    const aliveTanksCount = snapshot.tanks.filter((t) => t.isAlive).length;

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-30 select-none">
            <header className="pointer-events-auto flex items-center justify-between gap-3 p-2.5 bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-lg shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-500" />
                        <div>
                            <h1 className="text-xs font-bold tracking-wider uppercase text-neutral-100">
                                Compiler Arena
                            </h1>
                            <p className="text-[10px] text-neutral-400 font-mono">
                                {aliveTanksCount} / {snapshot.tanks.length} ativos
                            </p>
                        </div>
                    </div>

                    <div className="h-5 w-px bg-neutral-800" />

                    <div className="flex items-center gap-1.5 bg-neutral-950 px-2.5 py-1 rounded border border-neutral-800 text-[11px] font-mono">
                        <span className="text-neutral-500">Tick:</span>
                        <span className="text-neutral-100 font-bold">{snapshot.tick}</span>
                        <span className="text-neutral-600 text-[10px]">/{snapshot.config.maxTicks}</span>
                    </div>

                    <span
                        className={`px-2 py-0.5 text-[10px] font-medium rounded border ${
                            snapshot.status === "running"
                                ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60"
                                : snapshot.status === "paused"
                                  ? "bg-amber-950/60 text-amber-400 border-amber-800/60"
                                  : "bg-neutral-800 text-neutral-300 border-neutral-700"
                        }`}
                    >
                        {snapshot.status === "running"
                            ? "Em Combate"
                            : snapshot.status === "paused"
                              ? "Pausado"
                              : "Finalizado"}
                    </span>

                    {snapshot.status === "finished" && onOpenWinnerModal && (
                        <button
                            type="button"
                            onClick={onOpenWinnerModal}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors cursor-pointer"
                        >
                            <Trophy className="w-3.5 h-3.5 text-amber-400" />
                            <span>Ver Resultado</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onTogglePause}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded border transition-colors cursor-pointer ${
                            isPaused
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600"
                                : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700"
                        }`}
                    >
                        {isPaused ? (
                            <Play className="w-3.5 h-3.5 fill-current" />
                        ) : (
                            <Pause className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span>{isPaused ? "Retomar" : "Pausar"}</span>
                    </button>

                    <button
                        type="button"
                        onClick={onStep}
                        disabled={!isPaused && snapshot.status === "running"}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Avançar 1 Tick"
                    >
                        <StepForward className="w-3.5 h-3.5" />
                        <span>Passo</span>
                    </button>

                    <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded p-0.5 text-xs font-mono">
                        {SPEED_OPTIONS.map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setSpeed(s)}
                                className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                                    speed === s
                                        ? "bg-neutral-700 text-white font-semibold"
                                        : "text-neutral-400 hover:text-neutral-200"
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
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors cursor-pointer"
                        title="Reiniciar partida com os mesmos scripts"
                    >
                        <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Reiniciar</span>
                    </button>

                    <button
                        type="button"
                        onClick={onReturnToMenu}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors cursor-pointer"
                    >
                        <Sliders className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Menu / Editor</span>
                    </button>
                </div>
            </header>

            <footer className="pointer-events-auto flex items-end justify-between gap-4">
                <div
                    className={`grid gap-2 w-full max-h-[300px] overflow-y-auto pr-1 ${
                        snapshot.tanks.length <= 4
                            ? "grid-cols-1 max-w-sm"
                            : "grid-cols-2 max-w-xl lg:max-w-2xl"
                    }`}
                >
                    {snapshot.tanks.map((tank) => {
                        const hpRatio = Math.max(0, Math.min(1, tank.energy / tank.maxEnergy));
                        const hpPercent = Math.round(hpRatio * 100);
                        const isCompact = snapshot.tanks.length > 4;

                        return (
                            <div
                                key={tank.id}
                                className={`rounded-lg border backdrop-blur-md transition-all ${
                                    isCompact ? "p-2" : "p-2.5"
                                } ${
                                    tank.isAlive
                                        ? "bg-neutral-900/90 border-neutral-800 shadow-sm"
                                        : "bg-neutral-950/60 border-neutral-900 opacity-50"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <span
                                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm border border-white/20"
                                            style={{ backgroundColor: tank.color }}
                                        />
                                        <span className="text-xs font-semibold text-neutral-100 truncate">
                                            {tank.name}
                                        </span>
                                        <span
                                            className={`px-1 py-0.2 text-[8px] font-semibold tracking-wider uppercase border rounded ${
                                                tank.isAlive
                                                    ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/80"
                                                    : "bg-neutral-900 text-neutral-400 border-neutral-800"
                                            }`}
                                        >
                                            {tank.isAlive ? "Ativo" : "Morto"}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1 text-[11px] font-mono shrink-0">
                                        {tank.lastAction && tank.isAlive ? (
                                            <span className="px-1 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 text-[9px] uppercase">
                                                {tank.lastAction.type}
                                            </span>
                                        ) : null}
                                        <span
                                            className={`font-semibold ${
                                                hpPercent > 50
                                                    ? "text-emerald-400"
                                                    : hpPercent > 25
                                                      ? "text-amber-400"
                                                      : "text-rose-400"
                                            }`}
                                        >
                                            {tank.isAlive ? `${tank.energy} HP` : "0 HP"}
                                        </span>
                                    </div>
                                </div>

                                <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800/80">
                                    <div
                                        className={`h-full transition-all duration-150 rounded-full ${
                                            hpPercent > 50
                                                ? "bg-emerald-500"
                                                : hpPercent > 25
                                                  ? "bg-amber-500"
                                                  : "bg-rose-500"
                                        }`}
                                        style={{ width: `${tank.isAlive ? hpPercent : 0}%` }}
                                    />
                                </div>

                                {!isCompact && (
                                    <div className="flex items-center justify-between mt-1 text-[10px] text-neutral-500 font-mono">
                                        <div className="flex items-center gap-1">
                                            <Crosshair className="w-3 h-3 text-neutral-600" />
                                            <span>{tank.stats.kills} elim</span>
                                        </div>
                                        <span>
                                            Tiros: {tank.stats.shotsFired} ({tank.stats.shotsHit})
                                        </span>
                                        <span>Dano: {tank.stats.damageDealt}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div
                    className={`flex flex-col bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-lg shadow-sm transition-all duration-200 ${
                        logExpanded ? "w-80 sm:w-96 h-52" : "w-64 h-8"
                    }`}
                >
                    <div
                        onClick={() => setLogExpanded(!logExpanded)}
                        className="flex items-center justify-between px-3 py-1.5 bg-neutral-950/60 border-b border-neutral-800 cursor-pointer text-xs"
                    >
                        <div className="flex items-center gap-1.5 font-medium text-neutral-300">
                            <ScrollText className="w-3.5 h-3.5 text-neutral-400" />
                            <span>Log de Combate ({snapshot.recentEvents.length})</span>
                        </div>
                        <button type="button" className="text-neutral-400 hover:text-white">
                            {logExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                                <ChevronUp className="w-3.5 h-3.5" />
                            )}
                        </button>
                    </div>

                    {logExpanded && (
                        <div
                            ref={logContainerRef}
                            className="flex-1 p-2 overflow-y-auto space-y-1 font-mono text-[10px] leading-relaxed"
                        >
                            {snapshot.recentEvents.length === 0 ? (
                                <p className="text-neutral-500 italic">Aguardando eventos...</p>
                            ) : (
                                snapshot.recentEvents.map((ev) => (
                                    <div
                                        key={ev.id}
                                        className={`px-2 py-0.5 rounded border text-[10px] ${
                                            ev.type === "projectile_hit_tank"
                                                ? "bg-rose-950/30 text-rose-300 border-rose-900/40"
                                                : ev.type === "tank_destroyed"
                                                  ? "bg-rose-950/50 text-rose-200 border-rose-800/50 font-bold"
                                                  : ev.type === "tank_fire"
                                                    ? "bg-amber-950/20 text-amber-300 border-amber-900/30"
                                                    : ev.type === "battle_end"
                                                      ? "bg-neutral-800 text-neutral-200 border-neutral-700 font-bold"
                                                      : "bg-neutral-950 text-neutral-400 border-neutral-800/80"
                                        }`}
                                    >
                                        <span className="text-neutral-500 mr-1.5 font-mono">[{ev.tick}]</span>
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
