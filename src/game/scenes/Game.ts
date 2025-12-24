import { Scene } from "phaser";
import { SCENES, GAME_CONFIG } from "../utils/Constants";
import { GameSceneData } from "../types";
import EventBus from "../utils/EventBus";

// Import new systems
import { TileMapManager } from "../systems/TileMapManager";
import { CollisionManager } from "../systems/CollisionManager";
import {
  InteractionManager,
  Interactable,
} from "../systems/InteractionManager";

// Import entities
import { Player } from "../entities/Player";
import { Bed } from "../entities/Bed";

// Import map config
import {
  BED_POSITIONS,
  getSpawnPointByType,
  getRoomAtPosition,
} from "../config/ERMapConfig";

/**
 * Main Game Scene
 * Where all the ER action happens
 */
export class Game extends Scene {
  // Scene data
  private sceneData!: GameSceneData;

  // Systems
  private tileMapManager!: TileMapManager;
  private collisionManager!: CollisionManager;
  private interactionManager!: InteractionManager;

  // Game objects
  private player!: Player;
  private beds: Map<string, Bed> = new Map();

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
      shiftDuration: 600, // 10 minutes default
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
  }

  create(): void {
    // Background color
    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // Initialize systems
    this.initializeSystems();

    // Create the ER map
    this.tileMapManager.create();

    // Create beds
    this.createBeds();

    // Create player
    this.createPlayer();

    // Create HUD
    this.createHUD();

    // Start shift timer
    this.time.addEvent({
      delay: 1000,
      callback: this.updateShiftTimer,
      callbackScope: this,
      loop: true,
    });

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

    // Update interaction manager with player position
    const playerPos = this.player.getPosition();
    this.interactionManager.update(playerPos.x, playerPos.y);

    // Update room indicator
    this.updateRoomIndicator(playerPos.x, playerPos.y);

    // Update HUD
    this.updateHUD();
  }

  /**
   * Initialize all game systems
   */
  private initializeSystems(): void {
    // Tile map manager (renders the map)
    this.tileMapManager = new TileMapManager(this);

    // Collision manager (handles wall/furniture collision)
    this.collisionManager = new CollisionManager(this);

    // Interaction manager (handles E key interactions)
    this.interactionManager = new InteractionManager(this);
  }

  /**
   * Create beds from config
   */
  private createBeds(): void {
    BED_POSITIONS.forEach((bedPos) => {
      const bed = new Bed({
        scene: this,
        x: bedPos.x,
        y: bedPos.y,
        number: bedPos.number,
        id: bedPos.id,
      });

      // Add to collision manager
      const collisionRect = bed.getCollisionRect();
      this.collisionManager.addCollider(bedPos.id, collisionRect);

      // Register with interaction manager
      const interactable: Interactable = {
        id: bedPos.id,
        x: bedPos.x,
        y: bedPos.y,
        type: "bed",
        label: `Bed ${bedPos.number}`,
        canInteract: () => bed.canInteract(),
        onInteract: () => this.handleBedInteraction(bed),
      };
      this.interactionManager.register(interactable);

      this.beds.set(bedPos.id, bed);
    });
  }

  /**
   * Create the player character
   */
  private createPlayer(): void {
    // Get spawn point from config
    const spawnPoint = getSpawnPointByType("player");
    const startX = spawnPoint?.x || 375;
    const startY = spawnPoint?.y || 125;

    this.player = new Player({
      scene: this,
      x: startX,
      y: startY,
      collisionManager: this.collisionManager,
    });
  }

  /**
   * Handle bed interaction
   */
  private handleBedInteraction(bed: Bed): void {
    console.log(
      `Interacting with bed ${bed.getNumber()}, state: ${bed.getState()}`
    );

    if (!bed.getIsWorking()) {
      // Start repair
      console.log("Repairing bed...");
      bed.repair();
      EventBus.emit("bed:repaired", { bedId: bed.getId() });
      return;
    }

    if (bed.getNeedsAttention()) {
      // Attend to patient
      console.log("Attending to patient...");
      bed.setNeedsAttention(false);
      EventBus.emit("bed:attended", { bedId: bed.getId() });
      return;
    }

    // General interaction - show bed info
    EventBus.emit("bed:selected", {
      bedId: bed.getId(),
      number: bed.getNumber(),
      state: bed.getState(),
      patientId: bed.getPatientId(),
    });
  }

  /**
   * Update room indicator based on player position
   */
  private updateRoomIndicator(x: number, y: number): void {
    const room = getRoomAtPosition(x, y);
    if (room) {
      this.roomIndicator.setText(`${room.emoji} ${room.name}`);
    } else {
      this.roomIndicator.setText("📍 ER");
    }
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

    // Chaos bar background
    const chaosBarBg = this.add.graphics();
    chaosBarBg.fillStyle(0x222222, 1);
    chaosBarBg.fillRoundedRect(GAME_CONFIG.WIDTH / 2 - 150, 15, 300, 30, 8);
    chaosBarBg.setDepth(1000);

    // Chaos bar fill
    this.chaosBar = this.add.graphics();
    this.chaosBar.setDepth(1001);
    this.updateChaosBar();

    // Chaos label
    this.add
      .text(GAME_CONFIG.WIDTH / 2, 8, "CHAOS", {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#888888",
      })
      .setOrigin(0.5)
      .setDepth(1002);

    // Chaos percentage
    this.chaosText = this.add
      .text(GAME_CONFIG.WIDTH / 2, 30, "0%", {
        fontFamily: "Arial Black",
        fontSize: "16px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(1002);

    // Pause hint
    this.add
      .text(GAME_CONFIG.WIDTH - 20, 20, "ESC to pause", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#666666",
      })
      .setOrigin(1, 0)
      .setDepth(1000);

    // Room indicator
    this.roomIndicator = this.add
      .text(GAME_CONFIG.WIDTH - 20, 45, "📍 ER", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#888888",
      })
      .setOrigin(1, 0)
      .setDepth(1000);

    // Bottom stats bar
    const hudY = GAME_CONFIG.HEIGHT - 80;
    const statsBarBg = this.add.graphics();
    statsBarBg.fillStyle(0x1a1a2e, 0.9);
    statsBarBg.fillRect(0, hudY - 10, GAME_CONFIG.WIDTH, 90);
    statsBarBg.setDepth(999);

    this.statsText = this.add
      .text(
        GAME_CONFIG.WIDTH / 2,
        hudY + 20,
        "👥 Waiting: 0  |  🛏️ Beds: 0/6  |  💀 Deaths: 0  |  ✅ Saved: 0",
        {
          fontFamily: "Arial",
          fontSize: "20px",
          color: "#ffffff",
        }
      )
      .setOrigin(0.5)
      .setDepth(1000);
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
    this.statsText.setText(
      `👥 Waiting: 0  |  🛏️ Beds: ${occupiedBeds}/6  |  💀 Deaths: ${this.patientsDied}  |  ✅ Saved: ${this.patientsSaved}`
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
    this.tileMapManager?.destroy();
    this.collisionManager?.destroy();
    this.interactionManager?.destroy();
    this.beds.clear();
  }
}
