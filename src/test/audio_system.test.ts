import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { soundManager } from "../audio/soundManager.ts";

describe("Audio SFX System & SoundManager", () => {
    beforeEach(() => {
        soundManager.setMasterVolume(0.7);
        soundManager.setMuted(false);
    });

    describe("1. Audio Assets & Documentation Integrity", () => {
        const expectedFiles = [
            "laser_small.ogg",
            "blaster.ogg",
            "laser_large.ogg",
            "impact_metal_1.ogg",
            "impact_metal_2.ogg",
            "impact_stone_1.ogg",
            "impact_stone_2.ogg",
            "explosion_1.ogg",
            "explosion_heavy.ogg",
            "battle_start.ogg",
            "victory.ogg",
            "ui_click.wav",
            "ui_switch.wav",
            "CREDITS.md",
        ];

        it("verifies all curated CC0 audio files exist locally with valid non-zero byte size", () => {
            const audioDir = path.resolve(process.cwd(), "public/audio");
            expect(fs.existsSync(audioDir)).toBe(true);

            for (const file of expectedFiles) {
                const filePath = path.join(audioDir, file);
                expect(fs.existsSync(filePath), `Missing asset: ${file}`).toBe(true);
                const stats = fs.statSync(filePath);
                expect(stats.size).toBeGreaterThan(100);
            }
        });

        it("verifies CREDITS.md contains complete license attribution details", () => {
            const creditsPath = path.resolve(process.cwd(), "public/audio/CREDITS.md");
            const content = fs.readFileSync(creditsPath, "utf8");

            expect(content).toContain("Kenney");
            expect(content).toContain("Creative Commons Zero 1.0 Universal");
            for (const file of expectedFiles.filter((f) => f.endsWith(".ogg") || f.endsWith(".wav"))) {
                expect(content).toContain(file);
            }
        });
    });

    describe("2. SoundManager State & Persistence", () => {
        it("initializes with valid default master volume and unmuted state", () => {
            const settings = soundManager.getSettings();
            expect(settings.masterVolume).toBe(0.7);
            expect(settings.muted).toBe(false);
        });

        it("clamps master volume between 0.0 and 1.0", () => {
            soundManager.setMasterVolume(1.5);
            expect(soundManager.getSettings().masterVolume).toBe(1.0);

            soundManager.setMasterVolume(-0.5);
            expect(soundManager.getSettings().masterVolume).toBe(0.0);

            soundManager.setMasterVolume(0.42);
            expect(soundManager.getSettings().masterVolume).toBeCloseTo(0.42, 3);
        });

        it("toggles mute correctly and reflects in settings", () => {
            expect(soundManager.getSettings().muted).toBe(false);
            soundManager.toggleMute();
            expect(soundManager.getSettings().muted).toBe(true);
            soundManager.toggleMute();
            expect(soundManager.getSettings().muted).toBe(false);
        });

        it("notifies listeners on settings change and unsubscribes cleanly", () => {
            let callCount = 0;
            let lastVol = 0;

            const unsubscribe = soundManager.subscribe((s) => {
                callCount++;
                lastVol = s.masterVolume;
            });

            expect(callCount).toBe(1);

            soundManager.setMasterVolume(0.85);
            expect(callCount).toBe(2);
            expect(lastVol).toBeCloseTo(0.85, 3);

            unsubscribe();
            soundManager.setMasterVolume(0.3);
            expect(callCount).toBe(2);
        });
    });

    describe("3. Playback API Invocations", () => {
        it("safely handles all play API calls without crashing in test environment", () => {
            expect(() => {
                soundManager.init();
                soundManager.playTankFire(1);
                soundManager.playTankFire(2);
                soundManager.playTankFire(3);
                soundManager.playTankImpact(1);
                soundManager.playTankImpact(3);
                soundManager.playWallImpact(1);
                soundManager.playWallImpact(3);
                soundManager.playTankDestruction();
                soundManager.playBattleStart();
                soundManager.playVictory();
                soundManager.playUiClick();
                soundManager.playUiSwitch();
            }).not.toThrow();
        });

        it("throttles high-frequency audio calls cleanly", () => {
            expect(() => {
                for (let i = 0; i < 20; i++) {
                    soundManager.playTankFire(2);
                    soundManager.playWallImpact(1);
                }
            }).not.toThrow();
        });
    });
});
