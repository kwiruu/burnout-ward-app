/**
 * Patient Entity
 * Patients that arrive at the ER and need treatment
 */

import { PATIENT_CONFIG, EVENTS } from "../utils/Constants";
import { PatientState, PatientData } from "../types";
import { emit } from "../utils/EventBus";
import { SpriteSheetConfig, getSpriteConfig } from "../config/SpriteConfigs";
import { Chair } from "./Chair";
import { PathfindingManager, PathPoint } from "../systems/PathfindingManager";

// Available patient skins
export const PATIENT_SKINS = [
  "patient01",
  "patient02",
  "patient03",
  "patient04",
  "patient05",
  "patient06",
  "patient07",
  "patient08",
  "patient09",
];

/**
 * Get a random patient skin key
 */
export function getRandomPatientSkin(): string {
  return PATIENT_SKINS[Math.floor(Math.random() * PATIENT_SKINS.length)];
}

export type PatientDirection = "down" | "up" | "left" | "right";

export interface PatientConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  severity: number;
  id: string;
  /** Optional specific skin, otherwise random */
  spriteKey?: string;
}

export class Patient extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Ellipse;
  private severityIndicator: Phaser.GameObjects.Graphics;
  private timerBar: Phaser.GameObjects.Graphics;
  private timerBg: Phaser.GameObjects.Graphics;
  private treatmentBar: Phaser.GameObjects.Graphics | null = null;
  private treatmentBg: Phaser.GameObjects.Graphics | null = null;
  private emoteSprite: Phaser.GameObjects.Sprite | null = null;
  private spriteConfig: SpriteSheetConfig | null = null;
  private spriteKey: string;
  private currentAnimKey: string = "";
  private direction: PatientDirection = "down";

  // Data
  private patientId: string;
  private severity: number;
  private currentState: PatientState;
  private timer: number;
  private maxTimer: number;
  private assignedBedId: string | null = null;
  private assignedStaffId: string | null = null;
  private treatmentProgress: number = 0;
  private treatmentRate: number = 10; // Base progress per second
  private currentTreatmentRate: number = 10; // Actual rate (modified by staff skill)
  private treatmentPaused: boolean = false; // True if staff left mid-treatment

  // Walking
  private walkTarget: { x: number; y: number } | null = null;
  private walkSpeed: number = 80;
  private onArriveCallback: (() => void) | null = null;
  private waypoints: PathPoint[] = [];
  private waypointIndex: number = 0;
  private pathfindingManager: PathfindingManager | null = null;

  // Sitting
  private isSitting: boolean = false;
  private currentChair: Chair | null = null;

  // Lying in bed
  private isLying: boolean = false;
  private exitPoint: { x: number; y: number } | null = null;

  constructor(config: PatientConfig) {
    super(config.scene, config.x, config.y);

    this.patientId = config.id;
    this.severity = config.severity;
    this.currentState = "ARRIVING";
    this.maxTimer = PATIENT_CONFIG.TIMER_BY_SEVERITY[this.severity] || 60;
    this.timer = this.maxTimer;

    // Pick random skin or use provided one
    this.spriteKey =
      config.spriteKey ||
      PATIENT_SKINS[Math.floor(Math.random() * PATIENT_SKINS.length)];
    this.spriteConfig = getSpriteConfig(this.spriteKey) || null;

    // Create visual representation
    this.createVisuals();

    // Add to scene
    config.scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    // Update depth based on Y position
    this.updateDepth();

    // Play idle animation
    this.playAnimation("idle", "down");

    // Start timer updates
    config.scene.time.addEvent({
      delay: 1000,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true,
    });
  }

  /**
   * Create patient visuals
   */
  private createVisuals(): void {
    // Shadow under patient
    this.shadow = this.scene.add.ellipse(0, 24, 24, 10, 0x000000, 0.3);
    this.add(this.shadow);

    // Main sprite (actual character)
    const textureKey = this.spriteConfig?.key || "patient01";
    // Y offset of -8 to align with 32x64 frame format
    this.sprite = this.scene.add.sprite(0, -8, textureKey, 0);
    this.add(this.sprite);

    // Severity indicator (small colored circle above head)
    // NOT added to container - positioned manually for higher depth
    this.severityIndicator = this.scene.add.graphics();
    this.severityIndicator.setDepth(500); // Above above-player layer (300)
    this.updateSeverityIndicator();

    // Timer background (visible when waiting/in bed)
    // NOT added to container - positioned manually for higher depth
    this.timerBg = this.scene.add.graphics();
    this.timerBg.setDepth(500);
    this.timerBg.setVisible(false);
    this.updateTimerBgPosition();

    // Timer bar (visible when waiting/in bed)
    // NOT added to container - positioned manually for higher depth
    this.timerBar = this.scene.add.graphics();
    this.timerBar.setDepth(501);
    this.timerBar.setVisible(false);

    // Treatment progress background (hidden until being treated)
    // NOT added to container - positioned manually for higher depth
    this.treatmentBg = this.scene.add.graphics();
    this.treatmentBg.setDepth(500);
    this.treatmentBg.setVisible(false);

    // Treatment progress bar (hidden until being treated)
    // NOT added to container - positioned manually for higher depth
    this.treatmentBar = this.scene.add.graphics();
    this.treatmentBar.setDepth(501);
    this.treatmentBar.setVisible(false);

    // Emote sprite (hidden by default, shown above patient head)
    // NOT added to container - positioned manually for higher depth
    this.emoteSprite = this.scene.add.sprite(
      this.x,
      this.y - 60,
      "emote_heart",
      0
    );
    this.emoteSprite.setVisible(false);
    this.emoteSprite.setDepth(600); // Above above-player layer and indicators
  }

  /**
   * Update timer background position (for non-container elements)
   */
  private updateTimerBgPosition(): void {
    if (this.timerBg) {
      this.timerBg.setPosition(this.x, this.y);
    }
  }

  /**
   * Update severity indicator (colored circle above head)
   */
  private updateSeverityIndicator(): void {
    const color = PATIENT_CONFIG.COLORS[this.severity] || 0x4ade80;
    this.severityIndicator.clear();
    this.severityIndicator.fillStyle(color, 1);
    this.severityIndicator.fillCircle(this.x, this.y - 30, 6);
    this.severityIndicator.lineStyle(2, 0x000000, 0.5);
    this.severityIndicator.strokeCircle(this.x, this.y - 30, 6);
  }

  /**
   * Update positions of UI elements that are not in the container
   */
  private updateUIPositions(): void {
    // Update severity indicator position
    this.updateSeverityIndicator();

    // Update timer bar position
    if (this.timerBg) {
      this.timerBg.setPosition(this.x, this.y);
    }
    this.updateTimerBar();

    // Update treatment bar position
    this.updateTreatmentBar();

    // Update emote position
    if (this.emoteSprite) {
      this.emoteSprite.setPosition(this.x + 20, this.y - 45);
    }
  }

  /**
   * Show an emote above the patient's head
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
        this.scene.time.delayedCall(8000, () => {
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
   * Update depth based on Y position (for proper rendering order)
   */
  updateDepth(): void {
    this.setDepth(80 + this.y * 0.1);
    // Update UI element positions (they're not in container)
    this.updateUIPositions();
  }

  /**
   * Play animation
   */
  playAnimation(action: string, direction: PatientDirection): void {
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
      // Animation doesn't exist, just set the frame to 0 as fallback
      this.sprite.setFrame(0);
      console.warn(`Animation ${animKey} not found`);
    }
  }

  /**
   * Set direction (for facing)
   */
  setDirection(direction: PatientDirection): void {
    this.direction = direction;
    this.playAnimation("idle", direction);
  }

  /**
   * Set pathfinding manager reference
   */
  setPathfindingManager(manager: PathfindingManager): void {
    this.pathfindingManager = manager;
  }

  /**
   * Walk to a target position (with pathfinding if available)
   */
  walkTo(x: number, y: number, onArrive?: () => void): void {
    this.onArriveCallback = onArrive || null;

    // Try to use pathfinding if available
    if (this.pathfindingManager) {
      this.pathfindingManager.findPath(this.x, this.y, x, y).then((path) => {
        if (path && path.length > 0) {
          // Use pathfinding waypoints
          console.log(
            `🗺️ Patient ${this.patientId}: Using pathfinding (${path.length} waypoints)`
          );
          this.waypoints = path;
          this.waypointIndex = 0;
          this.moveToNextWaypoint();
        } else {
          // Fallback to direct movement if no path found
          console.warn(
            `⚠️ Patient ${this.patientId}: No path found, using direct movement`
          );
          this.walkDirect(x, y);
        }
      });
    } else {
      // No pathfinding, use direct movement
      this.walkDirect(x, y);
    }
  }

  /**
   * Walk directly to a position (no pathfinding)
   */
  private walkDirect(x: number, y: number): void {
    this.waypoints = [];
    this.waypointIndex = 0;
    this.walkTarget = { x, y };

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
   * Move to the next waypoint in the path
   */
  private moveToNextWaypoint(): void {
    if (this.waypointIndex >= this.waypoints.length) {
      // Path complete
      this.waypoints = [];
      this.waypointIndex = 0;
      this.walkTarget = null;
      this.playAnimation("idle", this.direction);

      if (this.onArriveCallback) {
        this.onArriveCallback();
        this.onArriveCallback = null;
      }
      return;
    }

    const waypoint = this.waypoints[this.waypointIndex];
    this.walkTarget = { x: waypoint.x, y: waypoint.y };

    // Determine walking direction based on target
    const dx = waypoint.x - this.x;
    const dy = waypoint.y - this.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      this.direction = dx > 0 ? "right" : "left";
    } else {
      this.direction = dy > 0 ? "down" : "up";
    }

    this.playAnimation("walk", this.direction);
  }

  /**
   * Update patient (call each frame for walking)
   */
  update(delta: number): void {
    if (!this.walkTarget) return;

    const dx = this.walkTarget.x - this.x;
    const dy = this.walkTarget.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 2) {
      // Arrived at current waypoint/target
      this.x = this.walkTarget.x;
      this.y = this.walkTarget.y;

      // Check if we have more waypoints
      if (this.waypoints.length > 0) {
        this.waypointIndex++;
        this.moveToNextWaypoint();
      } else {
        // No more waypoints, we're done
        this.walkTarget = null;

        // Play idle animation
        this.playAnimation("idle", this.direction);

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
   * Check if patient is currently walking
   */
  isWalking(): boolean {
    return this.walkTarget !== null;
  }

  /**
   * Update timer bar visual
   */
  private updateTimerBar(): void {
    this.timerBar.clear();
    if (this.timerBg) {
      this.timerBg.clear();
      this.timerBg.fillStyle(0x333333, 0.8);
      this.timerBg.fillRect(this.x - 15, this.y - 45, 30, 6);
    }

    const percentage = this.timer / this.maxTimer;
    const barWidth = 28 * percentage;

    // Color based on time remaining
    let color = 0x4ade80; // Green
    if (percentage < 0.5) color = 0xfbbf24; // Yellow
    if (percentage < 0.25) color = 0xef4444; // Red

    this.timerBar.fillStyle(color, 1);
    this.timerBar.fillRect(this.x - 14, this.y - 45, barWidth, 6);
  }

  /**
   * Update timer each second
   */
  private updateTimer(): void {
    // Only tick if waiting or in certain states
    if (this.currentState === "WAITING" || this.currentState === "IN_BED") {
      this.timer--;
      this.updateTimerBar();

      // Check for deterioration
      if (this.timer <= 0) {
        this.worsen();
      }

      // Visual warning when low
      if (this.timer <= 10 && this.timer > 0) {
        this.flashWarning();
      }
    }
  }

  /**
   * Flash warning when time is running out
   */
  private flashWarning(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 100,
      yoyo: true,
    });
  }

  /**
   * Patient condition worsens
   */
  private worsen(): void {
    const oldSeverity = this.severity;
    this.severity++;

    if (this.severity > 5) {
      this.die();
      return;
    }

    // Reset timer with new (shorter) duration
    this.maxTimer = PATIENT_CONFIG.TIMER_BY_SEVERITY[this.severity] || 30;
    this.timer = this.maxTimer;

    // Update severity indicator
    this.updateSeverityIndicator();

    emit(EVENTS.PATIENT_WORSENED, {
      patientId: this.patientId,
      oldSeverity,
      newSeverity: this.severity,
    });
  }

  /**
   * Patient dies
   */
  private die(): void {
    this.currentState = "DEAD";

    // Store bed ID before clearing (for event)
    const bedId = this.assignedBedId;

    // Visual effect - tint sprite gray
    this.sprite.setTint(0x333333);
    this.severityIndicator.clear();
    this.timerBar.clear();
    this.timerBg.clear();

    // Hide treatment bar if visible
    if (this.treatmentBar) this.treatmentBar.setVisible(false);
    if (this.treatmentBg) this.treatmentBg.setVisible(false);

    emit(EVENTS.PATIENT_DIED, {
      patientId: this.patientId,
      bedId: bedId,
      location: bedId ? "bed" : "waiting",
    });

    // Fade out and destroy
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 2000,
      onComplete: () => {
        this.cleanupUIElements();
        this.destroy();
      },
    });
  }

  /**
   * Triage this patient (reveal severity, mark as triaged)
   */
  triage(): void {
    if (this.currentState !== "WAITING") return;

    this.currentState = "TRIAGED";

    // Stand up if sitting
    if (this.isSitting) {
      this.standUp();
    }

    // Visual feedback
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 200,
      yoyo: true,
    });

    emit(EVENTS.PATIENT_TRIAGED, {
      patientId: this.patientId,
      severity: this.severity,
    });
  }

  /**
   * Assign to a bed and walk there
   */
  assignToBed(bedId: string, bedX: number, bedY: number): void {
    this.assignedBedId = bedId;
    this.currentState = "MOVING_TO_BED";

    // Stand up if sitting
    if (this.isSitting) {
      this.standUp();
    }

    // Hide timer while moving to bed
    this.timerBar.setVisible(false);
    this.timerBg.setVisible(false);

    emit(EVENTS.PATIENT_ASSIGNED_BED, {
      patientId: this.patientId,
      bedId,
    });

    // Walk to bed position
    this.walkTo(bedX, bedY, () => {
      this.arriveAtBed();
    });
  }

  /**
   * Arrive at bed - lie down
   */
  arriveAtBed(): void {
    this.currentState = "IN_BED";
    this.isLying = true;

    // Play sleep/lying animation
    this.playSleepAnimation();

    // Keep timer hidden
    this.timerBar.setVisible(false);
    this.timerBg.setVisible(false);

    // Hide shadow while lying
    this.shadow.setVisible(false);
  }

  /**
   * Play sleep/lying animation
   */
  private playSleepAnimation(): void {
    if (!this.spriteConfig || !this.sprite) return;

    const animKey = `${this.spriteKey}_sleep`;

    if (this.scene.anims.exists(animKey)) {
      this.sprite.play(animKey);
      this.currentAnimKey = animKey;
    }
  }

  /**
   * Start treatment
   * @param staffId - ID of the staff member treating
   * @param staffSkill - Skill level of staff (multiplies treatment rate)
   */
  startTreatment(staffId: string = "player", staffSkill: number = 1): void {
    if (this.currentState !== "IN_BED" && this.currentState !== "BEING_TREATED")
      return;

    this.assignedStaffId = staffId;
    this.currentState = "BEING_TREATED";
    this.treatmentPaused = false;

    // Treatment rate is modified by staff skill
    // Higher skill = faster treatment
    this.currentTreatmentRate = this.treatmentRate * staffSkill;

    // Only reset progress if starting fresh (not resuming)
    if (this.treatmentProgress === 0) {
      this.treatmentProgress = 0;
    }

    // Show treatment bar
    if (this.treatmentBg && this.treatmentBar) {
      this.treatmentBg.setVisible(true);
      this.treatmentBar.setVisible(true);
    }

    // Hide timer while being treated
    this.timerBar.setVisible(false);
    this.timerBg.setVisible(false);

    emit(EVENTS.PATIENT_TREATMENT_STARTED, {
      patientId: this.patientId,
      staffId,
      staffSkill,
    });
  }

  /**
   * Progress treatment (call each frame while treating)
   * Returns true if treatment is complete
   */
  progressTreatment(delta: number): boolean {
    if (this.currentState !== "BEING_TREATED" || this.treatmentPaused)
      return false;

    // Progress based on current treatment rate (modified by skill) and delta time
    const progressAmount = (this.currentTreatmentRate * delta) / 1000;
    this.treatmentProgress = Math.min(
      100,
      this.treatmentProgress + progressAmount
    );

    // Update treatment bar visual
    this.updateTreatmentBar();

    if (this.treatmentProgress >= 100) {
      this.stabilize();
      return true;
    }

    return false;
  }

  /**
   * Pause treatment (staff left mid-treatment)
   */
  pauseTreatment(): void {
    if (this.currentState !== "BEING_TREATED") return;

    this.treatmentPaused = true;
    this.assignedStaffId = null;

    // Change treatment bar color to indicate paused (yellow)
    this.updateTreatmentBar(true);

    console.log(
      `⏸️ Treatment paused for patient ${
        this.patientId
      } at ${this.treatmentProgress.toFixed(0)}%`
    );
  }

  /**
   * Resume treatment with a new staff member
   */
  resumeTreatment(staffId: string, staffSkill: number = 1): void {
    if (this.currentState !== "BEING_TREATED") return;

    this.treatmentPaused = false;
    this.assignedStaffId = staffId;
    this.currentTreatmentRate = this.treatmentRate * staffSkill;

    // Update bar back to blue
    this.updateTreatmentBar();

    console.log(
      `▶️ Treatment resumed for patient ${this.patientId} by ${staffId}`
    );
  }

  /**
   * Check if treatment is paused
   */
  isTreatmentPaused(): boolean {
    return this.treatmentPaused;
  }

  /**
   * Update treatment progress (direct set)
   */
  updateTreatment(progress: number): void {
    this.treatmentProgress = progress;
    this.updateTreatmentBar();

    if (this.treatmentProgress >= 100) {
      this.stabilize();
    }
  }

  /**
   * Update treatment bar visual
   * @param paused - If true, show yellow (paused) color
   */
  private updateTreatmentBar(paused: boolean = false): void {
    if (!this.treatmentBar) return;

    this.treatmentBar.clear();
    if (this.treatmentBg) {
      this.treatmentBg.clear();
      this.treatmentBg.fillStyle(0x333333, 0.8);
      this.treatmentBg.fillRect(this.x - 15, this.y - 55, 30, 6);
    }

    const percentage = this.treatmentProgress / 100;
    const barWidth = 28 * percentage;

    // Blue for active treatment, yellow for paused
    const color = paused || this.treatmentPaused ? 0xfbbf24 : 0x3b82f6;
    this.treatmentBar.fillStyle(color, 1);
    this.treatmentBar.fillRect(this.x - 14, this.y - 55, barWidth, 6);
  }

  /**
   * Check if patient is being treated
   */
  isBeingTreated(): boolean {
    return this.currentState === "BEING_TREATED";
  }

  /**
   * Get treatment progress (0-100)
   */
  getTreatmentProgress(): number {
    return this.treatmentProgress;
  }

  /**
   * Patient is stabilized - stand up from bed
   */
  private stabilize(): void {
    this.currentState = "STABILIZED";
    this.isLying = false;

    // Clear tint and show heart emote instead of green tint
    this.sprite.clearTint();
    this.showEmote("heart"); // Show heart emote when healed
    this.severityIndicator.clear();
    this.timerBar.setVisible(false);
    this.timerBg.setVisible(false);

    // Hide treatment bar
    if (this.treatmentBar) this.treatmentBar.setVisible(false);
    if (this.treatmentBg) this.treatmentBg.setVisible(false);

    // Show shadow again
    this.shadow.setVisible(true);

    // Play idle animation (standing up)
    this.playAnimation("idle", "down");

    emit(EVENTS.PATIENT_STABILIZED, {
      patientId: this.patientId,
    });

    // Auto-discharge after delay
    this.scene.time.delayedCall(PATIENT_CONFIG.DISCHARGE_DELAY * 1000, () => {
      this.hideEmote(); // Hide emote when starting to leave
      this.startDischarge();
    });
  }

  /**
   * Set exit point for discharge
   */
  setExitPoint(x: number, y: number): void {
    this.exitPoint = { x, y };
  }

  /**
   * Start discharge - walk to exit
   */
  private startDischarge(): void {
    this.currentState = "DISCHARGING";

    // Walk to exit point if set, otherwise just fade out
    if (this.exitPoint) {
      this.walkTo(this.exitPoint.x, this.exitPoint.y, () => {
        this.completeDischarge();
      });
    } else {
      this.completeDischarge();
    }
  }

  /**
   * Complete discharge - remove from game
   */
  private completeDischarge(): void {
    this.currentState = "DISCHARGED";

    emit(EVENTS.PATIENT_DISCHARGED, {
      patientId: this.patientId,
    });

    // Fade out and destroy
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        this.cleanupUIElements();
        this.destroy();
      },
    });
  }

  /**
   * Cleanup UI elements that are not part of the container
   */
  private cleanupUIElements(): void {
    if (this.severityIndicator) {
      this.severityIndicator.destroy();
    }
    if (this.timerBar) {
      this.timerBar.destroy();
    }
    if (this.timerBg) {
      this.timerBg.destroy();
    }
    if (this.treatmentBar) {
      this.treatmentBar.destroy();
    }
    if (this.treatmentBg) {
      this.treatmentBg.destroy();
    }
    if (this.emoteSprite) {
      this.emoteSprite.destroy();
    }
  }

  /**
   * Get patient data
   */
  getData(): PatientData {
    return {
      id: this.patientId,
      severity: this.severity,
      state: this.currentState,
      timer: this.timer,
      maxTimer: this.maxTimer,
      assignedBedId: this.assignedBedId,
      assignedStaffId: this.assignedStaffId,
      treatmentProgress: this.treatmentProgress,
      position: { x: this.x, y: this.y },
    };
  }

  /**
   * Get patient state
   */
  getState(): PatientState {
    return this.currentState;
  }

  /**
   * Get patient ID
   */
  getId(): string {
    return this.patientId;
  }

  /**
   * Get severity
   */
  getSeverity(): number {
    return this.severity;
  }

  /**
   * Check if patient is lying in bed
   */
  getIsLying(): boolean {
    return this.isLying;
  }

  /**
   * Set state directly (for state machine)
   */
  setCurrentState(state: PatientState): void {
    this.currentState = state;
  }

  /**
   * Walk to a chair and sit down
   */
  walkToChairAndSit(chair: Chair, onSeated?: () => void): void {
    if (chair.getIsOccupied()) return;

    // Walk to chair position
    this.walkTo(chair.x, chair.y, () => {
      this.sitInChair(chair);
      if (onSeated) onSeated();
    });
  }

  /**
   * Sit in a chair directly
   */
  sitInChair(chair: Chair): boolean {
    if (this.isSitting || chair.getIsOccupied()) return false;

    // Mark chair as occupied
    chair.setOccupied(true);
    this.currentChair = chair;
    this.isSitting = true;
    this.walkTarget = null; // Stop any walking

    // Position patient at chair with offset
    const offset = chair.getSitOffset();
    this.x = chair.x + offset.x;
    this.y = chair.y + offset.y;

    // Get correct animation based on chair direction
    const animAction = chair.getSitAnimationAction();
    const animDirection = chair.getSitAnimationDirection();
    this.playAnimation(animAction, animDirection as PatientDirection);

    // Set depth based on chair direction for proper rendering
    this.setDepth(chair.getSitDepth());

    return true;
  }

  /**
   * Stand up from chair
   */
  standUp(): boolean {
    if (!this.isSitting || !this.currentChair) return false;

    // Free the chair
    this.currentChair.setOccupied(false);
    this.currentChair = null;
    this.isSitting = false;

    // Reset depth to normal
    this.updateDepth();

    // Play idle animation in the current direction
    this.playAnimation("idle", this.direction);

    return true;
  }

  /**
   * Check if patient is sitting
   */
  getIsSitting(): boolean {
    return this.isSitting;
  }

  /**
   * Get current chair (if sitting)
   */
  getCurrentChair(): Chair | null {
    return this.currentChair;
  }
}
