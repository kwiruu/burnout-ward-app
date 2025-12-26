/**
 * Staff Entity
 * Staff members that perform tasks around the hospital
 */

import { SpriteSheetConfig, getSpriteConfig } from "../config/SpriteConfigs";
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
}

export class Staff extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Ellipse;
  private nameTag: Phaser.GameObjects.Text | null = null;
  private spriteConfig: SpriteSheetConfig | null = null;
  private spriteKey: string;
  private currentAnimKey: string = "";
  private direction: StaffDirection = "down";

  // Identity
  private staffId: string;
  private staffName: string;

  // Spawn position (to return to)
  private spawnX: number;
  private spawnY: number;

  // Walking
  private walkTarget: { x: number; y: number } | null = null;
  private walkSpeed: number = 80;
  private onArriveCallback: (() => void) | null = null;

  // Task system
  private isPerformingTask: boolean = false;
  private currentTask: StaffTask | null = null;
  private currentStepIndex: number = 0;
  private isWaiting: boolean = false;
  private waitTimer: Phaser.Time.TimerEvent | null = null;

  constructor(config: StaffConfig) {
    super(config.scene, config.x, config.y);

    this.staffId = config.id;
    this.staffName = config.name || "";
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
    this.sprite = this.scene.add.sprite(0, 0, textureKey, 0);
    this.add(this.sprite);

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
  }

  /**
   * Update depth based on Y position (for proper rendering order)
   */
  updateDepth(): void {
    this.setDepth(80 + this.y * 0.1);
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
      // Arrived at target
      this.x = this.walkTarget.x;
      this.y = this.walkTarget.y;
      this.walkTarget = null;

      // Play idle animation
      this.playAnimation("idle", this.direction);

      // Update depth
      this.updateDepth();

      // Call arrive callback
      if (this.onArriveCallback) {
        this.onArriveCallback();
        this.onArriveCallback = null;
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
    super.destroy(fromScene);
  }
}
