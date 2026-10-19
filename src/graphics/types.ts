import { degToRad } from "../simulation/arena.ts";

export type CameraMode = "menu_orbit" | "combat" | "victory";

export interface GraphicsConfig {
    antialias: boolean;
    shadows: boolean;
    bloomEffect: boolean;
}

export function simToWorld(simX: number, simY: number, arenaWidth = 900, arenaHeight = 900): { x: number; z: number } {
    return {
        x: simX - arenaWidth / 2,
        z: simY - arenaHeight / 2,
    };
}

export function simAngleToWorldRotation(angleDeg: number): number {
    return -degToRad(angleDeg);
}
