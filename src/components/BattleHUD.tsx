import {
    ChevronRight,
    History,
    Pause,
    Play,
    RotateCcw,
    Sliders,
    StepForward,
    Trophy,
    Volume2,
    VolumeX,
    X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { soundManager } from "../audio/soundManager.ts";
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
}

interface KillfeedItem {
    id: string;
    tick: number;
    type: "hit" | "kill";
    attackerName?: string;
    attackerColor?: string;
    targetName?: string;
    targetColor?: string;
    sourceType?: "tank" | "arena" | "unknown";
    damage?: number;
    timestamp: number;
}

const SPEED_OPTIONS = [0.5, 1, 2, 5, 10];

function getActionLabelPtBr(type: string): string {
    switch (type.toLowerCase()) {
        case "fire":
            return "Disparando";
        case "move":
            return "Avançando";
        case "back":
            return "Recuando";
        case "rotate":
            return "Girando";
        case "scan":
            return "Varredura";
        default:
            return type;
    }
}

function getEventTypeLabelPtBr(type: string): string {
    switch (type) {
        case "tank_destroyed":
            return "Baixa de Combate";
        case "projectile_hit_tank":
            return "Acerto de Projétil";
        case "battle_end":
            return "Fim de Combate";
        case "tank_spawn":
            return "Entrada na Arena";
        case "tank_fire":
            return "Disparo de Canhão";
        case "tank_scan":
            return "Varredura de Radar";
        case "tank_collide_obstacle":
            return "Colisão de Obstáculo";
        default:
            return type;
    }
}

const GhostHealthBar: React.FC<{
    energy: number;
    maxEnergy: number;
    isAlive: boolean;
}> = ({ energy, maxEnergy, isAlive }) => {
    const [ghostHp, setGhostHp] = useState(energy);
    const prevHpRef = useRef(energy);

    useEffect(() => {
        if (!isAlive) {
            prevHpRef.current = 0;
            return;
        }

        if (energy < prevHpRef.current) {
            const timer = setTimeout(() => {
                setGhostHp(energy);
            }, 380);
            prevHpRef.current = energy;
            return () => clearTimeout(timer);
        }

        if (energy > prevHpRef.current) {
            prevHpRef.current = energy;
            const timer = setTimeout(() => {
                setGhostHp(energy);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [energy, isAlive]);

    const effectiveGhost = isAlive ? ghostHp : 0;
    const hpRatio = Math.max(0, Math.min(1, energy / maxEnergy));
    const hpPercent = Math.round(hpRatio * 100);

    const ghostRatio = Math.max(0, Math.min(1, effectiveGhost / maxEnergy));
    const ghostPercent = Math.round(ghostRatio * 100);

    return (
        <div className="relative w-full h-1.5 bg-neutral-900 rounded-xs overflow-hidden border border-neutral-800/80">
            <div
                className="absolute top-0 left-0 h-full bg-rose-500/70 transition-all duration-300 rounded-xs"
                style={{ width: `${isAlive ? ghostPercent : 0}%` }}
            />
            <div
                className={`absolute top-0 left-0 h-full transition-all duration-100 rounded-xs ${
                    hpPercent > 50
                        ? "bg-emerald-500"
                        : hpPercent > 25
                          ? "bg-amber-500"
                          : "bg-rose-500 animate-critical-pulse"
                }`}
                style={{ width: `${isAlive ? hpPercent : 0}%` }}
            />
        </div>
    );
};

export const BattleHUD: React.FC<BattleHUDProps> = ({
    snapshot,
    speed,
    setSpeed,
    isPaused,
    onTogglePause,
    onStep,
    onRestart,
    onReturnToMenu,
}) => {
    const [audioSettings, setAudioSettings] = useState(() => soundManager.getSettings());
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);
    const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
    const [killfeed, setKillfeed] = useState<KillfeedItem[]>([]);
    const processedEventIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        return soundManager.subscribe((settings) => {
            setAudioSettings(settings);
        });
    }, []);

    useEffect(() => {
        const events = snapshot.recentEvents;
        if (!events || events.length === 0) return;

        const newItems: KillfeedItem[] = [];
        const now = Date.now();

        for (let i = 0; i < events.length; i++) {
            const ev = events[i];
            if (processedEventIds.current.has(ev.id)) continue;
            processedEventIds.current.add(ev.id);

            if (ev.type === "tank_destroyed") {
                const victimId = ev.victimId ?? ev.targetTankId ?? ev.tankId;
                const victim = snapshot.tanks.find((t) => t.id === victimId);
                const killerId = ev.attackerId;
                const killer = killerId ? snapshot.tanks.find((t) => t.id === killerId) : undefined;
                const sourceType: "tank" | "arena" | "unknown" = ev.sourceType ?? (killer ? "tank" : "unknown");

                newItems.push({
                    id: ev.id,
                    tick: ev.tick,
                    type: "kill",
                    attackerName: killer?.name,
                    attackerColor: killer?.color,
                    targetName: victim?.name ?? "Robô",
                    targetColor: victim?.color,
                    sourceType,
                    timestamp: now,
                });
            } else if (ev.type === "projectile_hit_tank") {
                const targetId = ev.victimId ?? ev.targetTankId;
                const target = snapshot.tanks.find((t) => t.id === targetId);
                const attackerId = ev.attackerId ?? ev.tankId;
                const attacker = snapshot.tanks.find((t) => t.id === attackerId);
                newItems.push({
                    id: ev.id,
                    tick: ev.tick,
                    type: "hit",
                    attackerName: attacker?.name,
                    attackerColor: attacker?.color,
                    targetName: target?.name ?? "Robô",
                    targetColor: target?.color,
                    sourceType: attacker ? "tank" : "unknown",
                    damage: ev.value,
                    timestamp: now,
                });
            }
        }

        if (newItems.length > 0) {
            const timer = setTimeout(() => {
                setKillfeed((prev) => [...prev, ...newItems].slice(-5));
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [snapshot.recentEvents, snapshot.tanks]);

    useEffect(() => {
        if (killfeed.length === 0) return;
        const interval = setInterval(() => {
            const now = Date.now();
            setKillfeed((prev) => prev.filter((item) => now - item.timestamp < 3800));
        }, 500);
        return () => clearInterval(interval);
    }, [killfeed.length]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                e.target instanceof HTMLSelectElement
            ) {
                return;
            }

            if (e.code === "Space") {
                e.preventDefault();
                soundManager.playUiClick();
                onTogglePause();
            } else if (e.code === "KeyR") {
                e.preventDefault();
                soundManager.playUiClick();
                onRestart();
            } else if (e.code === "Escape") {
                e.preventDefault();
                soundManager.playUiClick();
                onReturnToMenu();
            } else if (e.code === "KeyM") {
                e.preventDefault();
                soundManager.playUiSwitch();
                soundManager.toggleMute();
            } else if (e.code === "Digit1") {
                soundManager.playUiSwitch();
                setSpeed(0.5);
            } else if (e.code === "Digit2") {
                soundManager.playUiSwitch();
                setSpeed(1);
            } else if (e.code === "Digit3") {
                soundManager.playUiSwitch();
                setSpeed(2);
            } else if (e.code === "Digit4") {
                soundManager.playUiSwitch();
                setSpeed(5);
            } else if (e.code === "Digit5") {
                soundManager.playUiSwitch();
                setSpeed(10);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onTogglePause, onRestart, onReturnToMenu, setSpeed]);

    const aliveCount = useMemo(() => snapshot.tanks.filter((t) => t.isAlive).length, [snapshot.tanks]);
    const isShowdown = aliveCount === 2 && snapshot.tanks.length > 2 && snapshot.status === "running";
    const tickPercent = Math.min(100, Math.round((snapshot.tick / snapshot.config.maxTicks) * 100));

    const winner = snapshot.winner;
    const isDraw = snapshot.isDraw || !winner;
    const winnerAccuracy = winner
        ? winner.stats.shotsFired > 0
            ? Math.round((winner.stats.shotsHit / winner.stats.shotsFired) * 100)
            : 0
        : 0;

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-4 z-30 select-none font-sans text-neutral-100">
            <div className="relative flex items-start justify-between w-full">
                <div className="pointer-events-auto flex items-center gap-1 p-1 bg-neutral-950/90 backdrop-blur-md border border-neutral-800 rounded shadow-md z-10">
                    <button
                        type="button"
                        onClick={() => {
                            soundManager.playUiClick();
                            onTogglePause();
                        }}
                        className={`btn-compact ${
                            isPaused ? "!bg-emerald-600 hover:!bg-emerald-500 !text-white !border-transparent" : ""
                        }`}
                        title="Pausar / Retomar [Espaço]"
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
                        onClick={() => {
                            soundManager.playUiClick();
                            onStep();
                        }}
                        disabled={!isPaused && snapshot.status === "running"}
                        className="btn-icon"
                        title="Avançar 1 Ciclo [Passo]"
                    >
                        <StepForward className="w-3.5 h-3.5" />
                    </button>

                    <div className="h-3.5 w-px bg-neutral-800 mx-0.5" />

                    <div className="flex items-center bg-neutral-900 rounded p-0.5 font-mono text-[10px]">
                        {SPEED_OPTIONS.map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => {
                                    soundManager.playUiSwitch();
                                    setSpeed(s);
                                }}
                                className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                                    speed === s
                                        ? "bg-neutral-700 text-white font-bold"
                                        : "text-neutral-400 hover:text-neutral-200"
                                }`}
                                title={`Velocidade ${s}x`}
                            >
                                {s}x
                            </button>
                        ))}
                    </div>

                    <div className="h-3.5 w-px bg-neutral-800 mx-0.5" />

                    <div
                        className="relative flex items-center"
                        onMouseEnter={() => setShowVolumeSlider(true)}
                        onMouseLeave={() => setShowVolumeSlider(false)}
                    >
                        <button
                            type="button"
                            onClick={() => {
                                soundManager.playUiSwitch();
                                soundManager.toggleMute();
                            }}
                            className="btn-icon"
                            title={audioSettings.muted ? "Ativar som [M]" : "Desativar som [M]"}
                        >
                            {audioSettings.muted || audioSettings.masterVolume === 0 ? (
                                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                            ) : (
                                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                        </button>

                        {showVolumeSlider && (
                            <div className="absolute left-0 top-full mt-1 p-2 bg-neutral-950/95 border border-neutral-800 rounded shadow-xl flex items-center gap-2 z-50">
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={audioSettings.muted ? 0 : audioSettings.masterVolume}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        soundManager.setMasterVolume(val);
                                        if (audioSettings.muted && val > 0) {
                                            soundManager.setMuted(false);
                                        }
                                    }}
                                    className="w-16 h-1 bg-neutral-800 accent-emerald-500 rounded cursor-pointer"
                                />
                                <span className="text-[10px] text-neutral-400 font-mono w-6 text-right">
                                    {audioSettings.muted ? "0%" : `${Math.round(audioSettings.masterVolume * 100)}%`}
                                </span>
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            soundManager.playUiClick();
                            onRestart();
                        }}
                        className="btn-icon"
                        title="Reiniciar combate [R]"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            soundManager.playUiClick();
                            onReturnToMenu();
                        }}
                        className="btn-icon"
                        title="Voltar ao menu de robôs [Esc]"
                    >
                        <Sliders className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="pointer-events-auto flex flex-col items-end gap-1.5 w-60 max-w-[260px] z-10">
                    <button
                        type="button"
                        onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                        className="btn-compact h-7"
                        title="Ver histórico completo de combate"
                    >
                        <History className="w-3 h-3 text-neutral-400" />
                        <span>Histórico</span>
                        <ChevronRight
                            className={`w-3 h-3 transition-transform ${showHistoryDrawer ? "rotate-90" : ""}`}
                        />
                    </button>

                    <div className="flex flex-col items-end gap-1 w-full pointer-events-none">
                        {killfeed.map((item) => {
                            if (item.type === "kill") {
                                if (item.sourceType === "tank" && item.attackerName) {
                                    return (
                                        <div
                                            key={item.id}
                                            className="tactical-feed-item flex items-center justify-between gap-2 px-2.5 py-1 bg-rose-950/85 border border-rose-800/70 text-rose-100 rounded text-[11px] shadow-lg backdrop-blur-sm w-full"
                                        >
                                            <div className="flex items-center gap-1.5 truncate">
                                                {item.attackerColor && (
                                                    <span
                                                        className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: item.attackerColor }}
                                                    />
                                                )}
                                                <span className="font-semibold text-white truncate">
                                                    {item.attackerName}
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-bold text-rose-400 tracking-wider uppercase shrink-0">
                                                ☠ ELIMINOU
                                            </span>
                                            <div className="flex items-center gap-1.5 truncate">
                                                {item.targetColor && (
                                                    <span
                                                        className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: item.targetColor }}
                                                    />
                                                )}
                                                <span className="font-semibold text-rose-200 truncate">
                                                    {item.targetName}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }

                                if (item.sourceType === "arena") {
                                    return (
                                        <div
                                            key={item.id}
                                            className="tactical-feed-item flex items-center justify-between gap-2 px-2.5 py-1 bg-amber-950/80 border border-amber-800/60 text-amber-100 rounded text-[11px] shadow-lg backdrop-blur-sm w-full"
                                        >
                                            <div className="flex items-center gap-1.5 truncate">
                                                {item.targetColor && (
                                                    <span
                                                        className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: item.targetColor }}
                                                    />
                                                )}
                                                <span className="font-semibold text-white truncate">
                                                    {item.targetName}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-medium text-amber-300 tracking-wide shrink-0">
                                                foi eliminado pela arena
                                            </span>
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        key={item.id}
                                        className="tactical-feed-item flex items-center justify-between gap-2 px-2.5 py-1 bg-neutral-900/90 border border-neutral-700 text-neutral-200 rounded text-[11px] shadow-lg backdrop-blur-sm w-full"
                                    >
                                        <div className="flex items-center gap-1.5 truncate">
                                            {item.targetColor && (
                                                <span
                                                    className="w-2 h-2 rounded-full shrink-0"
                                                    style={{ backgroundColor: item.targetColor }}
                                                />
                                            )}
                                            <span className="font-semibold text-white truncate">{item.targetName}</span>
                                        </div>
                                        <span className="text-[10px] font-medium text-neutral-400 tracking-wide shrink-0">
                                            foi destruído
                                        </span>
                                    </div>
                                );
                            }

                            if (item.type === "hit") {
                                return (
                                    <div
                                        key={item.id}
                                        className="tactical-feed-item flex items-center justify-between gap-2 px-2 py-0.5 bg-neutral-950/85 border border-neutral-800 text-neutral-300 rounded text-[10px] shadow-md backdrop-blur-sm w-full font-mono"
                                    >
                                        <div className="flex items-center gap-1 truncate">
                                            {item.attackerColor && (
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                                    style={{ backgroundColor: item.attackerColor }}
                                                />
                                            )}
                                            <span className="text-neutral-200 truncate">
                                                {item.attackerName ?? "Disparo"}
                                            </span>
                                        </div>
                                        <span className="text-amber-400 font-bold shrink-0">
                                            -{item.damage ?? 20} Vida
                                        </span>
                                        <div className="flex items-center gap-1 truncate">
                                            {item.targetColor && (
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                                    style={{ backgroundColor: item.targetColor }}
                                                />
                                            )}
                                            <span className="text-neutral-300 truncate">{item.targetName}</span>
                                        </div>
                                    </div>
                                );
                            }

                            return null;
                        })}
                    </div>
                </div>
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 top-3 pointer-events-auto flex flex-col items-center z-20">
                <div className="flex items-center gap-3 px-3.5 py-1.5 bg-neutral-950/90 backdrop-blur-md border border-neutral-800 rounded shadow-md">
                    <div className="flex items-center gap-1.5">
                        <span
                            className={`w-2 h-2 rounded-full ${
                                snapshot.status === "running"
                                    ? "bg-emerald-500 animate-pulse"
                                    : snapshot.status === "paused"
                                      ? "bg-amber-400"
                                      : "bg-neutral-500"
                            }`}
                        />
                        <span className="text-[11px] font-bold tracking-wider uppercase text-neutral-200">
                            {snapshot.status === "running"
                                ? "Em Combate"
                                : snapshot.status === "paused"
                                  ? "Pausado"
                                  : "Finalizado"}
                        </span>
                    </div>

                    <div className="h-3 w-px bg-neutral-800" />

                    <div className="flex items-center gap-1 text-[11px] font-mono">
                        <span className="text-white font-bold">{aliveCount}</span>
                        <span className="text-neutral-500">/</span>
                        <span className="text-neutral-400">{snapshot.tanks.length}</span>
                        <span className="text-neutral-500 text-[10px] uppercase font-sans ml-0.5">vivos</span>
                    </div>

                    <div className="h-3 w-px bg-neutral-800" />

                    <div className="flex items-center gap-1 text-[11px] font-mono">
                        <span className="text-neutral-400 text-[10px] uppercase font-sans">Ciclo</span>
                        <span className="text-white font-semibold tabular-nums">{snapshot.tick}</span>
                        <span className="text-neutral-600 text-[10px]">/{snapshot.config.maxTicks}</span>
                    </div>
                </div>

                <div className="w-40 h-0.5 bg-neutral-900 rounded-full mt-1 overflow-hidden border border-neutral-800/50">
                    <div
                        className="h-full bg-emerald-500/80 transition-all duration-150"
                        style={{ width: `${tickPercent}%` }}
                    />
                </div>

                {isShowdown && (
                    <div className="mt-1.5 px-2.5 py-0.5 bg-amber-950/80 border border-amber-500/40 rounded text-[10px] font-bold tracking-wider uppercase text-amber-300 shadow-sm animate-critical-pulse">
                        Duelo Final (1 contra 1)
                    </div>
                )}
            </div>

            {snapshot.status === "finished" && (
                <div className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 p-5 bg-neutral-950/95 backdrop-blur-lg border border-neutral-800 rounded shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-w-sm w-full text-center z-40">
                    <div className="flex items-center justify-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-400" />
                        <h2 className="text-sm font-bold tracking-wider uppercase text-white">
                            {isDraw ? "Empate Técnico" : "Vitória na Arena"}
                        </h2>
                    </div>

                    {winner ? (
                        <div className="w-full">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-neutral-900 border border-neutral-850 rounded-full mb-3">
                                <span
                                    className="w-3 h-3 rounded-full shadow-xs"
                                    style={{ backgroundColor: winner.color }}
                                />
                                <span className="text-xs font-bold text-white tracking-wide">{winner.name}</span>
                            </div>

                            <div className="grid grid-cols-4 gap-1.5 p-2 bg-neutral-900/60 rounded border border-neutral-800 text-[11px] font-mono mb-2">
                                <div className="text-center">
                                    <span className="text-[9px] text-neutral-400 block font-sans uppercase">Vida</span>
                                    <span className="font-bold text-emerald-400">{winner.energy}</span>
                                </div>
                                <div className="text-center">
                                    <span className="text-[9px] text-neutral-400 block font-sans uppercase">
                                        Abates
                                    </span>
                                    <span className="font-bold text-amber-400">{winner.stats.kills}</span>
                                </div>
                                <div className="text-center">
                                    <span className="text-[9px] text-neutral-400 block font-sans uppercase">Dano</span>
                                    <span className="font-bold text-neutral-200">{winner.stats.damageDealt}</span>
                                </div>
                                <div className="text-center">
                                    <span className="text-[9px] text-neutral-400 block font-sans uppercase">
                                        Precisão
                                    </span>
                                    <span className="font-bold text-neutral-200">{winnerAccuracy}%</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-neutral-400 mb-2">
                            Tempo limite atingido ou aniquilação mútua de todos os robôs na arena.
                        </p>
                    )}

                    <div className="flex items-center gap-2 w-full pt-1">
                        <button
                            type="button"
                            onClick={() => {
                                soundManager.playUiClick();
                                onRestart();
                            }}
                            className="btn-primary flex-1"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Nova Revanche [R]</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                soundManager.playUiClick();
                                onReturnToMenu();
                            }}
                            className="btn-secondary flex-1"
                            title="Voltar ao menu de configuração dos robôs [Esc]"
                        >
                            <Sliders className="w-3.5 h-3.5" />
                            <span>Menu Principal [Esc]</span>
                        </button>
                    </div>
                </div>
            )}

            <div className="pointer-events-auto w-full max-w-6xl mx-auto flex flex-col gap-1.5 shrink-0">
                <div
                    className={`grid gap-1.5 sm:gap-2 w-full ${
                        snapshot.tanks.length <= 2
                            ? "grid-cols-2 max-w-xl mx-auto"
                            : snapshot.tanks.length <= 4
                              ? "grid-cols-2 sm:grid-cols-4 max-w-4xl mx-auto"
                              : snapshot.tanks.length <= 8
                                ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-4"
                                : "grid-cols-2 sm:grid-cols-5"
                    }`}
                >
                    {snapshot.tanks.map((tank) => {
                        const hpRatio = Math.max(0, Math.min(1, tank.energy / tank.maxEnergy));
                        const hpPercent = Math.round(hpRatio * 100);

                        const isReloading = tank.isAlive && tank.cooldown > 0;
                        const reloadPercent = isReloading
                            ? Math.round(
                                  ((snapshot.config.fireCooldownTicks - tank.cooldown) /
                                      snapshot.config.fireCooldownTicks) *
                                      100,
                              )
                            : 100;

                        return (
                            <div
                                key={tank.id}
                                className={`flex flex-col justify-between p-2 rounded border backdrop-blur-md transition-all duration-150 ${
                                    tank.isAlive
                                        ? "bg-neutral-950/85 border-neutral-800 shadow-sm"
                                        : "bg-neutral-950/40 border-neutral-900/60 opacity-40 grayscale-75"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-1 mb-1">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <span
                                            className="w-2.5 h-2.5 rounded-xs shrink-0 shadow-xs border border-white/20"
                                            style={{ backgroundColor: tank.color }}
                                        />
                                        <span className="text-xs font-bold text-neutral-100 truncate">{tank.name}</span>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0 font-mono text-[9px]">
                                        {tank.isAlive ? (
                                            tank.lastAction ? (
                                                <span className="px-1.5 py-0.2 rounded bg-neutral-900 text-neutral-400 border border-neutral-800">
                                                    {getActionLabelPtBr(tank.lastAction.type)}
                                                </span>
                                            ) : null
                                        ) : (
                                            <span className="text-rose-400 font-bold uppercase tracking-wider text-[9px]">
                                                Destruído
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <GhostHealthBar
                                        energy={tank.energy}
                                        maxEnergy={tank.maxEnergy}
                                        isAlive={tank.isAlive}
                                    />

                                    <div className="flex items-center justify-between text-[10px] font-mono leading-none pt-0.5">
                                        <span
                                            className={`font-bold tabular-nums ${
                                                !tank.isAlive
                                                    ? "text-neutral-500"
                                                    : hpPercent > 50
                                                      ? "text-emerald-400"
                                                      : hpPercent > 25
                                                        ? "text-amber-400"
                                                        : "text-rose-400"
                                            }`}
                                        >
                                            {tank.isAlive ? `${tank.energy} Vida` : "0 Vida"}
                                        </span>

                                        <div className="flex items-center gap-1.5">
                                            {tank.isAlive && (
                                                <span
                                                    className={`text-[9px] ${
                                                        isReloading ? "text-neutral-500" : "text-emerald-400"
                                                    }`}
                                                    title={
                                                        isReloading
                                                            ? `Recarregando: ${reloadPercent}%`
                                                            : "Canhão pronto para disparar"
                                                    }
                                                >
                                                    {isReloading ? "Recarga" : "Pronto"}
                                                </span>
                                            )}

                                            {tank.stats.kills > 0 && (
                                                <span className="text-amber-400 font-bold text-[9px]">
                                                    {tank.stats.kills}★
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {showHistoryDrawer && (
                <div className="pointer-events-auto fixed right-4 top-12 bottom-20 w-80 max-w-[90vw] bg-neutral-950/95 backdrop-blur-md border border-neutral-800 rounded shadow-2xl flex flex-col z-40 animate-in slide-in-from-right duration-200">
                    <div className="flex items-center justify-between p-3 border-b border-neutral-800">
                        <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-neutral-400" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                                Histórico de Combate
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowHistoryDrawer(false)}
                            className="btn-icon"
                            title="Fechar histórico"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono text-[10px]">
                        {snapshot.recentEvents.length === 0 ? (
                            <p className="text-neutral-500 italic">Nenhum evento registrado até o momento.</p>
                        ) : (
                            snapshot.recentEvents
                                .slice()
                                .reverse()
                                .map((ev) => (
                                    <div
                                        key={ev.id}
                                        className={`p-1.5 rounded border ${
                                            ev.type === "tank_destroyed"
                                                ? "bg-rose-950/40 border-rose-800/60 text-rose-200 font-semibold"
                                                : ev.type === "projectile_hit_tank"
                                                  ? "bg-amber-950/30 border-amber-800/40 text-amber-200"
                                                  : ev.type === "battle_end"
                                                    ? "bg-neutral-900 border-neutral-700 text-neutral-200 font-bold"
                                                    : "bg-neutral-900/60 border-neutral-800/70 text-neutral-400"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between text-[9px] text-neutral-500 mb-0.5">
                                            <span>CICLO {ev.tick}</span>
                                            <span className="text-[8px]">{getEventTypeLabelPtBr(ev.type)}</span>
                                        </div>
                                        <div>{ev.message}</div>
                                    </div>
                                ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
