import { Scene } from "phaser";
import { SCENES, GAME_CONFIG, MAP_PADDING } from "../utils/Constants";
import { GameSceneData } from "../types";
import EventBus from "../utils/EventBus";

// Import new systems
import { ImageMapLoader } from "../systems/ImageMapLoader";
import { CollisionManager } from "../systems/CollisionManager";
import { InteractionManager } from "../systems/InteractionManager";

// Import entities
import { Player } from "../entities/Player";
import { Bed } from "../entities/Bed";
import { Door } from "../entities/Door";
import { Chair } from "../entities/Chair";
import { Patient } from "../entities/Patient";
import { Staff, StaffTask } from "../entities/Staff";
import { Tablet } from "../entities/Tablet";

// Import map config
import {
  MapConfig,
  DEFAULT_MAP,
  getMapOffset,
  getSpawnPoint,
  getMapBounds,
  UrgencyWeights,
} from "../config/MapConfigs";

/**
 * Main Game Scene
 * Where all the ER action happens
 */
export class Game extends Scene {
  // Scene data
  private sceneData!: GameSceneData;

  // Systems
  private imageMapLoader!: ImageMapLoader;
  private collisionManager!: CollisionManager;
  private interactionManager!: InteractionManager;

  // Game objects
  private player!: Player;
  private beds: Map<string, Bed> = new Map();
  private doors: Door[] = [];
  private chairs: Chair[] = [];
  private patients: Patient[] = [];
  private staffs: Staff[] = [];
  private tablets: Tablet[] = [];

  // Patient spawning
  private currentSpawnRate: number = 0;
  private patientSpawnTimer!: Phaser.Time.TimerEvent;
  private patientIdCounter: number = 0;

  // Game state
  private shiftTimer: number = 0;
  private chaosScore: number = 0;
  private isPaused: boolean = false;

  // HUD elements
  private timerText!: Phaser.GameObjects.Text;
  private chaosBar!: Phaser.GameObjects.Graphics;
  private chaosText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private roomIndicator!: Phaser.GameObjects.Text;

  // Game stats tracking
  private patientsArrived: number = 0;
  private patientsSaved: number = 0;
  private patientsDied: number = 0;
  private peakChaos: number = 0;

  // Debug
  private debugMode: boolean = false;

  constructor() {
    super(SCENES.GAME);
  }

  init(data: GameSceneData): void {
    this.sceneData = data || {
      difficulty: "NORMAL",
      shiftDuration: 300, // 5 minutes default
    };
    this.shiftTimer = this.sceneData.shiftDuration;
    this.chaosScore = 0;
    this.isPaused = false;

    // Reset stats
    this.patientsArrived = 0;
    this.patientsSaved = 0;
    this.patientsDied = 0;
    this.peakChaos = 0;

    // Clear collections
    this.beds.clear();
    this.patients = [];
    this.staffs = [];
    this.tablets = [];
    this.patientIdCounter = 0;
  }

  create(): void {
    // Background color
    this.cameras.main.setBackgroundColor(0x3a3a50);

    // Initialize systems
    this.initializeSystems();

    // Load map layers (images) and collision
    this.loadMapImages();
    this.loadCollisionFromJson();

    // Create beds (disabled until positions are mapped)
    this.createBeds();

    // Create doors
    this.createDoors();

    // Create chairs
    this.createChairs();

    // Create staff
    this.createStaffs();

    // Create tablets
    this.createTablets();

    // Create player
    this.createPlayer();

    // Camera follow (vertical only)
    this.setupCamera();

    // Create HUD
    this.createHUD();

    // Start shift timer
    this.time.addEvent({
      delay: 1000,
      callback: this.updateShiftTimer,
      callbackScope: this,
      loop: true,
    });

    // Start patient spawning
    this.startPatientSpawning();

    // Set up pause functionality
    this.setupPause();

    // Set up debug toggle
    this.setupDebug();

    // Fade in
    this.cameras.main.fadeIn(500);

    console.log("🏥 Shift started!", this.sceneData);
  }

  update(_time: number, delta: number): void {
    if (this.isPaused) return;

    // Update player
    this.player.update(delta);

    // Update doors (check proximity to player for auto-open)
    const playerPos = this.player.getPosition();
    this.doors.forEach((door) => door.update(playerPos.x, playerPos.y, delta));

    // Update patients
    this.patients.forEach((patient) => patient.update(delta));

    // Update staff
    this.staffs.forEach((staff) => staff.update(delta));

    // Update tablets (for pointer indicator)
    const interactionRange = this.interactionManager.getInteractionRange();
    this.tablets.forEach((tablet) =>
      tablet.update(playerPos.x, playerPos.y, interactionRange)
    );

    // Update interaction manager with player position
    this.interactionManager.update(playerPos.x, playerPos.y);

    // Update room indicator (static)
    this.updateRoomIndicator();

    // Update HUD
    this.updateHUD();
  }

  /**
   * Initialize all game systems
   */
  private initializeSystems(): void {
    // Image map loader (layers as images, collision from JSON)
    this.imageMapLoader = new ImageMapLoader(this);

    // Collision manager (handles collision)
    this.collisionManager = new CollisionManager(this);

    // Interaction manager (handles E key interactions)
    this.interactionManager = new InteractionManager(this);
  }

  // Map offset to center it horizontally
  private mapOffsetX: number = 0;
  private mapOffsetY: number = MAP_PADDING.TOP;
  private currentMap: MapConfig = DEFAULT_MAP;

  /**
   * Load map layer images
   */
  private loadMapImages(): void {
    // Calculate offset to center the map
    const offset = getMapOffset(this.currentMap);
    this.mapOffsetX = offset.x;
    this.mapOffsetY = offset.y;

    this.imageMapLoader.loadLayers(
      this.currentMap.layers,
      this.mapOffsetX,
      this.mapOffsetY
    );
  }

  /**
   * Load collision objects from collision.json (simple format)
   */
  private loadCollisionFromJson(): void {
    const collisionData = this.cache.json.get(this.currentMap.collisionKey);
    if (!collisionData) {
      console.error(`${this.currentMap.collisionKey} not found in cache`);
      return;
    }

    // Clear any default colliders and set map bounds with offset
    this.collisionManager.clearAll();
    this.collisionManager.setMapBounds(getMapBounds(this.currentMap));

    this.imageMapLoader.loadCollisionData(collisionData);
    const collisionObjects = this.imageMapLoader.getCollisionObjects();

    collisionObjects.forEach((obj, index) => {
      const collisionRect = {
        x: obj.x + this.mapOffsetX,
        y: obj.y + this.mapOffsetY,
        width: obj.width || 32,
        height: obj.height || 32,
      };

      this.collisionManager.addCollider(`wall_${index}`, collisionRect);
    });

    console.log(`✅ Applied ${collisionObjects.length} collision objects`);
  }

  /**
   * Camera follows player vertically (locks X)
   */
  private setupCamera(): void {
    const cam = this.cameras.main;

    // Camera bounds include padding
    const totalHeight =
      this.currentMap.height + MAP_PADDING.TOP + MAP_PADDING.BOTTOM;
    cam.setBounds(0, 0, GAME_CONFIG.WIDTH, totalHeight);
    cam.startFollow(this.player, false, 0, 0.2); // lerpX=0 locks horizontal, lerpY smooths vertical
    cam.setFollowOffset(0, 0);
  }

  /**
   * Create beds from config
   */
  private createBeds(): void {
    // Disabled until bed positions are mapped in Tiled
    this.beds.clear();
    console.log("⚠️ Beds disabled - update BED_POSITIONS to match Tiled map");
  }

  /**
   * Create the player character
   */
  private createPlayer(): void {
    // Get spawn point from map config (already includes offset)
    const spawn = getSpawnPoint(this.currentMap, "player");
    const startX = spawn?.x || this.mapOffsetX + this.currentMap.width / 2;
    const startY = spawn?.y || this.mapOffsetY + this.currentMap.height / 2;

    this.player = new Player({
      scene: this,
      x: startX,
      y: startY,
      collisionManager: this.collisionManager,
    });
  }

  /**
   * Create doors
   * Doors are now defined in MapConfigs.ts for each map
   */
  private createDoors(): void {
    const offset = getMapOffset(this.currentMap);

    this.currentMap.doors.forEach((doorConfig) => {
      const door = new Door({
        scene: this,
        x: doorConfig.x + offset.x,
        y: doorConfig.y + offset.y,
        spriteKey: doorConfig.spriteKey || "door01",
        autoOpen: doorConfig.autoOpen ?? true,
        triggerDistance: doorConfig.triggerDistance ?? 50,
        doorType: doorConfig.doorType || "dual",
        fixedDirection: doorConfig.fixedDirection || "down",
      });
      this.doors.push(door);
    });

    console.log(`✅ Created ${this.doors.length} doors`);
  }

  /**
   * Create chairs
   * Chairs are defined in MapConfigs.ts for each map
   */
  private createChairs(): void {
    const offset = getMapOffset(this.currentMap);

    this.currentMap.chairs.forEach((chairConfig, index) => {
      const chair = new Chair({
        scene: this,
        x: chairConfig.x + offset.x,
        y: chairConfig.y + offset.y,
        color: chairConfig.color || "yellow",
        direction: chairConfig.direction || "down",
      });
      this.chairs.push(chair);

      // Register chair as interactable
      const chairId = `chair_${index}`;
      this.interactionManager.register({
        id: chairId,
        x: chair.x,
        y: chair.y,
        type: "chair",
        getLabel: () => {
          if (
            this.player.getIsSitting() &&
            this.player.getCurrentChair() === chair
          ) {
            return "";
          }
          return "";
        },
        canInteract: () => {
          // Can interact if player is not sitting, or if already sitting in this chair
          if (this.player.getIsSitting()) {
            return this.player.getCurrentChair() === chair;
          }
          return !chair.getIsOccupied();
        },
        onInteract: () => {
          if (this.player.getIsSitting()) {
            // Stand up
            this.player.standUp();
          } else {
            // Sit down
            this.player.sitInChair(chair);
          }
        },
      });
    });

    console.log(`✅ Created ${this.chairs.length} chairs`);
  }

  /**
   * Create staff members
   * Staff are defined in MapConfigs.ts for each map
   */
  private createStaffs(): void {
    const offset = getMapOffset(this.currentMap);

    this.currentMap.staffs.forEach((staffConfig) => {
      const staff = new Staff({
        scene: this,
        x: staffConfig.x + offset.x,
        y: staffConfig.y + offset.y,
        id: staffConfig.id,
        spriteKey: staffConfig.spriteKey,
        name: staffConfig.name,
      });

      // Set spawn position with offset applied
      staff.setSpawnPosition(
        staffConfig.x + offset.x,
        staffConfig.y + offset.y
      );

      this.staffs.push(staff);

      // Start auto-task if defined
      if (staffConfig.autoTask) {
        // Apply offset to all walkTo positions in the task
        const taskWithOffset: StaffTask = {
          ...staffConfig.autoTask,
          steps: staffConfig.autoTask.steps.map((step) => ({
            ...step,
            walkTo: step.walkTo
              ? { x: step.walkTo.x + offset.x, y: step.walkTo.y + offset.y }
              : undefined,
          })),
        };

        // Delay the task start slightly so staff appears first
        this.time.delayedCall(500, () => {
          staff.startTask(taskWithOffset);
        });
      }
    });

    console.log(`✅ Created ${this.staffs.length} staff members`);
  }

  /**
   * Create tablets
   * Tablets are defined in MapConfigs.ts for each map
   */
  private createTablets(): void {
    const offset = getMapOffset(this.currentMap);

    // Check if tablets array exists (for backwards compatibility)
    if (!this.currentMap.tablets) {
      console.log("ℹ️ No tablets defined in map config");
      return;
    }

    this.currentMap.tablets.forEach((tabletConfig) => {
      const tablet = new Tablet({
        scene: this,
        x: tabletConfig.x + offset.x,
        y: tabletConfig.y + offset.y,
        id: tabletConfig.id,
        spriteKey: tabletConfig.spriteKey,
      });

      // Set pointer range if specified
      if (tabletConfig.pointerRange) {
        tablet.setPointerRange(tabletConfig.pointerRange);
      }

      this.tablets.push(tablet);

      // Register tablet as interactable
      this.interactionManager.register({
        id: tabletConfig.id,
        x: tablet.x,
        y: tablet.y,
        type: "tablet",
        promptYOffset: -70,
        canInteract: () => true,
        onInteract: () => {
          console.log(`📱 Interacting with tablet: ${tabletConfig.id}`);
          EventBus.emit("tablet:interact", { tabletId: tabletConfig.id });
        },
      });
    });

    console.log(`✅ Created ${this.tablets.length} tablets`);
  }

  /**
   * Find an available (unoccupied) chair
   */
  private findAvailableChair(): Chair | null {
    return this.chairs.find((chair) => !chair.getIsOccupied()) || null;
  }

  // ===========================================
  // PATIENT SPAWNING SYSTEM
  // ===========================================

  /**
   * Start the patient spawning timer
   */
  private startPatientSpawning(): void {
    const gameConfig = this.currentMap.gameConfig;
    this.currentSpawnRate = gameConfig.spawnRateMs;

    // Schedule first spawn
    this.scheduleNextPatientSpawn();

    console.log(
      `✅ Patient spawning started (rate: ${this.currentSpawnRate}ms)`
    );
  }

  /**
   * Schedule the next patient spawn
   */
  private scheduleNextPatientSpawn(): void {
    if (this.patientSpawnTimer) {
      this.patientSpawnTimer.destroy();
    }

    this.patientSpawnTimer = this.time.delayedCall(
      this.currentSpawnRate,
      this.spawnPatient,
      [],
      this
    );
  }

  /**
   * Spawn a new patient
   */
  private spawnPatient(): void {
    const gameConfig = this.currentMap.gameConfig;
    const offset = getMapOffset(this.currentMap);

    // Check if we're at max patients
    if (this.patients.length >= gameConfig.maxPatients) {
      // Schedule next spawn anyway
      this.scheduleNextPatientSpawn();
      return;
    }

    // Generate random severity based on weights
    const severity = this.getRandomSeverity(gameConfig.urgencyWeights);

    // Create patient at spawn point
    const spawnPoint = gameConfig.patientSpawn.spawnPoint;
    const patientId = `patient_${this.patientIdCounter++}`;

    const patient = new Patient({
      scene: this,
      x: spawnPoint.x + offset.x,
      y: spawnPoint.y + offset.y,
      severity: severity,
      id: patientId,
    });

    this.patients.push(patient);
    this.patientsArrived++;

    // First walk to the waiting area walkToPoint
    const walkTo = gameConfig.patientSpawn.walkToPoint;
    const faceDir = gameConfig.patientSpawn.faceDirection;

    patient.walkTo(walkTo.x + offset.x, walkTo.y + offset.y, () => {
      // Face the configured direction after arriving
      patient.setDirection(faceDir);

      // Wait 3 seconds before trying to find a chair
      this.time.delayedCall(3000, () => {
        // Try to find an available chair
        const availableChair = this.findAvailableChair();

        if (availableChair) {
          // Walk to chair and sit
          patient.walkToChairAndSit(availableChair, () => {
            patient.setCurrentState("WAITING");
            console.log(`🪑 Patient ${patientId} seated in chair`);
          });
        } else {
          // No chair available, just stay standing
          patient.setCurrentState("WAITING");
        }
      });
    });

    console.log(`🚑 Patient ${patientId} spawned (severity: ${severity})`);

    // Decrease spawn rate (make spawns faster over time)
    this.currentSpawnRate = Math.max(
      gameConfig.minSpawnRateMs,
      this.currentSpawnRate - gameConfig.spawnRateDecreaseMs
    );

    // Schedule next spawn
    this.scheduleNextPatientSpawn();
  }

  /**
   * Get a random severity based on weights
   */
  private getRandomSeverity(weights: UrgencyWeights): number {
    const totalWeight =
      weights.severity1 +
      weights.severity2 +
      weights.severity3 +
      weights.severity4 +
      weights.severity5;

    let random = Math.random() * totalWeight;

    if (random < weights.severity1) return 1;
    random -= weights.severity1;

    if (random < weights.severity2) return 2;
    random -= weights.severity2;

    if (random < weights.severity3) return 3;
    random -= weights.severity3;

    if (random < weights.severity4) return 4;

    return 5;
  }

  /**
   * Remove a patient from the list (called when patient is destroyed)
   */
  removePatient(patientId: string): void {
    this.patients = this.patients.filter((p) => p.getId() !== patientId);
  }

  // Bed interaction disabled while beds are disabled.

  /**
   * Update room indicator based on player position
   */
  private updateRoomIndicator(): void {
    // Static label; dynamic rooms disabled (old config doesn't match Tiled)
    this.roomIndicator.setText("📍 ER");
  }

  /**
   * Create the HUD overlay
   */
  private createHUD(): void {
    // Timer
    this.timerText = this.add.text(20, 20, "10:00", {
      fontFamily: "Arial Black",
      fontSize: "32px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
    });
    this.timerText.setDepth(1000);
    this.timerText.setScrollFactor(0);

    // Chaos bar background
    const chaosBarBg = this.add.graphics();
    chaosBarBg.fillStyle(0x222222, 1);
    chaosBarBg.fillRoundedRect(GAME_CONFIG.WIDTH / 2 - 150, 15, 300, 30, 8);
    chaosBarBg.setDepth(1000);
    chaosBarBg.setScrollFactor(0);

    // Chaos bar fill
    this.chaosBar = this.add.graphics();
    this.chaosBar.setDepth(1001);
    this.chaosBar.setScrollFactor(0);
    this.updateChaosBar();

    // Chaos label
    this.add
      .text(GAME_CONFIG.WIDTH / 2, 8, "CHAOS", {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#888888",
      })
      .setOrigin(0.5)
      .setDepth(1002)
      .setScrollFactor(0);

    // Chaos percentage
    this.chaosText = this.add
      .text(GAME_CONFIG.WIDTH / 2, 30, "0%", {
        fontFamily: "Arial Black",
        fontSize: "16px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(1002)
      .setScrollFactor(0);

    // Pause hint
    this.add
      .text(GAME_CONFIG.WIDTH - 20, 20, "ESC to pause", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#666666",
      })
      .setOrigin(1, 0)
      .setDepth(1000)
      .setScrollFactor(0);

    // Room indicator
    this.roomIndicator = this.add
      .text(GAME_CONFIG.WIDTH - 20, 45, "📍 ER", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#888888",
      })
      .setOrigin(1, 0)
      .setDepth(1000)
      .setScrollFactor(0);

    // Bottom stats bar
    const hudY = GAME_CONFIG.HEIGHT - 80;
    const statsBarBg = this.add.graphics();
    statsBarBg.fillStyle(0x1a1a2e, 0.9);
    statsBarBg.fillRect(0, hudY - 10, GAME_CONFIG.WIDTH, 90);
    statsBarBg.setDepth(999);
    statsBarBg.setScrollFactor(0);

    this.statsText = this.add
      .text(
        GAME_CONFIG.WIDTH / 2,
        hudY + 20,
        "👥 Waiting: 0  |  🛏️ Beds: 0/0  |  💀 Deaths: 0  |  ✅ Saved: 0",
        {
          fontFamily: "Arial",
          fontSize: "20px",
          color: "#ffffff",
        }
      )
      .setOrigin(0.5)
      .setDepth(1000)
      .setScrollFactor(0);
  }

  /**
   * Update chaos bar visual
   */
  private updateChaosBar(): void {
    this.chaosBar.clear();

    const barWidth = 296;
    const fillWidth = (this.chaosScore / 100) * barWidth;

    // Color based on chaos level
    let color = 0x4ade80; // Green
    if (this.chaosScore > 70) color = 0xf97316; // Orange
    if (this.chaosScore > 90) color = 0xef4444; // Red

    this.chaosBar.fillStyle(color, 1);
    this.chaosBar.fillRoundedRect(
      GAME_CONFIG.WIDTH / 2 - 148,
      17,
      fillWidth,
      26,
      6
    );
  }

  /**
   * Update HUD elements
   */
  private updateHUD(): void {
    // Update timer display
    const minutes = Math.floor(this.shiftTimer / 60);
    const seconds = this.shiftTimer % 60;
    this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, "0")}`);

    // Flash timer when low
    if (this.shiftTimer <= 60) {
      this.timerText.setColor("#ff4757");
    }

    // Update chaos display
    this.chaosText.setText(`${Math.round(this.chaosScore)}%`);
    this.updateChaosBar();

    // Update stats
    const occupiedBeds = Array.from(this.beds.values()).filter(
      (b) => b.getState() === "OCCUPIED"
    ).length;
    const totalBeds = this.beds.size || 0;
    this.statsText.setText(
      `👥 Waiting: 0  |  🛏️ Beds: ${occupiedBeds}/${totalBeds}  |  💀 Deaths: ${this.patientsDied}  |  ✅ Saved: ${this.patientsSaved}`
    );
  }

  /**
   * Update shift timer (called every second)
   */
  private updateShiftTimer(): void {
    if (this.isPaused) return;

    this.shiftTimer--;

    if (this.shiftTimer <= 0) {
      this.endShift(true);
    }

    // Warning at 1 minute
    if (this.shiftTimer === 60) {
      EventBus.emit("shift:warning", { minutesLeft: 1 });
    }
  }

  /**
   * Set up pause functionality
   */
  private setupPause(): void {
    this.input.keyboard!.on("keydown-ESC", () => {
      this.pauseGame();
    });
  }

  /**
   * Set up debug mode toggle
   */
  private setupDebug(): void {
    this.input.keyboard!.on("keydown-F3", () => {
      this.debugMode = !this.debugMode;
      this.collisionManager.setDebugMode(this.debugMode);
      console.log(`Debug mode: ${this.debugMode ? "ON" : "OFF"}`);
    });
  }

  /**
   * Pause the game
   */
  private pauseGame(): void {
    this.isPaused = true;

    // Track peak chaos
    if (this.chaosScore > this.peakChaos) {
      this.peakChaos = this.chaosScore;
    }

    // Launch pause scene with current stats
    this.scene.launch(SCENES.PAUSE, {
      stats: {
        timeRemaining: this.shiftTimer,
        chaosScore: this.chaosScore,
        patientsArrived: this.patientsArrived,
        patientsSaved: this.patientsSaved,
        patientsDied: this.patientsDied,
      },
    });
    this.scene.pause();
  }

  /**
   * Resume the game (called from Pause scene)
   */
  public resumeGame(): void {
    this.isPaused = false;
  }

  /**
   * End the shift
   */
  private endShift(won: boolean): void {
    // Track peak chaos
    if (this.chaosScore > this.peakChaos) {
      this.peakChaos = this.chaosScore;
    }

    this.scene.start(SCENES.GAME_OVER, {
      won,
      stats: {
        patientsArrived: this.patientsArrived,
        patientsSaved: this.patientsSaved,
        patientsDied: this.patientsDied,
        staffBurnouts: 0,
        equipmentRepairs: 0,
        peakChaos: Math.round(this.peakChaos),
        finalChaos: Math.round(this.chaosScore),
        grade: this.calculateGrade(),
      },
    });
  }

  /**
   * Calculate final grade based on performance
   */
  private calculateGrade(): "S" | "A" | "B" | "C" | "D" | "F" {
    const totalPatients = this.patientsSaved + this.patientsDied;
    const saveRate =
      totalPatients > 0 ? (this.patientsSaved / totalPatients) * 100 : 100;

    if (saveRate >= 95 && this.peakChaos <= 50) return "S";
    if (saveRate >= 85 && this.peakChaos <= 70) return "A";
    if (saveRate >= 70 && this.peakChaos <= 80) return "B";
    if (saveRate >= 50) return "C";
    if (saveRate >= 30) return "D";
    return "F";
  }

  /**
   * Get a bed by ID
   */
  getBed(id: string): Bed | undefined {
    return this.beds.get(id);
  }

  /**
   * Get all beds
   */
  getAllBeds(): Bed[] {
    return Array.from(this.beds.values());
  }

  /**
   * Get available beds
   */
  getAvailableBeds(): Bed[] {
    return this.getAllBeds().filter((bed) => bed.isAvailable());
  }

  /**
   * Get player reference
   */
  getPlayer(): Player {
    return this.player;
  }

  /**
   * Add to chaos score
   */
  addChaos(amount: number): void {
    this.chaosScore = Math.min(100, this.chaosScore + amount);
    if (this.chaosScore > this.peakChaos) {
      this.peakChaos = this.chaosScore;
    }

    // Check for game over
    if (this.chaosScore >= 100) {
      this.endShift(false);
    }
  }

  /**
   * Reduce chaos score
   */
  reduceChaos(amount: number): void {
    this.chaosScore = Math.max(0, this.chaosScore - amount);
  }

  /**
   * Record patient saved
   */
  recordPatientSaved(): void {
    this.patientsSaved++;
  }

  /**
   * Record patient death
   */
  recordPatientDeath(): void {
    this.patientsDied++;
    this.addChaos(20); // Deaths increase chaos
  }

  /**
   * Record patient arrival
   */
  recordPatientArrival(): void {
    this.patientsArrived++;
  }

  /**
   * Clean up on scene shutdown
   */
  shutdown(): void {
    this.imageMapLoader?.destroy();
    this.collisionManager?.destroy();
    this.interactionManager?.destroy();
    this.beds.clear();
  }
}
