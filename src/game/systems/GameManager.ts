/**
 * Game Manager System
 * Handles overall game state, win/lose conditions, and chaos calculation
 */

import { Scene } from "phaser";
import {
  CHAOS_CONFIG,
  DIFFICULTY,
  DifficultyLevel,
  EVENTS,
  GRADE_CONFIG,
  Grade,
} from "../utils/Constants";
import { GameStats, GameState } from "../types";
import { emit, on, off } from "../utils/EventBus";

export class GameManager {
  private _gameScene: Scene;
  private gameState: GameState;
  private stats: GameStats;

  // Chaos calculation inputs
  private waitingPatients: number = 0;
  private criticalPatients: number = 0;
  private deaths: number = 0;
  private brokenEquipment: number = 0;
  private exhaustedStaff: number = 0;
  private occupiedBeds: number = 0;
  private totalBeds: number = 6;

  constructor(
    scene: Scene,
    difficulty: DifficultyLevel,
    shiftDuration: number
  ) {
    this._gameScene = scene;

    this.gameState = {
      isRunning: true,
      isPaused: false,
      shiftTimeRemaining: shiftDuration,
      shiftDuration: shiftDuration,
      chaosScore: 0,
      difficulty: difficulty,
    };

    this.stats = {
      patientsArrived: 0,
      patientsSaved: 0,
      patientsDied: 0,
      staffBurnouts: 0,
      equipmentRepairs: 0,
      peakChaos: 0,
      finalChaos: 0,
      grade: "C",
    };

    this.setupEventListeners();
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    on(
      EVENTS.PATIENT_ARRIVED,
      () => {
        this.stats.patientsArrived++;
        this.waitingPatients++;
        this.recalculateChaos();
      },
      this
    );

    on(
      EVENTS.PATIENT_TRIAGED,
      () => {
        this.waitingPatients--;
        this.recalculateChaos();
      },
      this
    );

    on(
      EVENTS.PATIENT_WORSENED,
      (data: { newSeverity: number }) => {
        if (data.newSeverity >= 4) {
          this.criticalPatients++;
          this.recalculateChaos();
        }
      },
      this
    );

    on(
      EVENTS.PATIENT_DIED,
      () => {
        this.deaths++;
        this.stats.patientsDied++;
        this.criticalPatients = Math.max(0, this.criticalPatients - 1);
        this.recalculateChaos();
        this.checkLoseCondition();
      },
      this
    );

    on(
      EVENTS.PATIENT_DISCHARGED,
      () => {
        this.stats.patientsSaved++;
        this.occupiedBeds = Math.max(0, this.occupiedBeds - 1);
        this.recalculateChaos();
      },
      this
    );

    on(
      EVENTS.PATIENT_ASSIGNED_BED,
      () => {
        this.occupiedBeds++;
        this.recalculateChaos();
      },
      this
    );

    on(
      EVENTS.STAFF_EXHAUSTED,
      () => {
        this.exhaustedStaff++;
        this.stats.staffBurnouts++;
        this.recalculateChaos();
      },
      this
    );

    on(
      EVENTS.STAFF_RECOVERED,
      () => {
        this.exhaustedStaff = Math.max(0, this.exhaustedStaff - 1);
        this.recalculateChaos();
      },
      this
    );

    on(
      EVENTS.EQUIPMENT_BROKEN,
      () => {
        this.brokenEquipment++;
        this.recalculateChaos();
      },
      this
    );

    on(
      EVENTS.EQUIPMENT_REPAIRED,
      () => {
        this.brokenEquipment = Math.max(0, this.brokenEquipment - 1);
        this.stats.equipmentRepairs++;
        this.recalculateChaos();
      },
      this
    );
  }

  /**
   * Update each frame
   */
  update(_delta: number): void {
    if (!this.gameState.isRunning || this.gameState.isPaused) return;

    // Natural chaos decay when things are calm
    if (this.gameState.chaosScore > 0) {
      const decay = CHAOS_CONFIG.DECAY_RATE * (_delta / 1000);
      this.gameState.chaosScore = Math.max(
        0,
        this.gameState.chaosScore - decay
      );
    }
  }

  /**
   * Update shift timer (called every second)
   */
  updateTimer(): void {
    if (!this.gameState.isRunning || this.gameState.isPaused) return;

    this.gameState.shiftTimeRemaining--;

    // Warning at 1 minute
    if (this.gameState.shiftTimeRemaining === 60) {
      emit(EVENTS.SHIFT_WARNING, { minutesLeft: 1 });
    }

    // Shift ended
    if (this.gameState.shiftTimeRemaining <= 0) {
      this.endShift(true);
    }
  }

  /**
   * Recalculate chaos score
   */
  private recalculateChaos(): void {
    const weights = CHAOS_CONFIG.WEIGHTS;

    const chaos =
      this.waitingPatients * weights.WAITING_PATIENT +
      this.criticalPatients * weights.CRITICAL_PATIENT +
      this.deaths * weights.DEATH +
      this.brokenEquipment * weights.BROKEN_EQUIPMENT +
      this.exhaustedStaff * weights.EXHAUSTED_STAFF +
      (this.occupiedBeds / this.totalBeds) * weights.FULL_BEDS * this.totalBeds;

    this.gameState.chaosScore = Math.min(CHAOS_CONFIG.MAX, chaos);

    // Track peak chaos
    if (this.gameState.chaosScore > this.stats.peakChaos) {
      this.stats.peakChaos = this.gameState.chaosScore;
    }

    // Emit chaos changed event
    const isWarning =
      this.gameState.chaosScore >= CHAOS_CONFIG.WARNING_THRESHOLD;
    const isCritical =
      this.gameState.chaosScore >= CHAOS_CONFIG.CRITICAL_THRESHOLD;

    emit(EVENTS.CHAOS_CHANGED, {
      oldValue: this.gameState.chaosScore,
      newValue: this.gameState.chaosScore,
      isWarning,
      isCritical,
    });

    // Check for chaos game over
    if (this.gameState.chaosScore >= CHAOS_CONFIG.MAX) {
      this.endShift(false, "Chaos reached maximum!");
    }
  }

  /**
   * Check lose conditions
   */
  private checkLoseCondition(): void {
    const difficultySettings = DIFFICULTY[this.gameState.difficulty];

    if (this.deaths >= difficultySettings.deathThreshold) {
      this.endShift(false, "Too many patient deaths");
    }
  }

  /**
   * End the shift
   */
  private endShift(won: boolean, reason?: string): void {
    this.gameState.isRunning = false;
    this.stats.finalChaos = this.gameState.chaosScore;
    this.stats.grade = this.calculateGrade();

    emit(EVENTS.GAME_OVER, {
      won,
      stats: this.stats,
      reason,
    });
  }

  /**
   * Calculate final grade
   */
  private calculateGrade(): Grade {
    const { patientsSaved, patientsDied } = this.stats;
    const totalPatients = patientsSaved + patientsDied;
    const saveRate =
      totalPatients > 0 ? (patientsSaved / totalPatients) * 100 : 100;
    const chaos = this.stats.peakChaos;

    // Check each grade threshold
    for (const [grade, config] of Object.entries(GRADE_CONFIG) as [
      Grade,
      (typeof GRADE_CONFIG)[Grade]
    ][]) {
      if (
        saveRate >= config.minScore &&
        patientsDied <= config.deaths &&
        chaos <= config.maxChaos
      ) {
        return grade;
      }
    }

    return "F";
  }

  /**
   * Pause the game
   */
  pause(): void {
    this.gameState.isPaused = true;
    emit(EVENTS.GAME_PAUSED, {});
  }

  /**
   * Resume the game
   */
  resume(): void {
    this.gameState.isPaused = false;
    emit(EVENTS.GAME_RESUMED, {});
  }

  /**
   * Get current game state
   */
  getState(): GameState {
    return { ...this.gameState };
  }

  /**
   * Get current stats
   */
  getStats(): GameStats {
    return { ...this.stats };
  }

  /**
   * Get chaos score
   */
  getChaosScore(): number {
    return this.gameState.chaosScore;
  }

  /**
   * Get time remaining
   */
  getTimeRemaining(): number {
    return this.gameState.shiftTimeRemaining;
  }

  /**
   * Clean up
   */
  destroy(): void {
    off(EVENTS.PATIENT_ARRIVED);
    off(EVENTS.PATIENT_TRIAGED);
    off(EVENTS.PATIENT_WORSENED);
    off(EVENTS.PATIENT_DIED);
    off(EVENTS.PATIENT_DISCHARGED);
    off(EVENTS.PATIENT_ASSIGNED_BED);
    off(EVENTS.STAFF_EXHAUSTED);
    off(EVENTS.STAFF_RECOVERED);
    off(EVENTS.EQUIPMENT_BROKEN);
    off(EVENTS.EQUIPMENT_REPAIRED);
  }
}
