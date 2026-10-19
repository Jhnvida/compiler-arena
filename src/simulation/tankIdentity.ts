export const SYSTEM_TANK_COLORS = [
    "#0284c7",
    "#f97316",
    "#10b981",
    "#8b5cf6",
    "#ec4899",
    "#eab308",
    "#06b6d4",
    "#ef4444",
    "#6366f1",
    "#84cc16",
];

export function getSystemTankName(index: number): string {
    return `Robo ${index + 1}`;
}

export function getSystemTankColor(index: number): string {
    return SYSTEM_TANK_COLORS[index % SYSTEM_TANK_COLORS.length];
}
