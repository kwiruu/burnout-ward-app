/**
 * Patient Entity
 * Patients that arrive at the ER and need treatment
 */

import { PATIENT_CONFIG, EVENTS } from "../utils/Constants";
import { PatientState, PatientData } from "../types";
import { emit } from "../utils/EventBus";

export interface PatientConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  severity: number;
  id: string;
}

export class Patient extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Arc;
  private severityText: Phaser.GameObjects.Text;
  private timerBar: Phaser.GameObjects.Graphics;
  private timerBg: Phaser.GameObjects.Graphics;

  // Data
  private patientId: string;
  private severity: number;
  private currentState: PatientState;
  private timer: number;
  private maxTimer: number;
  private assignedBedId: string | null = null;
  private assignedStaffId: string | null = null;
  private treatmentProgress: number = 0;

  constructor(config: PatientConfig) {
    super(config.scene, config.x, config.y);

    this.patientId = config.id;
    this.severity = config.severity;
    this.currentState = "ARRIVING";
    this.maxTimer = PATIENT_CONFIG.TIMER_BY_SEVERITY[this.severity] || 60;
    this.timer = this.maxTimer;

    // Create visual representation
    this.createVisuals();

    // Add to scene
    config.scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);

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

    // Timer background
    this.timerBg = this.scene.add.graphics();
    this.timerBg.fillStyle(0x333333, 0.8);
    this.timerBg.fillRect(-15, -30, 30, 4);
    this.add(this.timerBg);

    // Timer bar
    this.timerBar = this.scene.add.graphics();
    this.updateTimerBar();
    this.add(this.timerBar);

    // Main sprite (circle for now)
    this.sprite = this.scene.add.circle(0, 0, 14, color);
    this.add(this.sprite);

    // Severity number
    this.severityText = this.scene.add
      .text(0, 0, `${this.severity}`, {
        fontFamily: "Arial Black",
        fontSize: "14px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.add(this.severityText);
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
    this.timerBar.fillRect(-14, -30, barWidth, 4);
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

    // Update visuals
    const color = PATIENT_CONFIG.COLORS[this.severity];
    this.sprite.setFillStyle(color);
    this.severityText.setText(`${this.severity}`);

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

    // Visual effect
    this.sprite.setFillStyle(0x1a1a1a);
    this.severityText.setText("💀");
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

    // Green glow
    this.sprite.setFillStyle(0x4ade80);
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
}
