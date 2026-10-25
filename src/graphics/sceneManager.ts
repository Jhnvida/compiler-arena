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
    private clouds: THREE.Group[] = [];

    public init(canvas: HTMLCanvasElement, config: ArenaConfig): void {
        this.dispose();

        this.arenaConfig = config;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x7ec0ee);
        this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.00035);

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

        const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x5a7d36, 0.7);
        this.scene.add(hemiLight);

        const sunLight = new THREE.DirectionalLight(0xfffaeb, 1.65);
        sunLight.position.set(280, 500, 220);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 1600;
        sunLight.shadow.camera.left = -550;
        sunLight.shadow.camera.right = 550;
        sunLight.shadow.camera.top = 550;
        sunLight.shadow.camera.bottom = -550;
        sunLight.shadow.bias = -0.0003;
        this.scene.add(sunLight);

        const fillLight = new THREE.DirectionalLight(0xbae6fd, 0.35);
        fillLight.position.set(-260, 250, -220);
        this.scene.add(fillLight);

        this.arenaController = new ArenaMeshController(config);
        this.scene.add(this.arenaController.group);

        this.createLowPolyClouds();

        this.particleManager = new ParticleSystemManager();
        this.scene.add(this.particleManager.group);

        this.lastTime = performance.now();
        this.loop();
    }

    private createLowPolyClouds(): void {
        const primaryCloudMat = new THREE.MeshStandardMaterial({
            color: 0xfafafa,
            roughness: 0.85,
            metalness: 0.05,
            flatShading: true,
            transparent: true,
            opacity: 0.9,
        });

        const horizonCloudMat = new THREE.MeshStandardMaterial({
            color: 0xf1f5f9,
            roughness: 0.9,
            metalness: 0.02,
            flatShading: true,
            transparent: true,
            opacity: 0.82,
        });

        type CloudArchetype = "cumulus" | "stratus" | "compact";

        const archetypes: Record<CloudArchetype, { x: number; y: number; z: number; r: number }[]> = {
            cumulus: [
                { x: 0, y: 0, z: 0, r: 22 },
                { x: 18, y: -2, z: 2, r: 16 },
                { x: -18, y: -2, z: -2, r: 15 },
                { x: 7, y: 8, z: -3, r: 14 },
                { x: -8, y: 7, z: 4, r: 13 },
                { x: 0, y: -4, z: 8, r: 12 },
                { x: 0, y: -4, z: -8, r: 12 },
            ],
            stratus: [
                { x: 0, y: 0, z: 0, r: 18 },
                { x: 22, y: -1, z: 3, r: 14 },
                { x: -22, y: 1, z: -2, r: 13 },
                { x: 40, y: -2, z: 1, r: 10 },
                { x: -38, y: 0, z: -1, r: 10 },
            ],
            compact: [
                { x: 0, y: 0, z: 0, r: 16 },
                { x: 12, y: 2, z: -2, r: 12 },
                { x: -12, y: -1, z: 3, r: 11 },
                { x: 2, y: 6, z: 2, r: 10 },
            ],
        };

        const cloudConfigs: {
            type: CloudArchetype;
            x: number;
            y: number;
            z: number;
            scale: number;
            speed: number;
            isHorizon?: boolean;
        }[] = [
            { type: "cumulus", x: -480, y: 125, z: -460, scale: 1.15, speed: 4.2, isHorizon: true },
            { type: "stratus", x: 120, y: 135, z: -520, scale: 1.3, speed: 3.8, isHorizon: true },
            { type: "compact", x: 520, y: 120, z: -380, scale: 1.0, speed: 4.5, isHorizon: true },
            { type: "cumulus", x: -540, y: 130, z: 440, scale: 1.2, speed: 4.0, isHorizon: true },
            { type: "stratus", x: 420, y: 140, z: 480, scale: 1.25, speed: 3.6, isHorizon: true },
            { type: "cumulus", x: -280, y: 180, z: -240, scale: 1.2, speed: 5.5 },
            { type: "stratus", x: 280, y: 195, z: -180, scale: 1.35, speed: 5.0 },
            { type: "compact", x: -80, y: 175, z: 280, scale: 1.05, speed: 6.0 },
            { type: "cumulus", x: 360, y: 185, z: 220, scale: 1.1, speed: 5.2 },
            { type: "stratus", x: -120, y: 245, z: -80, scale: 1.4, speed: 6.8 },
            { type: "cumulus", x: 180, y: 250, z: 120, scale: 1.3, speed: 6.4 },
        ];

        for (const cfg of cloudConfigs) {
            const cloudGroup = new THREE.Group();
            cloudGroup.position.set(cfg.x, cfg.y, cfg.z);
            cloudGroup.userData = { speed: cfg.speed };

            const mat = cfg.isHorizon ? horizonCloudMat : primaryCloudMat;
            const parts = archetypes[cfg.type];

            for (const p of parts) {
                const geo = new THREE.DodecahedronGeometry(p.r * cfg.scale, 0);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(p.x * cfg.scale, p.y * cfg.scale, p.z * cfg.scale);
                mesh.scale.set(1.3, 0.72, 1);
                cloudGroup.add(mesh);
            }

            this.scene?.add(cloudGroup);
            this.clouds.push(cloudGroup);
        }
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

        if (snapshot.tick === 0) {
            this.processedEventIds.clear();
            this.particleManager.clear();
        }

        for (const tank of snapshot.tanks) {
            let ctrl = this.tankControllers.get(tank.id);
            if (!ctrl) {
                ctrl = new TankMeshController(tank, width, height);
                this.scene.add(ctrl.group);
                this.tankControllers.set(tank.id, ctrl);
            } else if (snapshot.tick === 0) {
                ctrl.reset(tank, width, height);
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
                    const power = ev.value ?? 1;
                    if (tankCtrl) {
                        tankCtrl.triggerRecoil();
                        const muzzle = tankCtrl.getMuzzleWorldTransform();
                        this.particleManager.spawnMuzzleBlast(
                            muzzle.position.x,
                            muzzle.position.y,
                            muzzle.position.z,
                            muzzle.direction,
                            power,
                        );
                    } else {
                        this.particleManager.spawnMuzzleBlast(world.x, 12.5, world.z, undefined, power);
                    }
                    break;
                }

                case "projectile_hit_tank": {
                    const damage = ev.value ?? 12;
                    const power = damage >= 40 ? 3 : damage >= 25 ? 2 : 1;
                    let hitDir: THREE.Vector3 | undefined = undefined;

                    if (ev.tankId) {
                        const attacker = this.tankControllers.get(ev.tankId);
                        if (attacker) {
                            hitDir = new THREE.Vector3(
                                world.x - attacker.group.position.x,
                                0,
                                world.z - attacker.group.position.z,
                            ).normalize();
                        }
                    }

                    this.particleManager.spawnTankImpact(world.x, 12, world.z, hitDir, power);
                    break;
                }

                case "projectile_hit_wall":
                case "projectile_hit_obstacle": {
                    const halfW = arenaWidth / 2;
                    const halfD = arenaHeight / 2;
                    const wallNormal = new THREE.Vector3(0, 0, 0);

                    const distToNorth = Math.abs(world.z - -halfD);
                    const distToSouth = Math.abs(world.z - halfD);
                    const distToWest = Math.abs(world.x - -halfW);
                    const distToEast = Math.abs(world.x - halfW);
                    const minDist = Math.min(distToNorth, distToSouth, distToWest, distToEast);

                    if (minDist === distToNorth) wallNormal.set(0, 0, 1);
                    else if (minDist === distToSouth) wallNormal.set(0, 0, -1);
                    else if (minDist === distToWest) wallNormal.set(1, 0, 0);
                    else wallNormal.set(-1, 0, 0);

                    const power = ev.value ?? 1;
                    this.particleManager.spawnWallImpact(world.x, 10, world.z, wallNormal, power);
                    break;
                }

                case "tank_destroyed": {
                    this.particleManager.spawnTankDestruction(world.x, 6, world.z);
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
            }
        }

        for (const cloud of this.clouds) {
            const speed = (cloud.userData.speed as number | undefined) ?? 5.5;
            cloud.position.x += delta * speed;
            if (cloud.position.x > 850) {
                cloud.position.x = -850;
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

        for (const cloud of this.clouds) {
            cloud.traverse((c) => {
                if (c instanceof THREE.Mesh) {
                    c.geometry.dispose();
                    if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
                    else c.material.dispose();
                }
            });
        }
        this.clouds = [];

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
