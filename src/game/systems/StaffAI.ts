/**
 * Staff AI System
 *
 * Manages AI behavior for staff members:
 * - Auto-detect unattended patients in beds
 * - Self-assign to highest severity patient
 * - Pathfinding to patient bed
 * - Treatment management
 * - Fatigue-based rest seeking
 */

import { Staff } from "../entities/Staff";
import { Patient } from "../entities/Patient";
import { Bed } from "../entities/Bed";
import { PathfindingManager } from "./PathfindingManager";
import { STAFF_CONFIG } from "../utils/Constants";
import EventBus from "../utils/EventBus";

export interface StaffAIConfig {
  scene: Phaser.Scene;
  pathfindingManager: PathfindingManager;
  /** Position of break room for staff to rest */
  breakRoomPosition?: { x: number; y: number };
}

export class StaffAI {
  private scene: Phaser.Scene;
  private pathfindingManager: PathfindingManager;
  private staffList: Staff[] = [];
  private patients: Patient[] = [];
  private beds: Map<string, Bed> = new Map();
  private breakRoomPosition: { x: number; y: number };

  // AI update timing
  private updateTimer: number = 0;
  private updateInterval: number = STAFF_CONFIG.AI_UPDATE_INTERVAL;

  constructor(config: StaffAIConfig) {
    this.scene = config.scene;
    this.pathfindingManager = config.pathfindingManager;
    this.breakRoomPosition = config.breakRoomPosition || { x: 200, y: 200 };
  }

  /**
   * Register a staff member with the AI system
   */
  registerStaff(staff: Staff): void {
    if (!this.staffList.includes(staff)) {
      this.staffList.push(staff);
      staff.setPathfindingManager(this.pathfindingManager);
    }
  }

  /**
   * Unregister a staff member
   */
  unregisterStaff(staff: Staff): void {
    const index = this.staffList.indexOf(staff);
    if (index !== -1) {
      this.staffList.splice(index, 1);
    }
  }

  /**
   * Set the list of patients (call when patients change)
   */
  setPatients(patients: Patient[]): void {
    this.patients = patients;
  }

  /**
   * Set the beds map
   */
  setBeds(beds: Map<string, Bed>): void {
    this.beds = beds;
  }

  /**
   * Set break room position
   */
  setBreakRoomPosition(x: number, y: number): void {
    this.breakRoomPosition = { x, y };
  }

  /**
   * Update AI (call each frame)
   */
  update(delta: number): void {
    this.updateTimer += delta;

    if (this.updateTimer >= this.updateInterval) {
      this.updateTimer = 0;
      this.runAIDecisions();
    }

    // Update each staff member's state
    for (const staff of this.staffList) {
      this.updateStaffState(staff, delta);
    }
  }

  /**
   * Run AI decisions for all idle staff
   */
  private runAIDecisions(): void {
    for (const staff of this.staffList) {
      const state = staff.getStaffState();

      // Only make decisions for idle staff
      if (state === "IDLE") {
        // Check if staff needs to rest
        if (staff.getFatigue() >= STAFF_CONFIG.FATIGUE.EXHAUSTED_THRESHOLD) {
          this.sendStaffToRest(staff);
        } else {
          // Look for a patient to treat
          this.assignStaffToPatient(staff);
        }
      }
    }
  }

  /**
   * Update an individual staff member's state machine
   */
  private updateStaffState(staff: Staff, delta: number): void {
    const state = staff.getStaffState();

    switch (state) {
      case "IDLE":
        // Fatigue increases slowly while idle
        staff.addFatigue((STAFF_CONFIG.FATIGUE.IDLE_RATE * delta) / 1000);
        break;

      case "MOVING_TO_PATIENT":
        // Check if arrived at patient
        if (!staff.isWalking()) {
          const patient = this.getPatientById(staff.getAssignedPatientId());
          if (
            patient &&
            (patient.getState() === "IN_BED" ||
              patient.getState() === "BEING_TREATED")
          ) {
            staff.startTreating();
            // Make sure treatment is active (in case of resume)
            if (patient.isTreatmentPaused()) {
              patient.resumeTreatment(staff.getId(), staff.getSkill());
            }
          } else {
            // Patient is no longer available
            staff.setStaffState("IDLE");
            staff.clearAssignment();
          }
        }
        break;

      case "TREATING":
        // Progress treatment and increase fatigue
        staff.addFatigue((STAFF_CONFIG.FATIGUE.WORK_RATE * delta) / 1000);

        const patient = this.getPatientById(staff.getAssignedPatientId());
        if (patient) {
          // Check if patient died during treatment
          if (patient.getState() === "DEAD") {
            console.log(`💀 Patient died during treatment by ${staff.getId()}`);
            staff.finishTreating();
            break;
          }

          const complete = patient.progressTreatment(delta);
          if (complete) {
            staff.finishTreating();
          }
        } else {
          // Patient disappeared (destroyed)
          staff.finishTreating();
        }

        // Check for exhaustion during treatment
        if (staff.getFatigue() >= STAFF_CONFIG.FATIGUE.MAX) {
          // Pause treatment before becoming exhausted
          const treatedPatient = this.getPatientById(
            staff.getAssignedPatientId()
          );
          if (treatedPatient) {
            treatedPatient.pauseTreatment();
          }
          staff.becomeExhausted();
        }
        break;

      case "EXHAUSTED":
        // Continue treatment but slower, then seek rest
        if (!staff.isWalking()) {
          this.sendStaffToRest(staff);
        }
        break;

      case "RESTING":
        // Recover fatigue
        staff.addFatigue((-STAFF_CONFIG.FATIGUE.RECOVERY_RATE * delta) / 1000);

        // Check if fully recovered
        if (staff.getFatigue() <= 0) {
          staff.finishResting();
        }
        break;
    }
  }

  /**
   * Find and assign an unattended patient to a staff member
   */
  private assignStaffToPatient(staff: Staff): void {
    // Find highest severity patient in bed that isn't being treated
    // Also consider patients with paused treatment
    const availablePatients = this.patients.filter((p) => {
      const state = p.getState();
      // Available if: in bed and not assigned, OR being treated but paused
      return (
        (state === "IN_BED" && !this.isPatientAssigned(p.getId())) ||
        (state === "BEING_TREATED" &&
          p.isTreatmentPaused() &&
          !this.isPatientAssigned(p.getId()))
      );
    });

    if (availablePatients.length === 0) return;

    // Sort by severity (highest first), then by treatment progress (higher first - prioritize resuming)
    availablePatients.sort((a, b) => {
      // Prioritize patients with paused treatment
      const aPaused = a.isTreatmentPaused() ? 1 : 0;
      const bPaused = b.isTreatmentPaused() ? 1 : 0;
      if (aPaused !== bPaused) return bPaused - aPaused;

      // Then by severity
      return b.getSeverity() - a.getSeverity();
    });

    const targetPatient = availablePatients[0];
    const bedId = targetPatient.getData().assignedBedId;

    if (!bedId) return;

    const bed = this.beds.get(bedId);
    if (!bed) return;

    // Assign staff to patient
    staff.assignToPatient(targetPatient.getId());

    // Start or resume treatment with staff's skill
    const staffSkill = staff.getSkill();
    if (targetPatient.isTreatmentPaused()) {
      targetPatient.resumeTreatment(staff.getId(), staffSkill);
    } else {
      targetPatient.startTreatment(staff.getId(), staffSkill);
    }

    // Walk to bed
    const bedPos = bed.getPatientPosition();
    // Stand beside bed (offset slightly)
    const targetX = bedPos.x + 40;
    const targetY = bedPos.y;

    staff.walkToWithPathfinding(targetX, targetY, () => {
      // Arrived - state will transition in updateStaffState
    });

    console.log(
      `🏥 Staff ${staff.getId()} (skill: ${staffSkill}) assigned to patient ${targetPatient.getId()} (severity ${targetPatient.getSeverity()})`
    );

    EventBus.emit("staff:assigned_patient", {
      staffId: staff.getId(),
      patientId: targetPatient.getId(),
    });
  }

  /**
   * Send staff to break room to rest
   */
  private sendStaffToRest(staff: Staff): void {
    staff.setStaffState("RESTING");

    staff.walkToWithPathfinding(
      this.breakRoomPosition.x,
      this.breakRoomPosition.y,
      () => {
        staff.playAnimation("idle", "down");
      }
    );

    console.log(
      `😴 Staff ${staff.getId()} going to rest (fatigue: ${staff
        .getFatigue()
        .toFixed(0)}%)`
    );

    EventBus.emit("staff:resting", {
      staffId: staff.getId(),
      fatigue: staff.getFatigue(),
    });
  }

  /**
   * Check if a patient is already assigned to a staff member
   * (Returns false for paused treatments so they can be picked up)
   */
  private isPatientAssigned(patientId: string): boolean {
    return this.staffList.some((s) => {
      if (s.getAssignedPatientId() !== patientId) return false;
      // If staff is actively treating or moving to patient, they're assigned
      const state = s.getStaffState();
      return state === "TREATING" || state === "MOVING_TO_PATIENT";
    });
  }

  /**
   * Get patient by ID
   */
  private getPatientById(patientId: string | null): Patient | null {
    if (!patientId) return null;
    return this.patients.find((p) => p.getId() === patientId) || null;
  }

  /**
   * Manually assign a staff member to a patient (player override)
   */
  manualAssign(staff: Staff, patient: Patient): boolean {
    const state = staff.getStaffState();

    // Can only assign if idle or moving
    if (state !== "IDLE" && state !== "MOVING_TO_PATIENT") {
      return false;
    }

    // If staff was treating someone else, pause that treatment
    const previousPatientId = staff.getAssignedPatientId();
    if (previousPatientId) {
      const previousPatient = this.getPatientById(previousPatientId);
      if (previousPatient && previousPatient.getState() === "BEING_TREATED") {
        previousPatient.pauseTreatment();
      }
    }

    // Clear any previous assignment
    staff.clearAssignment();

    const bedId = patient.getData().assignedBedId;
    if (!bedId) return false;

    const bed = this.beds.get(bedId);
    if (!bed) return false;

    // Assign with skill
    const staffSkill = staff.getSkill();
    staff.assignToPatient(patient.getId());

    if (patient.isTreatmentPaused()) {
      patient.resumeTreatment(staff.getId(), staffSkill);
    } else {
      patient.startTreatment(staff.getId(), staffSkill);
    }

    const bedPos = bed.getPatientPosition();
    staff.walkToWithPathfinding(bedPos.x + 40, bedPos.y);

    EventBus.emit("staff:manual_assigned", {
      staffId: staff.getId(),
      patientId: patient.getId(),
      staffSkill,
    });

    return true;
  }

  /**
   * Send staff to break room manually
   */
  sendToBreakRoom(staff: Staff): void {
    // If staff was treating someone, pause that treatment
    const patientId = staff.getAssignedPatientId();
    if (patientId) {
      const patient = this.getPatientById(patientId);
      if (patient && patient.getState() === "BEING_TREATED") {
        patient.pauseTreatment();
      }
    }

    staff.clearAssignment();
    this.sendStaffToRest(staff);
  }

  /**
   * Encourage a staff member (reduce fatigue slightly)
   */
  encourageStaff(staff: Staff): void {
    const encourageAmount = 10; // Reduce fatigue by 10%
    staff.addFatigue(-encourageAmount);

    // Visual feedback
    staff.showEncourageEffect();

    EventBus.emit("staff:encouraged", {
      staffId: staff.getId(),
      fatigueReduced: encourageAmount,
    });
  }

  /**
   * Get all staff members
   */
  getStaffList(): Staff[] {
    return this.staffList;
  }

  /**
   * Get staff by ID
   */
  getStaffById(id: string): Staff | null {
    return this.staffList.find((s) => s.getId() === id) || null;
  }
}
