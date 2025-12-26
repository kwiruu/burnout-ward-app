/**
 * Entity exports
 */
export { Player, type PlayerConfig, type PlayerDirection } from "./Player";
export {
  Patient,
  type PatientConfig,
  type PatientDirection,
  PATIENT_SKINS,
  getRandomPatientSkin,
} from "./Patient";
export {
  Staff,
  type StaffConfig,
  type StaffDirection,
  type StaffTask,
  type TaskStep,
  STAFF_SKINS,
  getRandomStaffSkin,
} from "./Staff";
export { Bed, type BedConfig } from "./Bed";
export { Equipment, type EquipmentConfig } from "./Equipment";
export {
  Chair,
  type ChairConfig,
  type ChairColor,
  type ChairDirection,
} from "./Chair";
export { Tablet, type TabletConfig } from "./Tablet";
