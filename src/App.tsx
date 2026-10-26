import { AlertCircle, Play, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { soundManager } from "./audio/soundManager.ts";
import { compileTankScript, type CompilationResult } from "./compiler/compiler.ts";
import { PRESET_HUNTER, PRESET_STRIKER } from "./compiler/presets.ts";
import { ArenaCanvas } from "./components/ArenaCanvas.tsx";
import { BattleHUD } from "./components/BattleHUD.tsx";
import { CompilerModal } from "./components/CompilerModal.tsx";
import { RobotConfigPanel } from "./components/RobotConfigPanel.tsx";
import type { CameraMode } from "./graphics/types.ts";
import {
    DEFAULT_ARENA_CONFIG,
    getSystemTankColor,
    getSystemTankName,
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
    const [menuErrorNotice, setMenuErrorNotice] = useState<string | null>(null);

    const [battleSessionId, setBattleSessionId] = useState<number>(0);
    const engineRef = useRef<SimulationEngine | null>(null);
    const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

        const engine = new SimulationEngine();
        engine.initBattle(definitions);
        engine.start();
        engineRef.current = engine;

        setSnapshot(engine.getSnapshot());
        setIsPaused(false);
        setViewMode("battle");
        setCameraMode("combat");
        setBattleSessionId((s) => s + 1);
        soundManager.playBattleStart();
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
            setMenuErrorNotice("Adicione pelo menos 2 robôs para iniciar a batalha.");
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
        if (engineRef.current) {
            engineRef.current.pause();
        }
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

    const allCompiled = tanks.every((t) => compilationResults[t.id]?.success);

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-neutral-950 text-neutral-100 select-none font-sans">
            <ArenaCanvas config={DEFAULT_ARENA_CONFIG} snapshot={snapshot} cameraMode={cameraMode} />

            {/* ===================== MENU / HANGAR VIEW ===================== */}
            {viewMode === "menu" && (
                <div className="relative z-20 w-full h-full flex flex-col justify-between pointer-events-none p-3 sm:p-4">
                    {/* Top Tactical Command Header (Clean: No flashing dot, no "PROVING GROUND") */}
                    <header className="pointer-events-auto flex items-center justify-between px-4 py-2 bg-neutral-950/90 backdrop-blur-md border border-neutral-800 rounded shadow-md max-w-6xl mx-auto w-full">
                        <h1 className="text-xs font-bold tracking-wider uppercase text-white font-mono">
                            Arena de Compiladores
                        </h1>

                        <div className="flex items-center gap-2 sm:gap-3">
                            <span
                                className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                                    allCompiled
                                        ? "bg-emerald-950/50 text-emerald-300 border-emerald-800/60"
                                        : "bg-amber-950/50 text-amber-300 border-amber-800/60"
                                }`}
                            >
                                {tanks.length} de 10 robôs prontos
                            </span>

                            {tanks.length < 10 && (
                                <button
                                    type="button"
                                    onClick={handleAddTank}
                                    className="btn-secondary"
                                    title="Adicionar mais um robô à partida (máximo 10)"
                                >
                                    <Plus className="w-3.5 h-3.5 text-neutral-400" />
                                    <span>Adicionar Robô</span>
                                </button>
                            )}

                            <button type="button" onClick={handleStartBattle} className="btn-primary">
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Iniciar Batalha</span>
                            </button>
                        </div>
                    </header>

                    {/* Error Notice */}
                    {menuErrorNotice && (
                        <div className="pointer-events-auto mx-auto my-1 flex items-center gap-2 px-3 py-1 bg-rose-950/90 border border-rose-800 text-rose-200 text-xs rounded shadow-md animate-in fade-in">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>{menuErrorNotice}</span>
                        </div>
                    )}

                    {/* Bottom Dock Console */}
                    <div className="pointer-events-auto max-w-6xl mx-auto w-full">
                        <RobotConfigPanel
                            tanks={tanks}
                            selectedIndex={selectedTankIndex}
                            onSelectTank={setSelectedTankIndex}
                            onAddTank={handleAddTank}
                            onRemoveTank={handleRemoveTank}
                            onCodeChange={(tankId, newCode) => {
                                setTanks((prev) => prev.map((t) => (t.id === tankId ? { ...t, code: newCode } : t)));
                                compileTank(tankId, newCode);
                            }}
                            compilationResults={compilationResults}
                            onInspectTank={(idx) => setInspectorTankIndex(idx)}
                            canAdd={tanks.length < 10}
                            canRemove={tanks.length > 2}
                        />
                    </div>
                </div>
            )}

            {/* ===================== IN-GAME COMBAT HUD ===================== */}
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
                />
            )}

            {/* Compiler VM Inspector Modal */}
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
