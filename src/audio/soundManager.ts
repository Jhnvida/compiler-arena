export interface AudioSettings {
    masterVolume: number;
    sfxVolume: number;
    uiVolume: number;
    muted: boolean;
}

const STORAGE_KEY = "compiler_arena_audio_settings";

const DEFAULT_SETTINGS: AudioSettings = {
    masterVolume: 0.8,
    sfxVolume: 1.0,
    uiVolume: 0.8,
    muted: false,
};

export function dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
}

export class SoundManager {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private sfxGain: GainNode | null = null;
    private uiGain: GainNode | null = null;
    private fanfareGain: GainNode | null = null;
    private compressor: DynamicsCompressorNode | null = null;

    private audioBuffers = new Map<string, AudioBuffer>();
    private lastTriggerTime = new Map<string, number>();
    private activeSources = new Set<AudioBufferSourceNode>();
    private isInitialized = false;
    private isUnlocked = false;

    private settings: AudioSettings = { ...DEFAULT_SETTINGS };
    private listeners = new Set<(settings: AudioSettings) => void>();

    private sampleAltIndex = {
        metalImpact: 0,
        stoneImpact: 0,
    };

    constructor() {
        this.loadSettings();
    }

    private loadSettings(): void {
        try {
            if (typeof window !== "undefined" && window.localStorage) {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    this.settings = {
                        masterVolume:
                            typeof parsed.masterVolume === "number"
                                ? Math.max(0, Math.min(1, parsed.masterVolume))
                                : DEFAULT_SETTINGS.masterVolume,
                        sfxVolume:
                            typeof parsed.sfxVolume === "number"
                                ? Math.max(0, Math.min(1, parsed.sfxVolume))
                                : DEFAULT_SETTINGS.sfxVolume,
                        uiVolume:
                            typeof parsed.uiVolume === "number"
                                ? Math.max(0, Math.min(1, parsed.uiVolume))
                                : DEFAULT_SETTINGS.uiVolume,
                        muted: typeof parsed.muted === "boolean" ? parsed.muted : DEFAULT_SETTINGS.muted,
                    };
                }
            }
        } catch {
            this.settings = { ...DEFAULT_SETTINGS };
        }
    }

    private saveSettings(): void {
        try {
            if (typeof window !== "undefined" && window.localStorage) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
            }
        } catch {}
        this.notifyListeners();
    }

    public subscribe(fn: (settings: AudioSettings) => void): () => void {
        this.listeners.add(fn);
        fn({ ...this.settings });
        return () => this.listeners.delete(fn);
    }

    private notifyListeners(): void {
        const copy = { ...this.settings };
        for (const fn of this.listeners) {
            fn(copy);
        }
    }

    public getSettings(): AudioSettings {
        return { ...this.settings };
    }

    public init(): void {
        if (this.isInitialized || typeof window === "undefined") return;

        const AudioCtxClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtxClass) return;

        try {
            this.ctx = new AudioCtxClass();

            this.compressor = this.ctx.createDynamicsCompressor();
            this.compressor.threshold.setValueAtTime(-6, this.ctx.currentTime);
            this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
            this.compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
            this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
            this.compressor.release.setValueAtTime(0.1, this.ctx.currentTime);

            this.masterGain = this.ctx.createGain();
            this.applyMasterGain();

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.setValueAtTime(dbToLinear(-8) * this.settings.sfxVolume, this.ctx.currentTime);

            this.uiGain = this.ctx.createGain();
            this.uiGain.gain.setValueAtTime(dbToLinear(-16) * this.settings.uiVolume, this.ctx.currentTime);

            this.fanfareGain = this.ctx.createGain();
            this.fanfareGain.gain.setValueAtTime(dbToLinear(-10) * this.settings.sfxVolume, this.ctx.currentTime);

            this.sfxGain.connect(this.compressor);
            this.uiGain.connect(this.compressor);
            this.fanfareGain.connect(this.compressor);

            this.compressor.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            this.setupAutoplayUnlock();
            this.preloadBuffers();

            this.isInitialized = true;
        } catch {
            this.ctx = null;
        }
    }

    private setupAutoplayUnlock(): void {
        if (!this.ctx || typeof window === "undefined") return;

        const unlock = () => {
            if (this.ctx && this.ctx.state === "suspended") {
                this.ctx
                    .resume()
                    .then(() => {
                        this.isUnlocked = true;
                    })
                    .catch(() => {});
            } else {
                this.isUnlocked = true;
            }

            window.removeEventListener("pointerdown", unlock);
            window.removeEventListener("keydown", unlock);
            window.removeEventListener("touchstart", unlock);
        };

        window.addEventListener("pointerdown", unlock, { passive: true });
        window.addEventListener("keydown", unlock, { passive: true });
        window.addEventListener("touchstart", unlock, { passive: true });
    }

    public isAudioUnlocked(): boolean {
        return this.isUnlocked;
    }

    public ensureUnlocked(): void {
        if (this.ctx && this.ctx.state === "suspended") {
            this.ctx.resume().catch(() => {});
        }
    }

    private applyMasterGain(): void {
        if (!this.masterGain || !this.ctx) return;
        const target = this.settings.muted ? 0 : this.settings.masterVolume;
        this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
    }

    private async preloadBuffers(): Promise<void> {
        if (!this.ctx) return;

        const soundFiles = [
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
        ];

        for (const file of soundFiles) {
            try {
                const res = await fetch(`/audio/${file}`);
                if (res.ok) {
                    const arrayBuf = await res.arrayBuffer();
                    const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
                    this.audioBuffers.set(file, audioBuf);
                }
            } catch {}
        }
    }

    private playSound(
        filename: string,
        category: "sfx" | "ui" | "fanfare" = "sfx",
        options?: {
            volumeMultiplier?: number;
            detuneRandom?: number;
            cooldownMs?: number;
        },
    ): void {
        if (this.settings.muted || this.settings.masterVolume === 0) return;
        if (!this.ctx) {
            this.init();
        }
        if (!this.ctx) return;

        this.ensureUnlocked();

        const now = performance.now();
        const cooldown = options?.cooldownMs ?? 35;
        const last = this.lastTriggerTime.get(filename) ?? 0;
        if (now - last < cooldown) {
            return;
        }
        this.lastTriggerTime.set(filename, now);

        const buffer = this.audioBuffers.get(filename);
        if (!buffer) return;

        if (this.activeSources.size >= 16) {
            const oldest = this.activeSources.values().next().value;
            if (oldest) {
                try {
                    oldest.stop();
                } catch {}
                this.activeSources.delete(oldest);
            }
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const detuneAmount = options?.detuneRandom ?? 0.08;
        const pitchJitter = 1.0 + (Math.random() - 0.5) * detuneAmount;
        source.playbackRate.setValueAtTime(pitchJitter, this.ctx.currentTime);

        const gainNode = this.ctx.createGain();
        const volJitter = 1.0 + (Math.random() - 0.5) * 0.1;
        const multiplier = (options?.volumeMultiplier ?? 1.0) * volJitter;
        gainNode.gain.setValueAtTime(multiplier, this.ctx.currentTime);

        source.connect(gainNode);

        const bus = category === "ui" ? this.uiGain : category === "fanfare" ? this.fanfareGain : this.sfxGain;
        if (bus) {
            gainNode.connect(bus);
        } else if (this.masterGain) {
            gainNode.connect(this.masterGain);
        }

        this.activeSources.add(source);
        source.onended = () => {
            this.activeSources.delete(source);
            gainNode.disconnect();
        };

        try {
            source.start(0);
        } catch {
            this.activeSources.delete(source);
        }
    }

    public playTankFire(power: number = 1): void {
        const file = power === 1 ? "laser_small.ogg" : power === 2 ? "blaster.ogg" : "laser_large.ogg";
        const vol = power === 1 ? 0.9 : power === 2 ? 1.0 : 1.15;
        this.playSound(file, "sfx", { volumeMultiplier: vol, detuneRandom: 0.1, cooldownMs: 40 });
    }

    public playTankImpact(power: number = 1): void {
        const files = ["impact_metal_1.ogg", "impact_metal_2.ogg"];
        this.sampleAltIndex.metalImpact = (this.sampleAltIndex.metalImpact + 1) % files.length;
        const file = files[this.sampleAltIndex.metalImpact];

        const vol = power === 1 ? 0.85 : power === 2 ? 1.0 : 1.2;
        this.playSound(file, "sfx", { volumeMultiplier: vol, detuneRandom: 0.12, cooldownMs: 35 });
    }

    public playWallImpact(_power: number = 1): void {
        const files = ["impact_stone_1.ogg", "impact_stone_2.ogg"];
        this.sampleAltIndex.stoneImpact = (this.sampleAltIndex.stoneImpact + 1) % files.length;
        const file = files[this.sampleAltIndex.stoneImpact];

        this.playSound(file, "sfx", { volumeMultiplier: 0.9, detuneRandom: 0.12, cooldownMs: 40 });
    }

    public playExplosion(intensity: number = 1.0): void {
        this.playSound("explosion_1.ogg", "sfx", {
            volumeMultiplier: Math.min(1.3, 0.85 + intensity * 0.25),
            detuneRandom: 0.15,
            cooldownMs: 50,
        });
    }

    public playTankDestruction(): void {
        this.playSound("explosion_heavy.ogg", "sfx", {
            volumeMultiplier: 1.35,
            detuneRandom: 0.08,
            cooldownMs: 80,
        });
    }

    public playBattleStart(): void {
        this.playSound("battle_start.ogg", "fanfare", {
            volumeMultiplier: 1.0,
            detuneRandom: 0.02,
            cooldownMs: 250,
        });
    }

    public playVictory(): void {
        this.playSound("victory.ogg", "fanfare", {
            volumeMultiplier: 1.1,
            detuneRandom: 0.0,
            cooldownMs: 500,
        });
    }

    public playUiClick(): void {
        this.playSound("ui_click.wav", "ui", {
            volumeMultiplier: 1.0,
            detuneRandom: 0.06,
            cooldownMs: 30,
        });
    }

    public playUiSwitch(): void {
        this.playSound("ui_switch.wav", "ui", {
            volumeMultiplier: 0.95,
            detuneRandom: 0.04,
            cooldownMs: 30,
        });
    }

    public setMasterVolume(volume: number): void {
        this.settings.masterVolume = Math.max(0, Math.min(1, volume));
        this.applyMasterGain();
        this.saveSettings();
    }

    public setMuted(muted: boolean): void {
        this.settings.muted = muted;
        this.applyMasterGain();
        this.saveSettings();
    }

    public toggleMute(): boolean {
        this.setMuted(!this.settings.muted);
        return this.settings.muted;
    }
}

export const soundManager = new SoundManager();
