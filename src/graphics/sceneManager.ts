import * as THREE from "three";
import type { ArenaConfig, SimEvent, SimulationSnapshot } from "../simulation/types.ts";
import { ArenaMeshController } from "./arenaMesh.ts";
import { CameraController } from "./cameraController.ts";
import { ParticleSystemManager } from "./particles.ts";
import { TankMeshController } from "./tankMesh.ts";
import { simToWorld } from "./types.ts";

export class SceneManager {
    private renderer: THREE.WebGLRenderer | null = null;
    private scene: THREE.Scene | null = null;
    private cameraController: CameraController | null = null;
    private arenaController: ArenaMeshController | null = null;
    private particleManager: ParticleSystemManager | null = null;
    private tankControllers = new Map<string, TankMeshController>();

    private processedEventIds = new Set<string>();
    private animationFrameId: number | null = null;
    private lastTime = performance.now();
    private arenaConfig: ArenaConfig | null = null;
    private currentSnapshot: SimulationSnapshot | null = null;

    public init(canvas: HTMLCanvasElement, config: ArenaConfig): void {
        this.dispose();

        this.arenaConfig = config;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x060913);
        this.scene.fog = new THREE.FogExp2(0x060913, 0.0007);

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
        });
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
        this.cameraController = new CameraController(aspect);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.5);
        dirLight.position.set(250, 450, 200);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 10;
        dirLight.shadow.camera.far = 1400;
        dirLight.shadow.camera.left = -500;
        dirLight.shadow.camera.right = 500;
        dirLight.shadow.camera.top = 500;
        dirLight.shadow.camera.bottom = -500;
        dirLight.shadow.bias = -0.0003;
        this.scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
        fillLight.position.set(-250, 200, -200);
        this.scene.add(fillLight);

        this.arenaController = new ArenaMeshController(config);
        this.scene.add(this.arenaController.group);

        this.particleManager = new ParticleSystemManager();
        this.scene.add(this.particleManager.group);

        this.lastTime = performance.now();
        this.loop();
    }

    public setCameraMode(mode: "menu_orbit" | "combat" | "victory"): void {
        if (this.cameraController && this.arenaConfig) {
            this.cameraController.setMode(
                mode,
                this.currentSnapshot?.winner,
                this.arenaConfig.width,
                this.arenaConfig.height,
            );
        }
    }

    public sync(snapshot: SimulationSnapshot): void {
        this.currentSnapshot = snapshot;
        if (!this.scene || !this.arenaConfig || !this.cameraController || !this.particleManager) {
            return;
        }

        const { width, height } = this.arenaConfig;

        const currentTankIds = new Set(snapshot.tanks.map((t) => t.id));

        for (const [id, ctrl] of this.tankControllers.entries()) {
            if (!currentTankIds.has(id)) {
                this.scene.remove(ctrl.group);
                ctrl.dispose();
                this.tankControllers.delete(id);
            }
        }

        for (const tank of snapshot.tanks) {
            let ctrl = this.tankControllers.get(tank.id);
            if (!ctrl) {
                ctrl = new TankMeshController(tank, width, height);
                this.scene.add(ctrl.group);
                this.tankControllers.set(tank.id, ctrl);
            }
        }

        this.processEvents(snapshot.recentEvents, width, height);

        this.particleManager.syncProjectiles(snapshot.projectiles, width, height);

        if (snapshot.status === "finished" && snapshot.winner && this.cameraController.mode === "combat") {
            this.cameraController.setMode("victory", snapshot.winner, width, height);
        }
    }

    private processEvents(events: SimEvent[], arenaWidth: number, arenaHeight: number): void {
        if (!this.particleManager) return;

        for (const ev of events) {
            if (this.processedEventIds.has(ev.id)) continue;
            this.processedEventIds.add(ev.id);

            const simX = ev.x ?? 0;
            const simY = ev.y ?? 0;
            const world = simToWorld(simX, simY, arenaWidth, arenaHeight);

            switch (ev.type) {
                case "tank_fire": {
                    const tankCtrl = ev.tankId ? this.tankControllers.get(ev.tankId) : null;
                    if (tankCtrl) {
                        tankCtrl.triggerRecoil();
                    }
                    this.particleManager.spawnMuzzleFlash(world.x, 12, world.z);
                    break;
                }

                case "projectile_hit_tank": {
                    this.particleManager.spawnImpactSparks(world.x, 12, world.z, 20);
                    this.particleManager.spawnSmokePuff(world.x, 12, world.z, 1.2);
                    break;
                }

                case "projectile_hit_wall":
                case "projectile_hit_obstacle": {
                    this.particleManager.spawnImpactSparks(world.x, 10, world.z, 12);
                    break;
                }

                case "tank_destroyed": {
                    this.particleManager.spawnExplosion(world.x, 6, world.z);
                    break;
                }
            }
        }

        if (this.processedEventIds.size > 2000) {
            this.processedEventIds.clear();
        }
    }

    private loop = (): void => {
        this.animationFrameId = requestAnimationFrame(this.loop);

        const now = performance.now();
        const delta = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        if (!this.renderer || !this.scene || !this.cameraController || !this.arenaConfig) {
            return;
        }

        const { width, height } = this.arenaConfig;
        const tanks = this.currentSnapshot?.tanks ?? [];
        const winner = this.currentSnapshot?.winner ?? null;

        for (const tank of tanks) {
            const ctrl = this.tankControllers.get(tank.id);
            if (ctrl) {
                const isWinner = winner?.id === tank.id;
                ctrl.update(tank, this.cameraController.camera, width, height, delta, isWinner);

                if (tank.isAlive && tank.energy < 40 && Math.random() < 0.25) {
                    const w = simToWorld(tank.x, tank.y, width, height);
                    this.particleManager?.spawnSmokePuff(w.x, 8, w.z, 0.8);
                }

                if (isWinner && tank.isAlive && Math.random() < 0.15) {
                    const w = simToWorld(tank.x, tank.y, width, height);
                    this.particleManager?.spawnImpactSparks(w.x, 26, w.z, 3);
                }
            }
        }

        this.cameraController.update(delta, tanks, winner, width, height);

        this.particleManager?.update(delta);

        this.renderer.render(this.scene, this.cameraController.camera);
    };

    public resize(width: number, height: number): void {
        if (!this.renderer || !this.cameraController) return;
        this.renderer.setSize(width, height, false);
        this.cameraController.setAspect(width / Math.max(height, 1));
    }

    public dispose(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        for (const ctrl of this.tankControllers.values()) {
            ctrl.dispose();
        }
        this.tankControllers.clear();

        this.arenaController?.dispose();
        this.arenaController = null;

        this.particleManager?.dispose();
        this.particleManager = null;

        this.renderer?.dispose();
        this.renderer = null;

        this.scene = null;
        this.cameraController = null;
        this.processedEventIds.clear();
    }
}
