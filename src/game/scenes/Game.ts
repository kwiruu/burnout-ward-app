import { Scene } from "phaser";
import { SCENES, GAME_CONFIG, MAP_PADDING, EVENTS } from "../utils/Constants";
import { GameSceneData } from "../types";
import EventBus from "../utils/EventBus";

// Import new systems
import { ImageMapLoader } from "../systems/ImageMapLoader";
import { CollisionManager } from "../systems/CollisionManager";
import { InteractionManager } from "../systems/InteractionManager";
import { PathfindingManager } from "../systems/PathfindingManager";
import { StaffAI } from "../systems/StaffAI";

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
  private pathfindingManager!: PathfindingManager;
  private staffAI!: StaffAI;

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

  // Selected patient for bed assignment (from triage interaction)
  private selectedPatientForBed: Patient | null = null;

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

  // Treatment tracking
  private currentTreatmentPatient: Patient | null = null;

  // Debug
  private debugMode: boolean = false;

  // Custom cursor
  private cursorSprite!: Phaser.GameObjects.Sprite;

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

    // Setup custom cursor
    this.setupCustomCursor();

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

    // Set up bed assignment hotkeys
    this.setupBedAssignment();

    // Set up patient event listeners
    this.setupPatientEvents();

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

    // Update custom cursor position
    const pointer = this.input.activePointer;
    this.cursorSprite.setPosition(pointer.x, pointer.y);

    // Update player
    this.player.update(delta);

    // Update doors (check proximity to player and NPCs for auto-open)
    const playerPos = this.player.getPosition();

    // Collect all NPC positions (patients and staff)
    const npcPositions = [
      ...this.patients.map((p) => ({ x: p.x, y: p.y })),
      ...this.staffs.map((s) => ({ x: s.x, y: s.y })),
    ];

    this.doors.forEach((door) =>
      door.update(playerPos.x, playerPos.y, delta, npcPositions)
    );

    // Update patients
    this.patients.forEach((patient) => patient.update(delta));

    // Update staff
    this.staffs.forEach((staff) => staff.update(delta));

    // Update Staff AI system
    this.staffAI.setPatients(this.patients.filter((p) => p.active));
    this.staffAI.update(delta);

    // Update treatment progress (player treatment)
    this.updateTreatment(delta);

    // Update tablets (for pointer indicator)
    const interactionRange = this.interactionManager.getInteractionRange();
    this.tablets.forEach((tablet) =>
      tablet.update(playerPos.x, playerPos.y, interactionRange)
    );

    // Update beds (for pointer indicator)
    this.beds.forEach((bed) =>
      bed.update(playerPos.x, playerPos.y, interactionRange)
    );

    // Update interaction manager with player position
    this.interactionManager.update(playerPos.x, playerPos.y);

    // Update room indicator (static)
    this.updateRoomIndicator();

    // Update HUD
    this.updateHUD();
  }

  /**
   * Update active treatment
   */
  private updateTreatment(delta: number): void {
    if (!this.currentTreatmentPatient) return;

    // Check if patient is still being treated
    if (!this.currentTreatmentPatient.isBeingTreated()) {
      // Treatment finished or patient state changed
      if (this.currentTreatmentPatient.getState() === "STABILIZED") {
        // Release the bed
        const bedId = this.currentTreatmentPatient.getData().assignedBedId;
        if (bedId) {
          const bed = this.beds.get(bedId);
          if (bed) {
            bed.release();
          }
        }
        this.patientsSaved++;
        console.log(`✅ Patient saved!`);
      }
      this.currentTreatmentPatient = null;
      return;
    }

    // Check if player is still near the bed
    const playerPos = this.player.getPosition();
    const bedId = this.currentTreatmentPatient.getData().assignedBedId;
    if (bedId) {
      const bed = this.beds.get(bedId);
      if (bed) {
        const distance = Phaser.Math.Distance.Between(
          playerPos.x,
          playerPos.y,
          bed.x,
          bed.y
        );
        const interactionRange = this.interactionManager.getInteractionRange();

        // Only progress treatment if player is close enough
        if (distance <= interactionRange * 1.5) {
          this.currentTreatmentPatient.progressTreatment(delta);
        }
      }
    }
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

  /**
   * Setup custom cursor sprite
   */
  private setupCustomCursor(): void {
    // Hide default cursor
    this.input.setDefaultCursor("none");

    // Create cursor sprite (frame 0 = normal, frame 1 = click)
    this.cursorSprite = this.add.sprite(0, 0, "cursor", 0);
    this.cursorSprite.setDepth(10000);
    this.cursorSprite.setScrollFactor(0);

    // Handle mouse down (show click frame)
    this.input.on("pointerdown", () => {
      this.cursorSprite.setFrame(1);
    });

    // Handle mouse up (show normal frame)
    this.input.on("pointerup", () => {
      this.cursorSprite.setFrame(0);
    });
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
    const mapBounds = getMapBounds(this.currentMap);
    this.collisionManager.setMapBounds(mapBounds);

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

    // Initialize pathfinding after collision is loaded
    this.pathfindingManager = new PathfindingManager(
      this,
      this.collisionManager,
      mapBounds,
      16 // tile size for pathfinding grid
    );
    console.log(`✅ Pathfinding initialized`);

    // Initialize Staff AI system
    const offset = getMapOffset(this.currentMap);
    this.staffAI = new StaffAI({
      scene: this,
      pathfindingManager: this.pathfindingManager,
      // Set break room position (default, can be configured per map)
      breakRoomPosition: this.currentMap.breakRoomPosition
        ? {
            x: this.currentMap.breakRoomPosition.x + offset.x,
            y: this.currentMap.breakRoomPosition.y + offset.y,
          }
        : { x: 200 + offset.x, y: 400 + offset.y },
    });
    console.log(`✅ Staff AI initialized`);
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
   * Beds are defined in MapConfigs.ts for each map
   */
  private createBeds(): void {
    const offset = getMapOffset(this.currentMap);
    this.beds.clear();

    // Check if beds array exists (for backwards compatibility)
    if (!this.currentMap.beds || this.currentMap.beds.length === 0) {
      console.log("ℹ️ No beds defined in map config");
      return;
    }

    this.currentMap.beds.forEach((bedConfig) => {
      const bed = new Bed({
        scene: this,
        x: bedConfig.x + offset.x,
        y: bedConfig.y + offset.y,
        number: bedConfig.number,
        id: bedConfig.id,
        direction: bedConfig.direction,
      });

      this.beds.set(bedConfig.id, bed);

      // Register bed as interactable
      this.interactionManager.register({
        id: bedConfig.id,
        x: bed.x,
        y: bed.y,
        type: "bed",
        promptYOffset: -50,
        getLabel: () => {
          // Check if bed has a patient needing treatment
          const patientInBed = this.getPatientInBed(bedConfig.id);
          if (patientInBed) {
            const state = patientInBed.getState();
            if (state === "IN_BED") {
              return "Treat";
            }
            if (state === "BEING_TREATED") {
              return `Treating ${Math.round(
                patientInBed.getTreatmentProgress()
              )}%`;
            }
          }
          // Check if there's a selected patient to assign
          if (this.selectedPatientForBed && bed.isAvailable()) {
            return "Assign";
          }
          return bed.getInteractionLabel();
        },
        canInteract: () => {
          // Can interact if bed has patient needing treatment
          const patientInBed = this.getPatientInBed(bedConfig.id);
          if (patientInBed) {
            const state = patientInBed.getState();
            if (state === "IN_BED" || state === "BEING_TREATED") {
              return true;
            }
          }
          // Can interact if there's a selected patient to assign
          if (this.selectedPatientForBed && bed.isAvailable()) {
            return true;
          }
          return bed.canInteract();
        },
        onInteract: () => {
          console.log(`🛏️ Interacting with bed: ${bedConfig.id}`);

          // First priority: treat patient in bed
          const patientInBed = this.getPatientInBed(bedConfig.id);
          if (patientInBed) {
            const state = patientInBed.getState();
            if (state === "IN_BED") {
              patientInBed.startTreatment("player");
              this.currentTreatmentPatient = patientInBed;
              console.log(
                `💉 Started treating patient in bed ${bed.getNumber()}`
              );
              return;
            }
          }

          // Second priority: assign selected patient (from triage)
          if (this.selectedPatientForBed && bed.isAvailable()) {
            const patientToAssign = this.selectedPatientForBed;
            this.selectedPatientForBed = null; // Clear selection after assignment
            this.assignPatientToBed(patientToAssign, bed);
            return;
          }

          if (!bed.getIsWorking()) {
            // Repair bed
            bed.repair();
            EventBus.emit("bed:repaired", { bedId: bedConfig.id });
          } else if (bed.getNeedsAttention()) {
            // Attend to patient
            bed.setNeedsAttention(false);
            EventBus.emit("bed:attended", { bedId: bedConfig.id });
          } else {
            // Check bed status
            EventBus.emit("bed:interact", {
              bedId: bedConfig.id,
              bed: bed.getData(),
            });
          }
        },
      });
    });

    console.log(`✅ Created ${this.beds.size} beds`);
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
        type: staffConfig.type,
        skill: staffConfig.skill,
      });

      // Set spawn position with offset applied
      staff.setSpawnPosition(
        staffConfig.x + offset.x,
        staffConfig.y + offset.y
      );

      // Set pathfinding manager
      staff.setPathfindingManager(this.pathfindingManager);

      // Register with Staff AI system
      this.staffAI.registerStaff(staff);

      this.staffs.push(staff);

      // Start auto-task if defined (legacy behavior)
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

      // Register staff for interaction
      this.registerStaffInteraction(staff);
    });

    // Set beds for Staff AI
    this.staffAI.setBeds(this.beds);

    console.log(`✅ Created ${this.staffs.length} staff members`);
  }

  /**
   * Register staff for player interaction
   */
  private registerStaffInteraction(staff: Staff): void {
    this.interactionManager.register({
      id: staff.getId(),
      x: staff.x,
      y: staff.y,
      type: "staff",
      promptYOffset: -50,
      getLabel: () => {
        const state = staff.getStaffState();
        const fatigue = staff.getFatigue();

        if (state === "EXHAUSTED" || fatigue >= 60) {
          return "Encourage";
        }
        if (state === "IDLE") {
          return "Send to Break Room";
        }
        if (state === "TREATING") {
          return `Treating (${Math.round(fatigue)}% fatigue)`;
        }
        return staff.getName() || "Staff";
      },
      canInteract: () => {
        const state = staff.getStaffState();
        // Can interact when idle, exhausted, or treating
        return (
          state === "IDLE" || state === "EXHAUSTED" || state === "TREATING"
        );
      },
      onInteract: () => {
        const state = staff.getStaffState();
        const fatigue = staff.getFatigue();

        if (state === "EXHAUSTED" || fatigue >= 60) {
          // Encourage - reduce fatigue
          this.staffAI.encourageStaff(staff);
          console.log(`💪 Encouraged ${staff.getName() || staff.getId()}`);
        } else if (state === "IDLE") {
          // Send to break room
          this.staffAI.sendToBreakRoom(staff);
          console.log(
            `😴 Sent ${staff.getName() || staff.getId()} to break room`
          );
        }
      },
      // Dynamic position - follows staff
      getPosition: () => ({ x: staff.x, y: staff.y }),
    });
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

    // Set pathfinding manager for collision-aware movement
    patient.setPathfindingManager(this.pathfindingManager);

    // Set exit point for discharge (same as spawn point)
    patient.setExitPoint(spawnPoint.x + offset.x, spawnPoint.y + offset.y);

    this.patients.push(patient);
    this.patientsArrived++;

    // Register patient as interactable for triage
    this.registerPatientInteraction(patient, patientId);

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
   * Register a patient for triage interaction
   */
  private registerPatientInteraction(
    patient: Patient,
    patientId: string
  ): void {
    this.interactionManager.register({
      id: patientId,
      x: patient.x,
      y: patient.y,
      type: "patient",
      promptYOffset: -50,
      getLabel: () => {
        const state = patient.getState();
        if (state === "WAITING") {
          return "Triage";
        }
        return "";
      },
      canInteract: () => {
        const state = patient.getState();
        return state === "WAITING";
      },
      onInteract: () => {
        const state = patient.getState();
        if (state === "WAITING") {
          // Triage the patient
          patient.triage();
          console.log(
            `🏥 Patient ${patientId} triaged (severity: ${patient.getSeverity()})`
          );

          // Select this patient for bed assignment
          this.selectedPatientForBed = patient;
          console.log(`📋 Selected patient ${patientId} for bed assignment`);

          // Show bed assignment UI hint
          this.showBedAssignmentHint(patient);
        }
      },
      // Dynamic position - follows patient
      getPosition: () => ({ x: patient.x, y: patient.y }),
    });
  }

  /**
   * Show hint for bed assignment after triage
   */
  private showBedAssignmentHint(_patient: Patient): void {
    // Could show a UI popup here, for now just log
    console.log(
      `💡 Press 1-6 to assign patient to a bed, or walk to a bed and press E`
    );
  }

  /**
   * Set up keyboard shortcuts for quick bed assignment (1-6 keys)
   */
  private setupBedAssignment(): void {
    // Keys 1-6 for quick bed assignment
    for (let i = 1; i <= 6; i++) {
      const keyName =
        i === 1
          ? "ONE"
          : i === 2
          ? "TWO"
          : i === 3
          ? "THREE"
          : i === 4
          ? "FOUR"
          : i === 5
          ? "FIVE"
          : "SIX";
      this.input.keyboard!.on(`keydown-${keyName}`, () => {
        this.quickAssignToBed(i);
      });
    }
  }

  /**
   * Quick assign the selected patient to a bed by number
   */
  private quickAssignToBed(bedNumber: number): void {
    if (!this.selectedPatientForBed) {
      console.log(`❌ No patient selected for bed assignment`);
      return;
    }

    const patient = this.selectedPatientForBed;

    const bed = this.getBedByNumber(bedNumber);
    if (!bed) {
      console.log(`❌ Bed ${bedNumber} not found`);
      return;
    }

    if (!bed.isAvailable()) {
      console.log(`❌ Bed ${bedNumber} is not available`);
      return;
    }

    // Clear selection after assignment
    this.selectedPatientForBed = null;
    this.assignPatientToBed(patient, bed);
  }

  /**
   * Get the next triaged patient (highest severity first)
   */
  private getNextTriagedPatient(): Patient | null {
    const triagedPatients = this.patients
      .filter((p) => p.active && p.getState() === "TRIAGED")
      .sort((a, b) => b.getSeverity() - a.getSeverity()); // Higher severity first

    return triagedPatients.length > 0 ? triagedPatients[0] : null;
  }

  /**
   * Get a bed by its number (1-6)
   */
  private getBedByNumber(bedNumber: number): Bed | null {
    for (const bed of this.beds.values()) {
      if (bed.getNumber() === bedNumber) {
        return bed;
      }
    }
    return null;
  }

  /**
   * Get patient in a specific bed
   */
  private getPatientInBed(bedId: string): Patient | null {
    return (
      this.patients.find(
        (p) => p.active && p.getData().assignedBedId === bedId
      ) || null
    );
  }

  /**
   * Assign a patient to a bed
   */
  private assignPatientToBed(patient: Patient, bed: Bed): void {
    // Reserve the bed
    bed.reserve(patient.getId());

    // Calculate bed position for patient (adjusted based on bed direction)
    const bedPos = bed.getPatientPosition();

    // Unregister patient interaction since they're being assigned
    this.interactionManager.unregister(patient.getId());

    // Start patient walking to bed
    patient.assignToBed(bed.getId(), bedPos.x, bedPos.y);

    console.log(
      `✅ Patient ${patient.getId()} assigned to bed ${bed.getNumber()}`
    );

    // When patient arrives, mark bed as occupied
    // This is handled in Patient.arriveAtBed(), but we also need to update bed state
    // We'll use a timer to check when patient is in bed
    const checkInterval = this.time.addEvent({
      delay: 100,
      callback: () => {
        if (patient.getState() === "IN_BED") {
          bed.occupy(patient.getId());
          checkInterval.destroy();
        }
      },
      loop: true,
    });
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
   * Setup patient event listeners
   */
  private setupPatientEvents(): void {
    // Release bed when patient dies
    EventBus.on(
      EVENTS.PATIENT_DIED,
      (data: {
        patientId: string;
        bedId: string | null;
        location: { x: number; y: number };
      }) => {
        console.log(`💀 Patient ${data.patientId} died`);

        // Release the bed if patient was assigned to one
        if (data.bedId) {
          const bed = this.beds.get(data.bedId);
          if (bed) {
            bed.release();
            console.log(
              `🛏️ Bed ${bed.getNumber()} released after patient death`
            );
          }
        }

        // Record the death in stats
        this.recordPatientDeath();
      }
    );

    // Release bed when patient is stabilized (treatment complete)
    EventBus.on(EVENTS.PATIENT_STABILIZED, (data: { patientId: string }) => {
      console.log(`✅ Patient ${data.patientId} stabilized`);

      // Find patient and release their bed
      const patient = this.patients.find((p) => p.getId() === data.patientId);
      if (patient) {
        const bedId = patient.getData().assignedBedId;
        if (bedId) {
          const bed = this.beds.get(bedId);
          if (bed) {
            bed.release();
            console.log(
              `🛏️ Bed ${bed.getNumber()} released - patient stabilized and leaving`
            );
          }
        }
      }

      // Record successful treatment
      this.patientsSaved++;
    });
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

    // Count waiting patients (WAITING or TRIAGED states)
    const waitingCount = this.patients.filter(
      (p) =>
        p.active && (p.getState() === "WAITING" || p.getState() === "TRIAGED")
    ).length;

    // Update stats
    const occupiedBeds = Array.from(this.beds.values()).filter(
      (b) => b.getState() === "OCCUPIED" || b.getState() === "RESERVED"
    ).length;
    const totalBeds = this.beds.size || 0;
    this.statsText.setText(
      `👥 Waiting: ${waitingCount}  |  🛏️ Beds: ${occupiedBeds}/${totalBeds}  |  💀 Deaths: ${this.patientsDied}  |  ✅ Saved: ${this.patientsSaved}`
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
    this.pathfindingManager?.destroy();
    this.beds.clear();
  }
}
