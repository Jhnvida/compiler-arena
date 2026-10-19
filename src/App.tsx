import { AlertCircle, Bot, ChevronDown, ChevronUp, Play, Plus, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { compileTankScript, type CompilationResult } from "./compiler/compiler.ts";
import { PRESET_HUNTER, PRESET_STRIKER } from "./compiler/presets.ts";
import { ArenaCanvas } from "./components/ArenaCanvas.tsx";
import { BattleHUD } from "./components/BattleHUD.tsx";
import { CompilerModal } from "./components/CompilerModal.tsx";
import { RobotConfigPanel } from "./components/RobotConfigPanel.tsx";
import { WinnerModal } from "./components/WinnerModal.tsx";
import type { CameraMode } from "./graphics/types.ts";
import {
    DEFAULT_ARENA_CONFIG,
    SimulationEngine,
    type SimulationSnapshot,
    type TankDefinition,
    getSystemTankColor,
    getSystemTankName,
} from "./simulation/index.ts";

interface TankConfig {
    id: string;
    name: string;
    color: string;
    code: string;
}

const INITIAL_TANKS: TankConfig[] = [
    {
        id: "tank-1",
        name: getSystemTankName(0),
        color: getSystemTankColor(0),
        code: PRESET_HUNTER,
    },
    {
        id: "tank-2",
        name: getSystemTankName(1),
        color: getSystemTankColor(1),
        code: PRESET_STRIKER,
    },
];

function createPreviewSnapshot(
    tankList: TankConfig[],
    compResults: Record<string, CompilationResult>,
): SimulationSnapshot | null {
    const defs: TankDefinition[] = [];
    for (let i = 0; i < tankList.length; i++) {
        const t = tankList[i];
        const res = compResults[t.id] ?? compileTankScript(t.code);
        if (res.success && res.bytecode) {
            defs.push({
                id: t.id,
                name: getSystemTankName(i),
                color: getSystemTankColor(i),
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
    const [selectedTankIndex, setSelectedTankIndex] = useState<number>(0);

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
    const [menuPanelCollapsed, setMenuPanelCollapsed] = useState<boolean>(false);
    const [menuErrorNotice, setMenuErrorNotice] = useState<string | null>(null);

    const [battleSessionId, setBattleSessionId] = useState<number>(0);
    const engineRef = useRef<SimulationEngine | null>(null);
    const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const victoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const compileTank = useCallback((tankId: string, code: string) => {
        const res = compileTankScript(code);
        setCompilationResults((prev) => ({ ...prev, [tankId]: res }));
        return res;
    }, []);

    const launchBattle = useCallback((definitions: TankDefinition[]) => {
        if (tickIntervalRef.current) {
            clearInterval(tickIntervalRef.current);
            tickIntervalRef.current = null;
        }
        if (victoryTimerRef.current) {
            clearTimeout(victoryTimerRef.current);
            victoryTimerRef.current = null;
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
        setBattleSessionId((s) => s + 1);
    }, []);

    const handleStartBattle = () => {
        const definitions: TankDefinition[] = [];
        let hasErrors = false;

        for (let i = 0; i < tanks.length; i++) {
            const t = tanks[i];
            const res = compileTank(t.id, t.code);
            if (!res.success || !res.bytecode) {
                hasErrors = true;
            } else {
                definitions.push({
                    id: t.id,
                    name: getSystemTankName(i),
                    color: getSystemTankColor(i),
                    program: res.bytecode,
                });
            }
        }

        if (hasErrors) {
            setMenuErrorNotice("Corrija os erros de compilação dos tanques antes de iniciar a batalha.");
            setTimeout(() => setMenuErrorNotice(null), 4000);
            return;
        }

        if (definitions.length < 2) {
            setMenuErrorNotice("Adicione pelo menos 2 tanques para a batalha.");
            setTimeout(() => setMenuErrorNotice(null), 4000);
            return;
        }

        setMenuErrorNotice(null);
        launchBattle(definitions);
    };

    const handleStep = useCallback(() => {
        if (engineRef.current) {
            const nextSnap = engineRef.current.step();
            setSnapshot(nextSnap);

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
        const defs: TankDefinition[] = tanks.map((t, idx) => {
            const res = compilationResults[t.id] ?? compileTankScript(t.code);
            return {
                id: t.id,
                name: getSystemTankName(idx),
                color: getSystemTankColor(idx),
                program: res.bytecode!,
            };
        });

        launchBattle(defs);
    }, [tanks, compilationResults, launchBattle]);

    const handleReturnToMenu = useCallback(() => {
        if (tickIntervalRef.current) {
            clearInterval(tickIntervalRef.current);
            tickIntervalRef.current = null;
        }
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
                setSnapshot(nextSnap);

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
    }, [viewMode, isPaused, speed, battleSessionId]);

    const handleAddTank = () => {
        if (tanks.length >= 10) return;
        const newIndex = tanks.length;
        const id = `tank-${Date.now()}`;
        const nextTank: TankConfig = {
            id,
            name: getSystemTankName(newIndex),
            color: getSystemTankColor(newIndex),
            code: PRESET_HUNTER,
        };
        const res = compileTankScript(nextTank.code);
        const nextComp = { ...compilationResults, [id]: res };
        const nextTanks = [...tanks, nextTank];
        setTanks(nextTanks);
        setCompilationResults(nextComp);
        setSelectedTankIndex(newIndex);
        setSnapshot(createPreviewSnapshot(nextTanks, nextComp));
    };

    const handleRemoveTank = (id: string) => {
        if (tanks.length <= 2) return;
        const removedIndex = tanks.findIndex((t) => t.id === id);
        const filtered = tanks.filter((t) => t.id !== id);
        const nextTanks = filtered.map((t, idx) => ({
            ...t,
            name: getSystemTankName(idx),
            color: getSystemTankColor(idx),
        }));
        setTanks(nextTanks);
        setSelectedTankIndex((prev) => {
            if (removedIndex === prev) {
                return Math.max(0, Math.min(prev, nextTanks.length - 1));
            }
            if (removedIndex < prev) {
                return Math.max(0, prev - 1);
            }
            return Math.min(prev, nextTanks.length - 1);
        });
        setSnapshot(createPreviewSnapshot(nextTanks, compilationResults));
    };

    const inspectedResult =
        inspectorTankIndex !== null && tanks[inspectorTankIndex]
            ? (compilationResults[tanks[inspectorTankIndex].id] ?? null)
            : null;
    const inspectedName =
        inspectorTankIndex !== null && tanks[inspectorTankIndex] ? tanks[inspectorTankIndex].name : "";

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-neutral-950 text-neutral-100 select-none">
            <ArenaCanvas config={DEFAULT_ARENA_CONFIG} snapshot={snapshot} cameraMode={cameraMode} />

            {viewMode === "menu" && (
                <div className="relative z-20 w-full h-full flex flex-col justify-between pointer-events-none">
                    <header className="pointer-events-auto flex items-center justify-between p-3.5 mx-4 mt-3 bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-lg shadow-sm">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-200">
                                <Bot className="w-4 h-4" />
                            </div>
                            <div>
                                <h1 className="text-xs font-bold tracking-wider uppercase text-neutral-100">
                                    Compiler Arena
                                </h1>
                                <p className="text-[10px] text-neutral-400 font-mono">
                                    Compilador TankScript & VM Determinística
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                            <span className="hidden sm:inline-block px-2.5 py-1 text-[11px] font-mono text-neutral-400 bg-neutral-950 rounded border border-neutral-800">
                                {tanks.length} / 10 Robôs
                            </span>

                            {tanks.length < 10 && (
                                <button
                                    type="button"
                                    onClick={handleAddTank}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Adicionar Robô</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={handleStartBattle}
                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm transition-colors cursor-pointer"
                            >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Iniciar Batalha</span>
                            </button>
                        </div>
                    </header>

                    {menuErrorNotice && (
                        <div className="pointer-events-auto mx-auto mt-2 flex items-center gap-2 px-3.5 py-1.5 bg-rose-950/90 border border-rose-800 text-rose-200 text-xs rounded-md shadow-md animate-in fade-in">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>{menuErrorNotice}</span>
                        </div>
                    )}

                    <div className="pointer-events-auto p-4 max-w-7xl mx-auto w-full">
                        <div className="bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-lg shadow-lg overflow-hidden">
                            <div
                                onClick={() => setMenuPanelCollapsed(!menuPanelCollapsed)}
                                className="flex items-center justify-between px-3.5 py-2 bg-neutral-950/70 border-b border-neutral-800 cursor-pointer text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] uppercase tracking-wider text-neutral-300 font-semibold">
                                        Painel de Configuração dos Robôs
                                    </span>
                                    <span className="text-[10px] text-neutral-500 font-mono">
                                        ({tanks.length} participantes configurados)
                                    </span>
                                </div>
                                <button type="button" className="text-neutral-400 hover:text-white">
                                    {menuPanelCollapsed ? (
                                        <ChevronUp className="w-4 h-4" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4" />
                                    )}
                                </button>
                            </div>

                            {!menuPanelCollapsed && (
                                <div className="p-3">
                                    <RobotConfigPanel
                                        tanks={tanks}
                                        selectedIndex={selectedTankIndex}
                                        onSelectTank={setSelectedTankIndex}
                                        onAddTank={handleAddTank}
                                        onRemoveTank={handleRemoveTank}
                                        onCodeChange={(tankId, newCode) => {
                                            setTanks((prev) =>
                                                prev.map((t) =>
                                                    t.id === tankId ? { ...t, code: newCode } : t,
                                                ),
                                            );
                                            compileTank(tankId, newCode);
                                        }}
                                        compilationResults={compilationResults}
                                        onInspectTank={(idx) => setInspectorTankIndex(idx)}
                                        canAdd={tanks.length < 10}
                                        canRemove={tanks.length > 2}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
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
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-3.5 py-1.5 bg-neutral-900/90 border border-neutral-700 rounded-md shadow-md backdrop-blur-md animate-in fade-in duration-200">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-neutral-200">
                        {snapshot.winner ? `${snapshot.winner.name} venceu a batalha` : "Partida finalizada em empate"}
                    </span>
                    <button
                        type="button"
                        onClick={() => setShowWinnerModal(true)}
                        className="px-2.5 py-0.5 rounded text-[11px] font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
                    >
                        Ver Resultado
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
