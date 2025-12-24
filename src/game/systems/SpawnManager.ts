/**
 * Spawn Manager System
 * Handles patient spawning throughout the shift
 */

import { Scene } from "phaser";
import {
  SPAWN_CONFIG,
  DIFFICULTY,
  DifficultyLevel,
  EVENTS,
} from "../utils/Constants";
import { Patient } from "../entities/Patient";
import { emit } from "../utils/EventBus";

export class SpawnManager {
  private scene: Scene;
  private difficulty: DifficultyLevel;
  private shiftDuration: number;
  private elapsedTime: number = 0;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private patientCounter: number = 0;
  private patients: Patient[] = [];

  // Spawn position
  private spawnX: number;
  private spawnY: number;

  constructor(
    scene: Scene,
    difficulty: DifficultyLevel,
    shiftDuration: number
  ) {
    this.scene = scene;
    this.difficulty = difficulty;
    this.shiftDuration = shiftDuration;

    // Default spawn position (entrance/ambulance bay)
    this.spawnX = 80;
    this.spawnY = 300;

    this.startSpawning();
  }

  /**
   * Start the spawn timer
   */
  private startSpawning(): void {
    this.scheduleNextSpawn();
  }

  /**
   * Schedule the next patient spawn
   */
  private scheduleNextSpawn(): void {
    const interval = this.calculateSpawnInterval();

    this.spawnTimer = this.scene.time.delayedCall(interval * 1000, () => {
      this.spawnPatient();
      this.scheduleNextSpawn();
    });
  }

  /**
   * Calculate current spawn interval based on progress
   */
  private calculateSpawnInterval(): number {
    const progress = this.elapsedTime / this.shiftDuration;
    const difficultyMultiplier =
      DIFFICULTY[this.difficulty].spawnRateMultiplier;

    // Interval decreases over time (more frequent spawns)
    let interval =
      SPAWN_CONFIG.BASE_INTERVAL -
      progress * (SPAWN_CONFIG.BASE_INTERVAL - SPAWN_CONFIG.MIN_INTERVAL);

    // Apply difficulty modifier
    interval *= difficultyMultiplier;

    // Add some randomness (±20%)
    const variance = interval * 0.2;
    interval += Math.random() * variance * 2 - variance;

    return Math.max(SPAWN_CONFIG.MIN_INTERVAL, interval);
  }

  /**
   * Spawn a new patient
   */
  private spawnPatient(): void {
    const severity = this.calculateSeverity();
    const id = `patient_${++this.patientCounter}`;

    const patient = new Patient({
      scene: this.scene,
      x: this.spawnX,
      y: this.spawnY + (Math.random() * 40 - 20), // Slight Y variance
      severity,
      id,
    });

    this.patients.push(patient);

    // Emit event
    emit(EVENTS.PATIENT_ARRIVED, {
      patient: patient.getData(),
    });

    // Move patient to waiting area
    this.moveToWaitingArea(patient);
  }

  /**
   * Calculate patient severity based on shift progress
   */
  private calculateSeverity(): number {
    const progress = this.elapsedTime / this.shiftDuration;

    // Interpolate between early and late severity weights
    const earlyWeights = SPAWN_CONFIG.EARLY_SEVERITY_WEIGHTS;
    const lateWeights = SPAWN_CONFIG.LATE_SEVERITY_WEIGHTS;

    const weights: Record<number, number> = {};
    for (let i = 1; i <= 5; i++) {
      weights[i] =
        earlyWeights[i] + (lateWeights[i] - earlyWeights[i]) * progress;
    }

    // Random selection based on weights
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let random = Math.random() * total;

    for (let severity = 1; severity <= 5; severity++) {
      random -= weights[severity];
      if (random <= 0) {
        return severity;
      }
    }

    return 3; // Default to medium
  }

  /**
   * Move patient to waiting area
   */
  private moveToWaitingArea(patient: Patient): void {
    // Target position in waiting area
    const targetX = 150 + Math.random() * 100;
    const targetY = 150 + Math.random() * 250;

    // Animate movement
    this.scene.tweens.add({
      targets: patient,
      x: targetX,
      y: targetY,
      duration: 2000,
      ease: "Power1",
      onComplete: () => {
        patient.setState("WAITING");
      },
    });
  }

  /**
   * Update elapsed time
   */
  update(delta: number): void {
    this.elapsedTime += delta / 1000;
  }

  /**
   * Get all active patients
   */
  getPatients(): Patient[] {
    return this.patients.filter((p) => p.active);
  }

  /**
   * Get waiting patients
   */
  getWaitingPatients(): Patient[] {
    return this.patients.filter((p) => p.active && p.getState() === "WAITING");
  }

  /**
   * Get triaged patients needing beds
   */
  getTriagedPatients(): Patient[] {
    return this.patients.filter((p) => p.active && p.getState() === "TRIAGED");
  }

  /**
   * Remove patient from tracking
   */
  removePatient(patientId: string): void {
    this.patients = this.patients.filter((p) => p.getId() !== patientId);
  }

  /**
   * Set spawn position
   */
  setSpawnPosition(x: number, y: number): void {
    this.spawnX = x;
    this.spawnY = y;
  }

  /**
   * Pause spawning
   */
  pause(): void {
    if (this.spawnTimer) {
      this.spawnTimer.paused = true;
    }
  }

  /**
   * Resume spawning
   */
  resume(): void {
    if (this.spawnTimer) {
      this.spawnTimer.paused = false;
    }
  }

  /**
   * Stop spawning entirely
   */
  stop(): void {
    if (this.spawnTimer) {
      this.spawnTimer.destroy();
      this.spawnTimer = null;
    }
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.stop();
    this.patients = [];
  }
}
