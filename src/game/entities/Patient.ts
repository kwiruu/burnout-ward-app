/**
 * Patient Entity
 * Patients that arrive at the ER and need treatment
 */

import { PATIENT_CONFIG, EVENTS } from "../utils/Constants";
import { PatientState, PatientData } from "../types";
import { emit } from "../utils/EventBus";
import { SpriteSheetConfig, getSpriteConfig } from "../config/SpriteConfigs";
import { Chair } from "./Chair";

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

  // Walking
  private walkTarget: { x: number; y: number } | null = null;
  private walkSpeed: number = 80;
  private onArriveCallback: (() => void) | null = null;

  // Sitting
  private isSitting: boolean = false;
  private currentChair: Chair | null = null;

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
    const color = PATIENT_CONFIG.COLORS[this.severity] || 0x4ade80;

    // Shadow under patient
    this.shadow = this.scene.add.ellipse(0, 24, 24, 10, 0x000000, 0.3);
    this.add(this.shadow);

    // Main sprite (actual character)
    const textureKey = this.spriteConfig?.key || "patient01";
    this.sprite = this.scene.add.sprite(0, 0, textureKey, 0);
    this.add(this.sprite);

    // Severity indicator (small colored circle above head)
    this.severityIndicator = this.scene.add.graphics();
    this.updateSeverityIndicator();
    this.add(this.severityIndicator);

    // Timer background (hidden by default)
    this.timerBg = this.scene.add.graphics();
    this.timerBg.fillStyle(0x333333, 0.8);
    this.timerBg.fillRect(-15, -38, 30, 4);
    this.timerBg.setVisible(false);
    this.add(this.timerBg);

    // Timer bar (hidden by default)
    this.timerBar = this.scene.add.graphics();
    this.updateTimerBar();
    this.timerBar.setVisible(false);
    this.add(this.timerBar);
  }

  /**
   * Update severity indicator (colored circle above head)
   */
  private updateSeverityIndicator(): void {
    const color = PATIENT_CONFIG.COLORS[this.severity] || 0x4ade80;
    this.severityIndicator.clear();
    this.severityIndicator.fillStyle(color, 1);
    this.severityIndicator.fillCircle(0, -30, 6);
    this.severityIndicator.lineStyle(2, 0x000000, 0.5);
    this.severityIndicator.strokeCircle(0, -30, 6);
  }

  /**
   * Update depth based on Y position (for proper rendering order)
   */
  updateDepth(): void {
    this.setDepth(80 + this.y * 0.1);
    // Keep severity indicator at a higher depth so it's always visible
    this.severityIndicator.setDepth(600);
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
   * Update patient (call each frame for walking)
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

    const percentage = this.timer / this.maxTimer;
    const barWidth = 28 * percentage;

    // Color based on time remaining
    let color = 0x4ade80; // Green
    if (percentage < 0.5) color = 0xfbbf24; // Yellow
    if (percentage < 0.25) color = 0xef4444; // Red

    this.timerBar.fillStyle(color, 1);
    this.timerBar.fillRect(-14, -38, barWidth, 4);
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

    // Visual effect - tint sprite gray
    this.sprite.setTint(0x333333);
    this.severityIndicator.clear();
    this.timerBar.clear();
    this.timerBg.clear();

    emit(EVENTS.PATIENT_DIED, {
      patientId: this.patientId,
      location: this.assignedBedId ? "bed" : "waiting",
    });

    // Fade out and destroy
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 2000,
      onComplete: () => {
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
   * Assign to a bed
   */
  assignToBed(bedId: string): void {
    this.assignedBedId = bedId;
    this.currentState = "MOVING_TO_BED";

    emit(EVENTS.PATIENT_ASSIGNED_BED, {
      patientId: this.patientId,
      bedId,
    });
  }

  /**
   * Arrive at bed
   */
  arriveAtBed(): void {
    this.currentState = "IN_BED";
  }

  /**
   * Start treatment
   */
  startTreatment(staffId: string): void {
    this.assignedStaffId = staffId;
    this.currentState = "BEING_TREATED";
    this.treatmentProgress = 0;
  }

  /**
   * Update treatment progress
   */
  updateTreatment(progress: number): void {
    this.treatmentProgress = progress;

    if (this.treatmentProgress >= 100) {
      this.stabilize();
    }
  }

  /**
   * Patient is stabilized
   */
  private stabilize(): void {
    this.currentState = "STABILIZED";

    // Green tint to indicate stabilized
    this.sprite.setTint(0x4ade80);
    this.severityIndicator.clear();
    this.timerBar.clear();
    this.timerBg.clear();

    emit(EVENTS.PATIENT_STABILIZED, {
      patientId: this.patientId,
    });

    // Auto-discharge after delay
    this.scene.time.delayedCall(PATIENT_CONFIG.DISCHARGE_DELAY * 1000, () => {
      this.discharge();
    });
  }

  /**
   * Discharge patient
   */
  private discharge(): void {
    this.currentState = "DISCHARGED";

    emit(EVENTS.PATIENT_DISCHARGED, {
      patientId: this.patientId,
    });

    // Fade out and destroy
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y - 20,
      duration: 500,
      onComplete: () => {
        this.destroy();
      },
    });
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
