import React, { useEffect, useRef } from "react";
import { SceneManager } from "../graphics/sceneManager.ts";
import type { CameraMode } from "../graphics/types.ts";
import type { ArenaConfig, SimulationSnapshot } from "../simulation/types.ts";

interface ArenaCanvasProps {
    config: ArenaConfig;
    snapshot: SimulationSnapshot | null;
    cameraMode: CameraMode;
}

export const ArenaCanvas: React.FC<ArenaCanvasProps> = ({ config, snapshot, cameraMode }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const sceneManagerRef = useRef<SceneManager | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        const manager = new SceneManager();
        manager.init(canvasRef.current, config);
        sceneManagerRef.current = manager;

        const handleResize = () => {
            if (canvasRef.current && sceneManagerRef.current) {
                sceneManagerRef.current.resize(window.innerWidth, window.innerHeight);
            }
        };

        window.addEventListener("resize", handleResize);
        handleResize();

        return () => {
            window.removeEventListener("resize", handleResize);
            manager.dispose();
            sceneManagerRef.current = null;
        };
    }, [config]);

    useEffect(() => {
        if (snapshot && sceneManagerRef.current) {
            sceneManagerRef.current.sync(snapshot);
        }
    }, [snapshot]);

    useEffect(() => {
        if (sceneManagerRef.current) {
            sceneManagerRef.current.setCameraMode(cameraMode);
        }
    }, [cameraMode]);

    return (
        <div className="absolute inset-0 w-full h-full pointer-events-none">
            <canvas ref={canvasRef} className="w-full h-full block" />
        </div>
    );
};
