import { useCallback, useEffect, useRef, useState } from "react";
import { compileTankScript, type CompilationResult } from "./compiler/compiler.ts";
import { PRESET_HUNTER, PRESET_STRIKER } from "./compiler/presets.ts";
import { ArenaCanvas } from "./components/ArenaCanvas.tsx";
import { BattleHUD } from "./components/BattleHUD.tsx";
import { CompilerModal } from "./components/CompilerModal.tsx";
import { TankEditorCard } from "./components/TankEditorCard.tsx";
import { WinnerModal } from "./components/WinnerModal.tsx";
import type { CameraMode } from "./graphics/types.ts";
import {
    DEFAULT_ARENA_CONFIG,
    SimulationEngine,
    type SimulationSnapshot,
    type TankDefinition,
} from "./simulation/index.ts";

interface TankConfig {
    id: string;
    name: string;
    color: string;
    code: string;
}

const INITIAL_TANKS: TankConfig[] = [
    {
        id: "tank-alpha",
        name: "Hunter Alpha",
        color: "#06b6d4",
        code: PRESET_HUNTER,
    },
    {
        id: "tank-bravo",
        name: "Striker Bravo",
        color: "#f97316",
        code: PRESET_STRIKER,
    },
];

function createPreviewSnapshot(
    tankList: TankConfig[],
    compResults: Record<string, CompilationResult>,
): SimulationSnapshot | null {
    const defs: TankDefinition[] = [];
    for (const t of tankList) {
        const res = compResults[t.id] ?? compileTankScript(t.code);
        if (res.success && res.bytecode) {
            defs.push({
                id: t.id,
                name: t.name.trim() || `Tanque ${t.id}`,
                color: t.color,
                program: res.bytecode,
            });
        }
    }
    if (defs.length >= 2) {
        const previewEngine = new SimulationEngine();
        previewEngine.initBattle(defs);
        return previewEngine.getSnapshot();
    }
    return null;
}

export function App() {
    const [viewMode, setViewMode] = useState<"menu" | "battle">("menu");
    const [tanks, setTanks] = useState<TankConfig[]>(INITIAL_TANKS);
    const [compilationResults, setCompilationResults] = useState<Record<string, CompilationResult>>(() => {
        const initial: Record<string, CompilationResult> = {};
        INITIAL_TANKS.forEach((t) => {
            initial[t.id] = compileTankScript(t.code);
        });
        return initial;
    });
    const [inspectorTankIndex, setInspectorTankIndex] = useState<number | null>(null);

    const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(() => {
        const initial: Record<string, CompilationResult> = {};
        INITIAL_TANKS.forEach((t) => {
            initial[t.id] = compileTankScript(t.code);
        });
        return createPreviewSnapshot(INITIAL_TANKS, initial);
    });
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [speed, setSpeed] = useState<number>(1);
    const [cameraMode, setCameraMode] = useState<CameraMode>("menu_orbit");
    const [showWinnerModal, setShowWinnerModal] = useState<boolean>(false);

    const engineRef = useRef<SimulationEngine | null>(null);
    const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const victoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const compileTank = useCallback((tankId: string, code: string) => {
        const res = compileTankScript(code);
        setCompilationResults((prev) => ({ ...prev, [tankId]: res }));
        return res;
    }, []);

    const handleStartBattle = () => {
        if (victoryTimerRef.current) {
            clearTimeout(victoryTimerRef.current);
            victoryTimerRef.current = null;
        }

        const definitions: TankDefinition[] = [];
        let hasErrors = false;

        for (const t of tanks) {
            const res = compileTank(t.id, t.code);
            if (!res.success || !res.bytecode) {
                hasErrors = true;
            } else {
                definitions.push({
                    id: t.id,
                    name: t.name.trim() || `Tanque ${t.id}`,
                    color: t.color,
                    program: res.bytecode,
                });
            }
        }

        if (hasErrors) {
            alert("Corrija os erros de compilação dos tanques antes de iniciar a batalha.");
            return;
        }

        if (definitions.length < 2) {
            alert("Adicione pelo menos 2 tanques para a batalha.");
            return;
        }

        const engine = new SimulationEngine();
        engine.initBattle(definitions);
        engine.start();
        engineRef.current = engine;

        setSnapshot(engine.getSnapshot());
        setIsPaused(false);
        setShowWinnerModal(false);
        setViewMode("battle");
        setCameraMode("combat");
    };

    const handleStep = useCallback(() => {
        if (engineRef.current) {
            const nextSnap = engineRef.current.step();
            setSnapshot({ ...nextSnap });

            if (nextSnap.status === "finished") {
                setCameraMode("victory");
                if (victoryTimerRef.current) clearTimeout(victoryTimerRef.current);
                victoryTimerRef.current = setTimeout(() => {
                    setShowWinnerModal(true);
                }, 1600);
            }
        }
    }, []);

    const handleTogglePause = useCallback(() => {
        setIsPaused((prev) => {
            const next = !prev;
            if (engineRef.current) {
                if (next) engineRef.current.pause();
                else engineRef.current.resume();
            }
            return next;
        });
    }, []);

    const handleRestart = useCallback(() => {
        if (!engineRef.current) return;
        if (victoryTimerRef.current) {
            clearTimeout(victoryTimerRef.current);
            victoryTimerRef.current = null;
        }

        const defs: TankDefinition[] = tanks.map((t) => {
            const res = compilationResults[t.id] ?? compileTankScript(t.code);
            return {
                id: t.id,
                name: t.name,
                color: t.color,
                program: res.bytecode!,
            };
        });

        engineRef.current.initBattle(defs);
        engineRef.current.start();
        setSnapshot(engineRef.current.getSnapshot());
        setIsPaused(false);
        setShowWinnerModal(false);
        setCameraMode("combat");
    }, [tanks, compilationResults]);

    const handleReturnToMenu = useCallback(() => {
        if (victoryTimerRef.current) {
            clearTimeout(victoryTimerRef.current);
            victoryTimerRef.current = null;
        }
        if (engineRef.current) {
            engineRef.current.pause();
        }
        setShowWinnerModal(false);
        setViewMode("menu");
        setCameraMode("menu_orbit");
        setSnapshot(createPreviewSnapshot(tanks, compilationResults));
    }, [tanks, compilationResults]);

    useEffect(() => {
        if (viewMode !== "battle" || isPaused) {
            if (tickIntervalRef.current) {
                clearInterval(tickIntervalRef.current);
                tickIntervalRef.current = null;
            }
            return;
        }

        const baseIntervalMs = 55;
        const intervalMs = Math.max(10, Math.round(baseIntervalMs / speed));

        tickIntervalRef.current = setInterval(() => {
            if (engineRef.current) {
                const nextSnap = engineRef.current.step();
                setSnapshot({ ...nextSnap });

                if (nextSnap.status === "finished") {
                    if (tickIntervalRef.current) {
                        clearInterval(tickIntervalRef.current);
                        tickIntervalRef.current = null;
                    }
                    setCameraMode("victory");
                    if (victoryTimerRef.current) clearTimeout(victoryTimerRef.current);
                    victoryTimerRef.current = setTimeout(() => {
                        setShowWinnerModal(true);
                    }, 1800);
                }
            }
        }, intervalMs);

        return () => {
            if (tickIntervalRef.current) {
                clearInterval(tickIntervalRef.current);
                tickIntervalRef.current = null;
            }
        };
    }, [viewMode, isPaused, speed]);

    const handleAddTank = () => {
        if (tanks.length >= 4) return;
        const id = `tank-${Date.now()}`;
        const nextTank: TankConfig = {
            id,
            name: `Robô ${tanks.length + 1}`,
            color: tanks.length === 2 ? "#10b981" : "#ec4899",
            code: PRESET_HUNTER,
        };
        const res = compileTankScript(nextTank.code);
        const nextComp = { ...compilationResults, [id]: res };
        const nextTanks = [...tanks, nextTank];
        setTanks(nextTanks);
        setCompilationResults(nextComp);
        setSnapshot(createPreviewSnapshot(nextTanks, nextComp));
    };

    const handleRemoveTank = (id: string) => {
        if (tanks.length <= 2) return;
        const nextTanks = tanks.filter((t) => t.id !== id);
        setTanks(nextTanks);
        setSnapshot(createPreviewSnapshot(nextTanks, compilationResults));
    };

    const inspectedResult =
        inspectorTankIndex !== null && tanks[inspectorTankIndex]
            ? (compilationResults[tanks[inspectorTankIndex].id] ?? null)
            : null;
    const inspectedName =
        inspectorTankIndex !== null && tanks[inspectorTankIndex] ? tanks[inspectorTankIndex].name : "";

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
            <ArenaCanvas
                config={DEFAULT_ARENA_CONFIG}
                snapshot={snapshot}
                cameraMode={cameraMode}
                isMenuBlurred={viewMode === "menu"}
            />

            {viewMode === "menu" && (
                <div className="relative z-20 w-full h-full flex flex-col justify-between p-6 overflow-y-auto">
                    <header className="flex items-center justify-between py-2 px-6 bg-slate-900/60 backdrop-blur-lg border border-slate-800/80 rounded-2xl shadow-xl max-w-6xl mx-auto w-full">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">🤖</span>
                            <div>
                                <h1 className="text-lg font-black tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400">
                                    Compiler Arena 3D
                                </h1>
                                <p className="text-xs text-slate-400">
                                    Compilador Didático & Máquina Virtual de Batalha de Tanques
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {tanks.length < 4 && (
                                <button
                                    type="button"
                                    onClick={handleAddTank}
                                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors shadow-sm cursor-pointer"
                                >
                                    <span>➕</span>
                                    <span>Adicionar Tanque</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={handleStartBattle}
                                className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-lg shadow-cyan-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                            >
                                <span>⚔️</span>
                                <span>Iniciar Batalha 3D</span>
                            </button>
                        </div>
                    </header>

                    <main className="my-auto py-6 max-w-6xl mx-auto w-full">
                        <div
                            className={`grid gap-6 ${
                                tanks.length === 2
                                    ? "grid-cols-2"
                                    : tanks.length === 3
                                      ? "grid-cols-3"
                                      : "grid-cols-2 lg:grid-cols-4"
                            }`}
                        >
                            {tanks.map((tank, idx) => (
                                <TankEditorCard
                                    key={tank.id}
                                    tankIndex={idx}
                                    name={tank.name}
                                    setName={(newName) => {
                                        setTanks((prev) =>
                                            prev.map((t) => (t.id === tank.id ? { ...t, name: newName } : t)),
                                        );
                                    }}
                                    color={tank.color}
                                    setColor={(newColor) => {
                                        setTanks((prev) =>
                                            prev.map((t) => (t.id === tank.id ? { ...t, color: newColor } : t)),
                                        );
                                    }}
                                    code={tank.code}
                                    setCode={(newCode) => {
                                        setTanks((prev) =>
                                            prev.map((t) => (t.id === tank.id ? { ...t, code: newCode } : t)),
                                        );
                                        compileTank(tank.id, newCode);
                                    }}
                                    compilationResult={compilationResults[tank.id] ?? null}
                                    onInspect={() => setInspectorTankIndex(idx)}
                                    onRemove={() => handleRemoveTank(tank.id)}
                                    canRemove={tanks.length > 2}
                                />
                            ))}
                        </div>
                    </main>

                    <footer className="text-center text-xs text-slate-500 font-mono py-2">
                        Trabalho de Compiladores • Seções 1 a 6 • Execução determinística por Bytecode VM
                    </footer>
                </div>
            )}

            {viewMode === "battle" && snapshot && (
                <BattleHUD
                    snapshot={snapshot}
                    speed={speed}
                    setSpeed={setSpeed}
                    isPaused={isPaused}
                    onTogglePause={handleTogglePause}
                    onStep={handleStep}
                    onRestart={handleRestart}
                    onReturnToMenu={handleReturnToMenu}
                    onOpenWinnerModal={() => setShowWinnerModal(true)}
                />
            )}

            {viewMode === "battle" && snapshot && snapshot.status === "finished" && !showWinnerModal && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 bg-slate-900/90 border border-amber-500/50 rounded-full shadow-2xl backdrop-blur-md animate-in fade-in duration-300">
                    <span className="text-sm">🏆</span>
                    <span className="text-xs font-bold text-amber-300">
                        {snapshot.winner
                            ? `${snapshot.winner.name} Venceu a Batalha!`
                            : "Partida Finalizada em Empate!"}
                    </span>
                    <button
                        type="button"
                        onClick={() => setShowWinnerModal(true)}
                        className="px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors shadow-sm cursor-pointer"
                    >
                        Ver Estatísticas Finais
                    </button>
                </div>
            )}

            {viewMode === "battle" && snapshot && snapshot.status === "finished" && showWinnerModal && (
                <WinnerModal
                    snapshot={snapshot}
                    onRestart={handleRestart}
                    onReturnToMenu={handleReturnToMenu}
                    onViewArena={() => setShowWinnerModal(false)}
                />
            )}

            <CompilerModal
                isOpen={inspectorTankIndex !== null}
                onClose={() => setInspectorTankIndex(null)}
                result={inspectedResult}
                tankName={inspectedName}
            />
        </div>
    );
}

export default App;
