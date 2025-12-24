/**
 * Type Definitions for Code Red: ER Shift
 */

import { DifficultyLevel, Grade } from "../utils/Constants";

// ===========================================
// PATIENT TYPES
// ===========================================

export type PatientState =
  | "ARRIVING"
  | "WAITING"
  | "TRIAGED"
  | "MOVING_TO_BED"
  | "IN_BED"
  | "BEING_TREATED"
  | "STABILIZED"
  | "DISCHARGING"
  | "DISCHARGED"
  | "DEAD";

export interface PatientData {
  id: string;
  severity: number;
  state: PatientState;
  timer: number;
  maxTimer: number;
  assignedBedId: string | null;
  assignedStaffId: string | null;
  treatmentProgress: number;
  position: { x: number; y: number };
}

// ===========================================
// STAFF TYPES
// ===========================================

export type StaffType = "NURSE" | "DOCTOR";

export type StaffState =
  | "IDLE"
  | "MOVING_TO_PATIENT"
  | "TREATING"
  | "EXHAUSTED"
  | "RESTING";

export interface StaffData {
  id: string;
  type: StaffType;
  name: string;
  state: StaffState;
  fatigue: number;
  skill: number;
  assignedPatientId: string | null;
  position: { x: number; y: number };
}

// ===========================================
// EQUIPMENT TYPES
// ===========================================

export type EquipmentType = "BED" | "MONITOR";

export type EquipmentState = "WORKING" | "BROKEN";

export interface EquipmentData {
  id: string;
  type: EquipmentType;
  state: EquipmentState;
  roomId: string;
  position: { x: number; y: number };
  repairProgress: number;
}

// ===========================================
// BED TYPES
// ===========================================

export type BedState = "EMPTY" | "OCCUPIED" | "RESERVED";

export interface BedData {
  id: string;
  number: number;
  state: BedState;
  patientId: string | null;
  position: { x: number; y: number };
  isWorking: boolean;
}

// ===========================================
// ROOM TYPES
// ===========================================

export type RoomType =
  | "WAITING_AREA"
  | "TRIAGE"
  | "ER_BEDS"
  | "BREAK_ROOM"
  | "ICU"
  | "SUPPLY_ROOM";

export interface RoomData {
  id: string;
  type: RoomType;
  name: string;
  capacity: number;
  currentOccupancy: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ===========================================
// GAME STATE
// ===========================================

export interface GameState {
  isRunning: boolean;
  isPaused: boolean;
  shiftTimeRemaining: number;
  shiftDuration: number;
  chaosScore: number;
  difficulty: DifficultyLevel;
}

export interface GameStats {
  patientsArrived: number;
  patientsSaved: number;
  patientsDied: number;
  staffBurnouts: number;
  equipmentRepairs: number;
  peakChaos: number;
  finalChaos: number;
  grade: Grade;
}

// ===========================================
// EVENT PAYLOADS
// ===========================================

export interface PatientArrivedEvent {
  patient: PatientData;
}

export interface PatientTriagedEvent {
  patientId: string;
  severity: number;
}

export interface PatientAssignedBedEvent {
  patientId: string;
  bedId: string;
}

export interface PatientWorsenedEvent {
  patientId: string;
  oldSeverity: number;
  newSeverity: number;
}

export interface PatientDiedEvent {
  patientId: string;
  location: string;
}

export interface PatientDischargedEvent {
  patientId: string;
}

export interface StaffAssignedEvent {
  staffId: string;
  patientId: string;
}

export interface StaffExhaustedEvent {
  staffId: string;
}

export interface EquipmentBrokenEvent {
  equipmentId: string;
  type: EquipmentType;
}

export interface EquipmentRepairedEvent {
  equipmentId: string;
}

export interface ChaosChangedEvent {
  oldValue: number;
  newValue: number;
  isWarning: boolean;
  isCritical: boolean;
}

export interface GameOverEvent {
  won: boolean;
  stats: GameStats;
  reason?: string;
}

export interface NotificationEvent {
  message: string;
  type: "info" | "warning" | "danger" | "success";
  duration?: number;
}

// ===========================================
// UI TYPES
// ===========================================

export interface ButtonConfig {
  x: number;
  y: number;
  text: string;
  width?: number;
  height?: number;
  onClick: () => void;
  disabled?: boolean;
  style?: "primary" | "secondary" | "danger";
}

export interface SliderConfig {
  x: number;
  y: number;
  width: number;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
}

export interface TooltipConfig {
  x: number;
  y: number;
  text: string;
  target: Phaser.GameObjects.GameObject;
}

// ===========================================
// INTERACTION TYPES
// ===========================================

export type InteractionType =
  | "TRIAGE"
  | "ASSIGN_BED"
  | "ASSIST_TREATMENT"
  | "REPAIR"
  | "ENCOURAGE_STAFF"
  | "SEND_TO_BREAK";

export interface InteractionTarget {
  type: InteractionType;
  entityId: string;
  entityType: "patient" | "staff" | "equipment" | "bed";
  actionText: string;
  position: { x: number; y: number };
}

// ===========================================
// PATHFINDING
// ===========================================

export interface PathNode {
  x: number;
  y: number;
  g: number; // Cost from start
  h: number; // Heuristic to end
  f: number; // Total cost
  parent: PathNode | null;
}

// ===========================================
// SCENE DATA
// ===========================================

export interface GameSceneData {
  difficulty: DifficultyLevel;
  shiftDuration: number;
}

export interface GameOverSceneData {
  won: boolean;
  stats: GameStats;
}
