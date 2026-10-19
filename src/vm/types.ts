export interface TankSensors {
    energy: number;
    position: {
        x: number;
        y: number;
    };
    enemy: {
        visible: boolean;
        distance: number;
        direction: number;
    };
}

export type TankActionType = "move" | "back" | "rotate" | "scan" | "fire";

export interface TankAction {
    type: TankActionType;
    value?: number;
}

export interface VMExecutionResult {
    actions: TankAction[];
    instructionsExecuted: number;
    yieldReason: "action" | "quota_exhausted" | "halted" | "error";
    isHalted: boolean;
    error: string | null;
}
