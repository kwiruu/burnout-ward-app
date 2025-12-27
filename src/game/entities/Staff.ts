/**
 * Staff Entity
 * Staff members that perform tasks around the hospital
 * Supports AI-controlled patient treatment and fatigue system
 */

import { SpriteSheetConfig, getSpriteConfig } from "../config/SpriteConfigs";
import { PathfindingManager, PathPoint } from "../systems/PathfindingManager";
import { STAFF_CONFIG } from "../utils/Constants";
import { StaffState, StaffType, StaffData } from "../types";
import EventBus from "../utils/EventBus";

// Available staff skins
export const STAFF_SKINS = [
  "staff01",
  "staff02",
  "staff03",
  "staff04",
  "staff05",
  "staff06",
  "staff07",
  "staff08",
];

/**
 * Get a random staff skin key
 */
export function getRandomStaffSkin(): string {
  return STAFF_SKINS[Math.floor(Math.random() * STAFF_SKINS.length)];
}

export type StaffDirection = "down" | "up" | "left" | "right";

/**
 * A single step in a task
 */
export interface TaskStep {
  /** Position to walk to (map coordinates, offset will be applied) */
  walkTo?: { x: number; y: number };
  /** How many milliseconds to wait at this step */
  waitMs?: number;
  /** Animation to play during wait (e.g., "idle", "read", "drink") */
  animation?: string;
  /** Direction to face during animation */
  direction?: StaffDirection;
  /** Optional depth override for manual layer control */
  depth?: number;
}

/**
 * A task is a sequence of steps
 */
export interface StaffTask {
  /** Unique identifier for this task */
  id: string;
  /** Human-readable name */
  name: string;
  /** Steps to perform in order */
  steps: TaskStep[];
  /** Whether to loop the task (default: false, returns to spawn after) */
  loop?: boolean;
}

export interface StaffConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  id: string;
  /** Optional specific skin, otherwise random */
  spriteKey?: string;
  /** Optional name tag */
  name?: string;
  /** Staff type (nurse or doctor) */
  type?: StaffType;
  /** Skill level (affects treatment speed) */
  skill?: number;
}

export class Staff extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Ellipse;
  private nameTag: Phaser.GameObjects.Text | null = null;
  private fatigueIndicator: Phaser.GameObjects.Graphics | null = null;
  private fatigueBg: Phaser.GameObjects.Graphics | null = null;
  private emoteSprite: Phaser.GameObjects.Sprite | null = null;
  private spriteConfig: SpriteSheetConfig | null = null;
  private spriteKey: string;
  private currentAnimKey: string = "";
  private direction: StaffDirection = "down";

  // Identity
  private staffId: string;
  private staffName: string;
  private staffType: StaffType;

  // Stats
  private fatigue: number = 0;
  private skill: number = 1;
  private currentState: StaffState = "IDLE";
  private assignedPatientId: string | null = null;

  // Spawn position (to return to)
  private spawnX: number;
  private spawnY: number;

  // Walking
  private walkTarget: { x: number; y: number } | null = null;
  private walkSpeed: number = STAFF_CONFIG.SPEED;
  private baseWalkSpeed: number = STAFF_CONFIG.SPEED;
  private onArriveCallback: (() => void) | null = null;

  // Pathfinding
  private pathfindingManager: PathfindingManager | null = null;
  private waypoints: PathPoint[] = [];
  private waypointIndex: number = 0;

  // Task system (legacy - keep for backwards compatibility)
  private isPerformingTask: boolean = false;
  private currentTask: StaffTask | null = null;
  private currentStepIndex: number = 0;
  private isWaiting: boolean = false;
  private waitTimer: Phaser.Time.TimerEvent | null = null;

  constructor(config: StaffConfig) {
    super(config.scene, config.x, config.y);

    this.staffId = config.id;
    this.staffName = config.name || "";
    this.staffType = config.type || "NURSE";
    this.skill = config.skill || STAFF_CONFIG.TYPES[this.staffType].skill;
    this.spawnX = config.x;
    this.spawnY = config.y;

    // Pick random skin or use provided one
    this.spriteKey =
      config.spriteKey ||
      STAFF_SKINS[Math.floor(Math.random() * STAFF_SKINS.length)];
    this.spriteConfig = getSpriteConfig(this.spriteKey) || null;

    // Create visual representation
    this.createVisuals();

    // Add to scene
    config.scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    // Update depth based on Y position
    this.updateDepth();

    // Play idle animation
    this.playAnimation("idle", "down");
  }

  /**
   * Create staff visuals
   */
  private createVisuals(): void {
    // Shadow under staff
    this.shadow = this.scene.add.ellipse(0, 24, 24, 10, 0x000000, 0.3);
    this.add(this.shadow);

    // Main sprite
    const textureKey = this.spriteConfig?.key || "staff01";
    // Y offset of -8 to align with 32x64 frame format
    this.sprite = this.scene.add.sprite(0, -8, textureKey, 0);
    this.add(this.sprite);

    // Fatigue indicator background
    // NOT added to container - positioned manually for higher depth
    this.fatigueBg = this.scene.add.graphics();
    this.fatigueBg.setDepth(500); // Above above-player layer (300)
    this.fatigueBg.setVisible(false);

    // Fatigue indicator bar
    // NOT added to container - positioned manually for higher depth
    this.fatigueIndicator = this.scene.add.graphics();
    this.fatigueIndicator.setDepth(501);
    this.fatigueIndicator.setVisible(false);

    // Name tag (optional)
    if (this.staffName) {
      this.nameTag = this.scene.add
        .text(0, -30, this.staffName, {
          fontFamily: "Arial",
          fontSize: "10px",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0.5);
      this.add(this.nameTag);
    }

    // Emote sprite (hidden by default, shown above staff head)
    // NOT added to container - positioned manually for higher depth
    this.emoteSprite = this.scene.add.sprite(
      this.x,
      this.y - 60,
      "emote_heart",
      0
    );
    this.emoteSprite.setVisible(false);
    this.emoteSprite.setDepth(600); // Above above-player layer and indicators

    // Update fatigue visual
    this.updateFatigueIndicator();
  }

  /**
   * Update depth based on Y position (for proper rendering order)
   */
  updateDepth(): void {
    this.setDepth(80 + this.y * 0.1);
    // Update UI element positions (they're not in container)
    this.updateUIPositions();
  }

  /**
   * Update positions of UI elements that are not in the container
   */
  private updateUIPositions(): void {
    // Update fatigue indicator position
    this.updateFatigueIndicator();

    // Update emote position
    if (this.emoteSprite) {
      this.emoteSprite.setPosition(this.x + 20, this.y - 45);
    }
  }

  /**
   * Play animation
   */
  playAnimation(action: string, direction: StaffDirection): void {
    if (!this.spriteConfig || !this.sprite) return;

    const animKey = `${this.spriteKey}_${action}_${direction}`;

    // Don't restart if already playing
    if (this.currentAnimKey === animKey) return;

    // Check if animation exists before playing
    if (this.scene.anims.exists(animKey)) {
      this.sprite.play(animKey);
      this.currentAnimKey = animKey;
      this.direction = direction;
    } else {
      // Try without direction (for animations like "sleep", "drink", "read")
      const noDirectionKey = `${this.spriteKey}_${action}`;
      if (this.scene.anims.exists(noDirectionKey)) {
        this.sprite.play(noDirectionKey);
        this.currentAnimKey = noDirectionKey;
      } else {
        // Fallback to idle
        this.sprite.setFrame(0);
        console.warn(`Animation ${animKey} not found`);
      }
    }
  }

  /**
   * Set direction (for facing)
   */
  setDirection(direction: StaffDirection): void {
    this.direction = direction;
    this.playAnimation("idle", direction);
  }

  /**
   * Walk to a target position
   */
  walkTo(x: number, y: number, onArrive?: () => void): void {
    this.walkTarget = { x, y };
    this.onArriveCallback = onArrive || null;

    // Determine walking direction based on target
    const dx = x - this.x;
    const dy = y - this.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      this.direction = dx > 0 ? "right" : "left";
    } else {
      this.direction = dy > 0 ? "down" : "up";
    }

    this.playAnimation("walk", this.direction);
  }

  /**
   * Update staff (call each frame)
   */
  update(delta: number): void {
    if (!this.walkTarget) return;

    const dx = this.walkTarget.x - this.x;
    const dy = this.walkTarget.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 2) {
      // Arrived at current waypoint
      this.x = this.walkTarget.x;
      this.y = this.walkTarget.y;

      // Check for more waypoints
      if (
        this.waypoints.length > 0 &&
        this.waypointIndex < this.waypoints.length - 1
      ) {
        // Move to next waypoint
        this.waypointIndex++;
        const nextWaypoint = this.waypoints[this.waypointIndex];
        this.walkTarget = { x: nextWaypoint.x, y: nextWaypoint.y };

        // Update direction for next segment
        const nextDx = nextWaypoint.x - this.x;
        const nextDy = nextWaypoint.y - this.y;
        if (Math.abs(nextDx) > Math.abs(nextDy)) {
          this.direction = nextDx > 0 ? "right" : "left";
        } else {
          this.direction = nextDy > 0 ? "down" : "up";
        }
        this.playAnimation("walk", this.direction);
      } else {
        // No more waypoints, we're done
        this.walkTarget = null;
        this.waypoints = [];
        this.waypointIndex = 0;

        // Play idle animation
        this.playAnimation("idle", this.direction);

        // Update depth
        this.updateDepth();

        // Call arrive callback
        if (this.onArriveCallback) {
          this.onArriveCallback();
          this.onArriveCallback = null;
        }
      }
    } else {
      // Move towards target
      const moveSpeed = this.walkSpeed * (delta / 1000);
      const ratio = moveSpeed / distance;

      this.x += dx * ratio;
      this.y += dy * ratio;

      // Update direction based on movement
      if (Math.abs(dx) > Math.abs(dy)) {
        const newDir = dx > 0 ? "right" : "left";
        if (this.direction !== newDir) {
          this.direction = newDir;
          this.playAnimation("walk", this.direction);
        }
      } else {
        const newDir = dy > 0 ? "down" : "up";
        if (this.direction !== newDir) {
          this.direction = newDir;
          this.playAnimation("walk", this.direction);
        }
      }

      // Update depth while walking
      this.updateDepth();
    }
  }

  /**
   * Check if staff is currently walking
   */
  isWalking(): boolean {
    return this.walkTarget !== null;
  }

  // ===========================================
  // TASK SYSTEM
  // ===========================================

  /**
   * Start performing a task
   */
  startTask(task: StaffTask): void {
    if (this.isPerformingTask) {
      console.warn(`Staff ${this.staffId} is already performing a task`);
      return;
    }

    this.isPerformingTask = true;
    this.currentTask = task;
    this.currentStepIndex = 0;

    console.log(`👷 Staff ${this.staffId} starting task: ${task.name}`);
    EventBus.emit("staff:task_started", { staffId: this.staffId, task });

    this.executeCurrentStep();
  }

  /**
   * Stop the current task and return to spawn
   */
  stopTask(): void {
    if (!this.isPerformingTask) return;

    // Clear wait timer if any
    if (this.waitTimer) {
      this.waitTimer.destroy();
      this.waitTimer = null;
    }

    this.isPerformingTask = false;
    this.isWaiting = false;
    this.currentTask = null;
    this.currentStepIndex = 0;

    // Return to spawn position
    this.returnToSpawn();

    EventBus.emit("staff:task_stopped", { staffId: this.staffId });
  }

  /**
   * Execute the current step of the task
   */
  private executeCurrentStep(): void {
    if (
      !this.currentTask ||
      this.currentStepIndex >= this.currentTask.steps.length
    ) {
      // Task completed
      this.onTaskComplete();
      return;
    }

    const step = this.currentTask.steps[this.currentStepIndex];

    // If step has a walkTo, walk there first
    if (step.walkTo) {
      this.walkTo(step.walkTo.x, step.walkTo.y, () => {
        this.executeStepAction(step);
      });
    } else {
      // No walking needed, execute action immediately
      this.executeStepAction(step);
    }
  }

  /**
   * Execute the action part of a step (wait, animation)
   */
  private executeStepAction(step: TaskStep): void {
    // Set direction if specified
    if (step.direction) {
      this.direction = step.direction;
    }

    // Apply custom depth if specified
    if (step.depth !== undefined) {
      this.setDepth(step.depth);
    } else {
      // Otherwise use normal depth calculation
      this.updateDepth();
    }

    // Play animation if specified
    if (step.animation) {
      this.playAnimation(step.animation, this.direction);
    }

    // Wait if specified
    if (step.waitMs && step.waitMs > 0) {
      this.isWaiting = true;
      this.waitTimer = this.scene.time.delayedCall(step.waitMs, () => {
        this.isWaiting = false;
        this.waitTimer = null;
        this.advanceToNextStep();
      });
    } else {
      // No wait, advance immediately
      this.advanceToNextStep();
    }
  }

  /**
   * Advance to the next step
   */
  private advanceToNextStep(): void {
    this.currentStepIndex++;
    this.executeCurrentStep();
  }

  /**
   * Called when task is complete
   */
  private onTaskComplete(): void {
    const task = this.currentTask;

    if (task?.loop) {
      // Loop the task
      this.currentStepIndex = 0;
      console.log(`🔄 Staff ${this.staffId} looping task: ${task.name}`);
      this.executeCurrentStep();
    } else {
      // Return to spawn
      console.log(`✅ Staff ${this.staffId} completed task: ${task?.name}`);
      EventBus.emit("staff:task_completed", { staffId: this.staffId, task });

      this.isPerformingTask = false;
      this.currentTask = null;
      this.currentStepIndex = 0;

      this.returnToSpawn();
    }
  }

  /**
   * Return to spawn position
   */
  returnToSpawn(): void {
    this.walkTo(this.spawnX, this.spawnY, () => {
      this.playAnimation("idle", "down");
      EventBus.emit("staff:returned_to_spawn", { staffId: this.staffId });
    });
  }

  /**
   * Check if staff is performing a task
   */
  getIsPerformingTask(): boolean {
    return this.isPerformingTask;
  }

  /**
   * Check if staff is currently waiting (during a task step)
   */
  getIsWaiting(): boolean {
    return this.isWaiting;
  }

  /**
   * Get current task
   */
  getCurrentTask(): StaffTask | null {
    return this.currentTask;
  }

  // ===========================================
  // FATIGUE & STATE SYSTEM
  // ===========================================

  /**
   * Update fatigue indicator visual
   */
  private updateFatigueIndicator(): void {
    if (!this.fatigueIndicator) return;

    this.fatigueIndicator.clear();
    if (this.fatigueBg) {
      this.fatigueBg.clear();
    }

    // Only show when fatigue > 20%
    const showIndicator = this.fatigue > 20;
    this.fatigueIndicator.setVisible(showIndicator);
    this.fatigueBg?.setVisible(showIndicator);

    if (!showIndicator) return;

    // Draw background at world position
    if (this.fatigueBg) {
      this.fatigueBg.fillStyle(0x333333, 0.8);
      this.fatigueBg.fillRect(this.x - 14, this.y - 48, 28, 6);
    }

    const percentage = this.fatigue / STAFF_CONFIG.FATIGUE.MAX;
    const barWidth = 28 * percentage;

    // Color based on fatigue level
    let color = 0x4ade80; // Green - low fatigue
    if (percentage > 0.5) color = 0xfbbf24; // Yellow - medium
    if (percentage > 0.8) color = 0xef4444; // Red - high/exhausted

    this.fatigueIndicator.fillStyle(color, 1);
    this.fatigueIndicator.fillRect(this.x - 14, this.y - 48, barWidth, 6);
  }

  /**
   * Show an emote above the staff's head
   * @param emoteType - Type of emote: "angry", "exclamation", "heart", "broken_heart", "tired", "question"
   * @param duration - Optional duration in ms before auto-hide (0 = no auto-hide)
   */
  showEmote(emoteType: string, duration: number = 0): void {
    if (!this.emoteSprite) return;

    // Change texture to the correct emote
    const textureKey = `emote_${emoteType}`;
    const animKey = `emote_${emoteType}_anim`;

    // Check if texture exists
    if (!this.scene.textures.exists(textureKey)) {
      console.warn(`Emote texture ${textureKey} not found`);
      return;
    }

    this.emoteSprite.setTexture(textureKey);
    this.emoteSprite.setVisible(true);

    // Play animation if it exists
    if (this.scene.anims.exists(animKey)) {
      this.emoteSprite.play(animKey);

      // After animation completes, hold on last frame for 4 seconds, then hide
      this.emoteSprite.once("animationcomplete", () => {
        this.scene.time.delayedCall(4000, () => {
          this.hideEmote();
        });
      });
    } else if (duration > 0) {
      // Fallback: Auto-hide after duration if animation doesn't exist
      this.scene.time.delayedCall(duration, () => {
        this.hideEmote();
      });
    }
  }

  /**
   * Hide the current emote
   */
  hideEmote(): void {
    if (!this.emoteSprite) return;
    this.emoteSprite.setVisible(false);
    this.emoteSprite.stop();
  }

  /**
   * Get current fatigue level
   */
  getFatigue(): number {
    return this.fatigue;
  }

  /**
   * Add to fatigue (can be negative to reduce)
   */
  addFatigue(amount: number): void {
    this.fatigue = Math.max(
      0,
      Math.min(STAFF_CONFIG.FATIGUE.MAX, this.fatigue + amount)
    );
    this.updateFatigueIndicator();

    // Update walk speed based on fatigue
    if (this.fatigue >= STAFF_CONFIG.FATIGUE.EXHAUSTED_THRESHOLD) {
      this.walkSpeed = this.baseWalkSpeed * 0.5; // 50% speed when exhausted
    } else {
      this.walkSpeed = this.baseWalkSpeed;
    }
  }

  /**
   * Get staff state
   */
  getStaffState(): StaffState {
    return this.currentState;
  }

  /**
   * Set staff state
   */
  setStaffState(state: StaffState): void {
    const oldState = this.currentState;
    this.currentState = state;

    EventBus.emit("staff:state_changed", {
      staffId: this.staffId,
      oldState,
      newState: state,
    });
  }

  /**
   * Get staff type
   */
  getStaffType(): StaffType {
    return this.staffType;
  }

  /**
   * Get skill level
   */
  getSkill(): number {
    return this.skill;
  }

  /**
   * Get assigned patient ID
   */
  getAssignedPatientId(): string | null {
    return this.assignedPatientId;
  }

  /**
   * Assign to a patient
   */
  assignToPatient(patientId: string): void {
    this.assignedPatientId = patientId;
    this.setStaffState("MOVING_TO_PATIENT");
  }

  /**
   * Clear current assignment
   */
  clearAssignment(): void {
    this.assignedPatientId = null;
    this.setStaffState("IDLE");
  }

  /**
   * Start treating assigned patient
   */
  startTreating(): void {
    this.setStaffState("TREATING");
    // Play treating animation (use idle facing the bed for now)
    this.playAnimation("idle", "left");
  }

  /**
   * Finish treating - return to idle
   */
  finishTreating(): void {
    this.assignedPatientId = null;
    this.setStaffState("IDLE");
    this.returnToSpawn();

    EventBus.emit("staff:treatment_complete", {
      staffId: this.staffId,
    });
  }

  /**
   * Become exhausted
   */
  becomeExhausted(): void {
    this.setStaffState("EXHAUSTED");

    // Visual feedback - tint slightly and show tired emote
    this.sprite.setTint(0xcccccc);
    this.showEmote("tired"); // Show tired emote when exhausted

    EventBus.emit("staff:exhausted", {
      staffId: this.staffId,
      fatigue: this.fatigue,
    });
  }

  /**
   * Finish resting - fully recovered
   */
  finishResting(): void {
    this.fatigue = 0;
    this.walkSpeed = this.baseWalkSpeed;
    this.sprite.clearTint();
    this.hideEmote(); // Hide tired emote when recovered
    this.setStaffState("IDLE");
    this.updateFatigueIndicator();

    EventBus.emit("staff:recovered", {
      staffId: this.staffId,
    });
  }

  /**
   * Show encourage effect (player encouraged this staff)
   */
  showEncourageEffect(): void {
    // Flash green and scale up briefly
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 150,
      yoyo: true,
      onStart: () => {
        this.sprite.setTint(0x4ade80);
      },
      onComplete: () => {
        if (this.currentState !== "EXHAUSTED") {
          this.sprite.clearTint();
        }
      },
    });
  }

  /**
   * Get staff data for UI/saving
   */
  getData(): StaffData {
    return {
      id: this.staffId,
      type: this.staffType,
      name: this.staffName,
      state: this.currentState,
      fatigue: this.fatigue,
      skill: this.skill,
      assignedPatientId: this.assignedPatientId,
      position: { x: this.x, y: this.y },
    };
  }

  // ===========================================
  // PATHFINDING
  // ===========================================

  /**
   * Set pathfinding manager
   */
  setPathfindingManager(manager: PathfindingManager): void {
    this.pathfindingManager = manager;
  }

  /**
   * Walk to target using pathfinding
   */
  walkToWithPathfinding(
    targetX: number,
    targetY: number,
    onArrive?: () => void
  ): void {
    if (!this.pathfindingManager) {
      // Fallback to direct walk if no pathfinding
      this.walkTo(targetX, targetY, onArrive);
      return;
    }

    this.onArriveCallback = onArrive || null;

    // Find path
    this.pathfindingManager
      .findPath(this.x, this.y, targetX, targetY)
      .then((path) => {
        if (path && path.length > 0) {
          this.waypoints = path;
          this.waypointIndex = 0;

          // Set first waypoint as target
          const firstWaypoint = this.waypoints[0];
          this.walkTarget = { x: firstWaypoint.x, y: firstWaypoint.y };

          // Start walking animation
          const dx = firstWaypoint.x - this.x;
          const dy = firstWaypoint.y - this.y;
          if (Math.abs(dx) > Math.abs(dy)) {
            this.direction = dx > 0 ? "right" : "left";
          } else {
            this.direction = dy > 0 ? "down" : "up";
          }
          this.playAnimation("walk", this.direction);
        } else {
          // Fallback to direct walk
          console.warn(
            `Staff ${this.staffId}: No path found, walking directly`
          );
          this.walkTo(targetX, targetY, onArrive);
        }
      });
  }

  // ===========================================
  // GETTERS
  // ===========================================

  /**
   * Get staff ID
   */
  getId(): string {
    return this.staffId;
  }

  /**
   * Get staff name
   */
  getName(): string {
    return this.staffName;
  }

  /**
   * Get current direction
   */
  getDirection(): StaffDirection {
    return this.direction;
  }

  /**
   * Get spawn position
   */
  getSpawnPosition(): { x: number; y: number } {
    return { x: this.spawnX, y: this.spawnY };
  }

  /**
   * Set spawn position (useful if staff needs to change home base)
   */
  setSpawnPosition(x: number, y: number): void {
    this.spawnX = x;
    this.spawnY = y;
  }

  /**
   * Destroy staff
   */
  destroy(fromScene?: boolean): void {
    if (this.waitTimer) {
      this.waitTimer.destroy();
      this.waitTimer = null;
    }
    this.sprite?.destroy();
    this.shadow?.destroy();
    this.nameTag?.destroy();
    this.fatigueIndicator?.destroy();
    this.fatigueBg?.destroy();
    this.emoteSprite?.destroy();
    super.destroy(fromScene);
  }
}
