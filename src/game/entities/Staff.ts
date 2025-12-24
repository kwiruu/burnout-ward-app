/**
 * Staff Entity
 * Nurses and doctors that treat patients
 */

import { STAFF_CONFIG, EVENTS } from "../utils/Constants";
import { StaffState, StaffType, StaffData } from "../types";
import { emit } from "../utils/EventBus";

export interface StaffConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  type: StaffType;
  id: string;
  name?: string;
}

export class Staff extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Arc;
  private nameTag: Phaser.GameObjects.Text;
  private fatigueBar: Phaser.GameObjects.Graphics;

  // Data
  private staffId: string;
  private staffType: StaffType;
  private staffName: string;
  private currentState: StaffState;
  private fatigue: number = 0;
  private skill: number;
  private assignedPatientId: string | null = null;

  // Movement
  private targetX: number | null = null;
  private targetY: number | null = null;

  constructor(config: StaffConfig) {
    super(config.scene, config.x, config.y);

    this.staffId = config.id;
    this.staffType = config.type;
    this.staffName = config.name || this.generateName();
    this.currentState = "IDLE";
    this.skill = STAFF_CONFIG.TYPES[config.type].skill;

    // Create visual representation
    this.createVisuals();

    // Add to scene
    config.scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    // Start fatigue updates
    config.scene.time.addEvent({
      delay: 1000,
      callback: this.updateFatigue,
      callbackScope: this,
      loop: true,
    });
  }

  /**
   * Generate a random staff name
   */
  private generateName(): string {
    const nurseNames = ["Sarah", "Emily", "Maria", "Lisa", "Rachel", "Amy"];
    const doctorNames = ["Dr. Smith", "Dr. Chen", "Dr. Patel", "Dr. Wilson"];

    const names = this.staffType === "NURSE" ? nurseNames : doctorNames;
    return names[Math.floor(Math.random() * names.length)];
  }

  /**
   * Create staff visuals
   */
  private createVisuals(): void {
    const typeConfig = STAFF_CONFIG.TYPES[this.staffType];
    const color = typeConfig.color;

    // Fatigue bar
    this.fatigueBar = this.scene.add.graphics();
    this.add(this.fatigueBar);

    // Main sprite (circle for now)
    this.sprite = this.scene.add.circle(0, 0, 14, color);
    this.sprite.setStrokeStyle(2, 0xffffff);
    this.add(this.sprite);

    // Type indicator (N for nurse, D for doctor)
    const typeLabel = this.scene.add
      .text(0, 0, this.staffType === "NURSE" ? "N" : "D", {
        fontFamily: "Arial Black",
        fontSize: "12px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.add(typeLabel);

    // Name tag
    this.nameTag = this.scene.add
      .text(0, 22, this.staffName, {
        fontFamily: "Arial",
        fontSize: "10px",
        color: "#888888",
      })
      .setOrigin(0.5);
    this.add(this.nameTag);

    this.updateFatigueBar();
  }

  /**
   * Update fatigue bar visual
   */
  private updateFatigueBar(): void {
    this.fatigueBar.clear();

    if (this.fatigue > 20) {
      const percentage = this.fatigue / STAFF_CONFIG.FATIGUE.MAX;
      const barWidth = 24 * percentage;

      // Background
      this.fatigueBar.fillStyle(0x333333, 0.8);
      this.fatigueBar.fillRect(-12, -26, 24, 4);

      // Fill - color based on fatigue level
      let color = 0x4ade80; // Green
      if (this.fatigue > 50) color = 0xfbbf24; // Yellow
      if (this.fatigue > 80) color = 0xef4444; // Red

      this.fatigueBar.fillStyle(color, 1);
      this.fatigueBar.fillRect(-12, -26, barWidth, 4);
    }
  }

  /**
   * Update fatigue each second
   */
  private updateFatigue(): void {
    const rate =
      this.currentState === "TREATING"
        ? STAFF_CONFIG.FATIGUE.WORK_RATE
        : STAFF_CONFIG.FATIGUE.IDLE_RATE;

    if (this.currentState === "RESTING") {
      // Recover in break room
      this.fatigue = Math.max(
        0,
        this.fatigue - STAFF_CONFIG.FATIGUE.RECOVERY_RATE
      );

      // Return to IDLE when recovered
      if (this.fatigue < 30) {
        this.currentState = "IDLE";
        emit(EVENTS.STAFF_RECOVERED, { staffId: this.staffId });
      }
    } else {
      // Increase fatigue
      this.fatigue = Math.min(STAFF_CONFIG.FATIGUE.MAX, this.fatigue + rate);

      // Check for exhaustion
      if (
        this.fatigue >= STAFF_CONFIG.FATIGUE.EXHAUSTED_THRESHOLD &&
        this.currentState !== "EXHAUSTED"
      ) {
        this.becomeExhausted();
      }
    }

    this.updateFatigueBar();
  }

  /**
   * Become exhausted
   */
  private becomeExhausted(): void {
    this.currentState = "EXHAUSTED";

    // Visual indicator
    this.sprite.setAlpha(0.6);

    emit(EVENTS.STAFF_EXHAUSTED, {
      staffId: this.staffId,
    });
  }

  /**
   * Assign to a patient
   */
  assignToPatient(patientId: string, patientX: number, patientY: number): void {
    if (this.currentState === "EXHAUSTED" || this.currentState === "RESTING")
      return;

    this.assignedPatientId = patientId;
    this.currentState = "MOVING_TO_PATIENT";
    this.targetX = patientX;
    this.targetY = patientY;

    emit(EVENTS.STAFF_ASSIGNED, {
      staffId: this.staffId,
      patientId,
    });
  }

  /**
   * Update movement towards target
   */
  update(delta: number): void {
    if (this.targetX === null || this.targetY === null) return;

    const speed =
      this.currentState === "EXHAUSTED"
        ? STAFF_CONFIG.SPEED * 0.5
        : STAFF_CONFIG.SPEED;

    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.targetX,
      this.targetY
    );

    if (distance < 5) {
      // Arrived at target
      this.x = this.targetX;
      this.y = this.targetY;
      this.targetX = null;
      this.targetY = null;
      this.onArrived();
    } else {
      // Move towards target
      const angle = Phaser.Math.Angle.Between(
        this.x,
        this.y,
        this.targetX,
        this.targetY
      );
      this.x += Math.cos(angle) * speed * (delta / 1000);
      this.y += Math.sin(angle) * speed * (delta / 1000);
    }
  }

  /**
   * Called when arrived at target
   */
  private onArrived(): void {
    if (this.currentState === "MOVING_TO_PATIENT") {
      this.startTreating();
    }
  }

  /**
   * Start treating assigned patient
   */
  private startTreating(): void {
    this.currentState = "TREATING";

    emit(EVENTS.STAFF_STARTED_TREATMENT, {
      staffId: this.staffId,
      patientId: this.assignedPatientId,
    });
  }

  /**
   * Finish treating
   */
  finishTreating(): void {
    this.currentState = "IDLE";
    this.assignedPatientId = null;

    emit(EVENTS.STAFF_FINISHED_TREATMENT, {
      staffId: this.staffId,
    });
  }

  /**
   * Send to break room
   */
  sendToBreakRoom(breakRoomX: number, breakRoomY: number): void {
    this.currentState = "RESTING";
    this.assignedPatientId = null;
    this.targetX = breakRoomX;
    this.targetY = breakRoomY;
  }

  /**
   * Encourage staff (player action)
   */
  encourage(): void {
    // Small fatigue reduction
    this.fatigue = Math.max(0, this.fatigue - 10);
    this.updateFatigueBar();

    // Visual feedback
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 200,
      yoyo: true,
    });
  }

  /**
   * Get staff data
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

  /**
   * Get staff state
   */
  getState(): StaffState {
    return this.currentState;
  }

  /**
   * Get staff ID
   */
  getId(): string {
    return this.staffId;
  }

  /**
   * Get skill level
   */
  getSkill(): number {
    return this.skill;
  }

  /**
   * Check if available for assignment
   */
  isAvailable(): boolean {
    return (
      this.currentState === "IDLE" &&
      this.fatigue < STAFF_CONFIG.FATIGUE.EXHAUSTED_THRESHOLD
    );
  }

  /**
   * Get fatigue level
   */
  getFatigue(): number {
    return this.fatigue;
  }
}
