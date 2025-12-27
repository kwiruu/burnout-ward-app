/**
 * Map Configurations
 *
 * Define all maps here. Each map has:
 * - id: unique identifier
 * - name: display name
 * - size: width/height in pixels
 * - layers: image keys and depths
 * - collisionKey: key for collision JSON in cache
 * - spawnPoints: named positions for spawning entities
 */

import { GAME_CONFIG, MAP_PADDING } from "../utils/Constants";

export interface MapLayer {
  name: string;
  imageKey: string;
  depth: number;
}

export interface SpawnPoint {
  id: string;
  x: number;
  y: number;
  type: "player" | "patient" | "staff" | "object";
}

export interface DoorConfig {
  id: string;
  x: number;
  y: number;
  spriteKey?: string;
  autoOpen?: boolean;
  triggerDistance?: number;
  doorType?: "single" | "dual";
  fixedDirection?: "up" | "down";
}

export interface ChairConfig {
  id: string;
  x: number;
  y: number;
  color?: "yellow" | "green" | "red";
  direction?:
    | "left_with_arm_rest"
    | "left"
    | "down"
    | "right"
    | "right_with_arm_rest"
    | "up";
}

/**
 * Bed configuration for a map
 */
export interface BedMapConfig {
  id: string;
  /** Bed number (1-6) for display */
  number: number;
  x: number;
  y: number;
  /** Direction the bed faces (affects patient position) */
  direction?: "up" | "down" | "left" | "right";
}

/**
 * A single step in a staff task
 */
export interface TaskStepConfig {
  /** Position to walk to (map coordinates) */
  walkTo?: { x: number; y: number };
  /** How many milliseconds to wait at this step */
  waitMs?: number;
  /** Animation to play during wait */
  animation?: string;
  /** Direction to face during animation */
  direction?: "up" | "down" | "left" | "right";
  /** Optional depth override for manual layer control */
  depth?: number;
}

/**
 * A task definition for staff
 */
export interface TaskConfig {
  id: string;
  name: string;
  steps: TaskStepConfig[];
  loop?: boolean;
}

/**
 * Staff configuration for a map
 */
export interface StaffMapConfig {
  id: string;
  x: number;
  y: number;
  spriteKey?: string;
  name?: string;
  /** Staff type: NURSE or DOCTOR */
  type?: "NURSE" | "DOCTOR";
  /** Skill level (affects treatment speed) */
  skill?: number;
  /** Task to start automatically (optional - legacy) */
  autoTask?: TaskConfig;
}

/**
 * Tablet configuration for a map
 */
export interface TabletMapConfig {
  id: string;
  x: number;
  y: number;
  spriteKey?: string;
  /** Range at which the pointer indicator appears (default: 150) */
  pointerRange?: number;
}

export interface PatientSpawnConfig {
  /** Where patients spawn (map coordinates) */
  spawnPoint: { x: number; y: number };
  /** Where patients walk to after spawning */
  walkToPoint: { x: number; y: number };
  /** Direction to face after reaching walkToPoint */
  faceDirection: "up" | "down" | "left" | "right";
}

export interface UrgencyWeights {
  /** Weight for severity 1 (lowest urgency) */
  severity1: number;
  /** Weight for severity 2 */
  severity2: number;
  /** Weight for severity 3 */
  severity3: number;
  /** Weight for severity 4 */
  severity4: number;
  /** Weight for severity 5 (highest urgency) */
  severity5: number;
}

export interface GameConfig {
  /** Time between patient spawns in milliseconds */
  spawnRateMs: number;
  /** Minimum spawn rate (spawns get faster over time) */
  minSpawnRateMs: number;
  /** How much to decrease spawn rate each spawn (ms) */
  spawnRateDecreaseMs: number;
  /** Maximum patients at once */
  maxPatients: number;
  /** Urgency/severity distribution weights */
  urgencyWeights: UrgencyWeights;
  /** Patient spawn configuration */
  patientSpawn: PatientSpawnConfig;
}

export interface MapConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: MapLayer[];
  collisionKey: string;
  spawnPoints: SpawnPoint[];
  doors: DoorConfig[];
  chairs: ChairConfig[];
  beds: BedMapConfig[];
  staffs: StaffMapConfig[];
  tablets: TabletMapConfig[];
  gameConfig: GameConfig;
  /** Break room position for staff to rest */
  breakRoomPosition?: { x: number; y: number };
}

/**
 * Calculate map offset to center it on screen
 */
export function getMapOffset(mapConfig: MapConfig): { x: number; y: number } {
  return {
    x: (GAME_CONFIG.WIDTH - mapConfig.width) / 2,
    y: MAP_PADDING.TOP,
  };
}

/**
 * Get map bounds with offset applied (for collision checking)
 */
export function getMapBounds(mapConfig: MapConfig): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const offset = getMapOffset(mapConfig);
  return {
    minX: offset.x,
    maxX: offset.x + mapConfig.width,
    minY: offset.y,
    maxY: offset.y + mapConfig.height,
  };
}

/**
 * Get spawn point by type from a map config (with offset applied)
 */
export function getSpawnPoint(
  mapConfig: MapConfig,
  type: SpawnPoint["type"]
): { x: number; y: number } | null {
  const offset = getMapOffset(mapConfig);
  const spawn = mapConfig.spawnPoints.find((sp) => sp.type === type);
  if (!spawn) return null;
  return {
    x: spawn.x + offset.x,
    y: spawn.y + offset.y,
  };
}

/**
 * Get spawn point by ID from a map config (with offset applied)
 */
export function getSpawnPointById(
  mapConfig: MapConfig,
  id: string
): { x: number; y: number } | null {
  const offset = getMapOffset(mapConfig);
  const spawn = mapConfig.spawnPoints.find((sp) => sp.id === id);
  if (!spawn) return null;
  return {
    x: spawn.x + offset.x,
    y: spawn.y + offset.y,
  };
}

// ===========================================
// MAP DEFINITIONS
// ===========================================

export const MAP_ER_FLOOR1: MapConfig = {
  id: "er_floor1",
  name: "ER - Floor 1",
  width: 960,
  height: 1312,
  layers: [
    { name: "bg", imageKey: "layer_bg", depth: 0 },
    { name: "floor-wall", imageKey: "layer_floor_wall", depth: 10 },
    {
      name: "floor-objects-behind",
      imageKey: "layer_floor_objects_behind",
      depth: 20,
    },
    { name: "floor-objects", imageKey: "layer_floor_objects", depth: 30 },
    { name: "floor-wall2", imageKey: "layer_floor_wall2", depth: 50 }, // Above player
    { name: "above-player", imageKey: "layer_above_player", depth: 300 }, // New layer above player
  ],
  collisionKey: "collision_data",
  spawnPoints: [
    // Player spawn (center of map)
    { id: "player_spawn", x: 480, y: 656, type: "player" },
    // Patient entrance
    { id: "patient_entrance", x: 480, y: 1250, type: "patient" },
    // Staff spawns
    { id: "nurse_spawn_1", x: 300, y: 400, type: "staff" },
    { id: "nurse_spawn_2", x: 600, y: 400, type: "staff" },
  ],
  doors: [
    // Add door positions here (coordinates are relative to map, not screen)
    // Dual opening door (door01)
    {
      id: "door_main_1",
      x: 224,
      y: 352,
      spriteKey: "door01",
      autoOpen: true,
      triggerDistance: 50,
      doorType: "dual",
    },
    {
      id: "door_main_2",
      x: 224,
      y: 222,
      spriteKey: "door01",
      autoOpen: true,
      triggerDistance: 50,
      doorType: "dual",
    },
    {
      id: "door_hall_1",
      x: 448,
      y: 512,
      spriteKey: "door02",
      autoOpen: true,
      triggerDistance: 50,
      doorType: "dual",
    },
    {
      id: "door_hall_2",
      x: 448,
      y: 768,
      spriteKey: "door03",
      autoOpen: true,
      triggerDistance: 50,
      doorType: "dual",
    },
    {
      id: "door_hall_3",
      x: 448,
      y: 1055,
      spriteKey: "door02",
      autoOpen: true,
      triggerDistance: 50,
      doorType: "dual",
    },
    // Add more doors as needed:
    // { id: "door_room1", x: 200, y: 600, spriteKey: "door01", doorType: "dual" },
    // { id: "door_room2", x: 300, y: 400, spriteKey: "door02", doorType: "single", fixedDirection: "up" },
  ],
  chairs: [
    { id: "chair_1", x: 464, y: 1256, color: "yellow", direction: "up" },
    { id: "chair_2", x: 496, y: 1256, color: "yellow", direction: "up" },
    { id: "chair_3", x: 528, y: 1256, color: "yellow", direction: "up" },
    { id: "chair_4", x: 560, y: 1256, color: "yellow", direction: "up" },
    { id: "chair_5", x: 592, y: 1256, color: "yellow", direction: "up" },
    { id: "chair_6", x: 624, y: 1256, color: "yellow", direction: "up" },
    { id: "chair_7", x: 688, y: 1256, color: "green", direction: "left" },
    { id: "chair_8", x: 688, y: 1224, color: "green", direction: "left" },
    { id: "chair_9", x: 688, y: 1192, color: "green", direction: "left" },
    { id: "chair_10", x: 688, y: 1160, color: "green", direction: "left" },
    { id: "chair_11", x: 656, y: 1128, color: "red", direction: "down" },
    { id: "chair_12", x: 624, y: 1128, color: "red", direction: "down" },
    { id: "chair_13", x: 592, y: 1128, color: "red", direction: "down" },
    { id: "chair_14", x: 560, y: 1128, color: "red", direction: "down" },
  ],
  beds: [
    // ER beds - Room 1 (top left area)
    { id: "bed_1", number: 1, x: 576, y: 788, direction: "down" },
    { id: "bed_2", number: 2, x: 704, y: 788, direction: "down" },
    { id: "bed_3", number: 3, x: 832, y: 788, direction: "down" },
    // ER beds - Room 2 (middle area)
    { id: "bed_4", number: 4, x: 576, y: 948, direction: "down" },
    { id: "bed_5", number: 5, x: 704, y: 948, direction: "down" },
    { id: "bed_6", number: 6, x: 832, y: 948, direction: "down" },
  ],
  staffs: [
    {
      id: "staff_nurse1",
      x: 450,
      y: 600,
      spriteKey: "staff02",
      name: "Nurse",
      type: "NURSE",
      skill: 1,
    },
    {
      id: "staff_storage",
      x: 255,
      y: 930,
      spriteKey: "staff06",
      name: "Storage Clerk",
      autoTask: {
        id: "patrol_storage",
        name: "Patrol Storage Room",
        steps: [
          {
            walkTo: { x: 207, y: 930 },
            waitMs: 3000,
            animation: "take",
            direction: "up",
          },
          {
            walkTo: { x: 304, y: 990 },
            waitMs: 3000,
            animation: "put",
            direction: "down",
          },
          {
            walkTo: { x: 207, y: 930 },
            waitMs: 3000,
            animation: "take",
            direction: "up",
          },
          {
            walkTo: { x: 195, y: 970 },
            waitMs: 3000,
            animation: "put",
            direction: "left",
          },
          {
            walkTo: { x: 304, y: 990 },
            waitMs: 3000,
            animation: "put",
            direction: "down",
          },
          {
            walkTo: { x: 350, y: 965 },
            waitMs: 3000,
            animation: "put",
            direction: "right",
          },
          {
            walkTo: { x: 207, y: 930 },
            waitMs: 3000,
            animation: "take",
            direction: "up",
          },
          {
            walkTo: { x: 304, y: 990 },
            waitMs: 3000,
            animation: "put",
            direction: "down",
          },
          {
            walkTo: { x: 207, y: 930 },
            waitMs: 3000,
            animation: "take",
            direction: "up",
          },
          {
            walkTo: { x: 195, y: 970 },
            waitMs: 3000,
            animation: "put",
            direction: "left",
          },
          {
            walkTo: { x: 304, y: 990 },
            waitMs: 3000,
            animation: "put",
            direction: "down",
          },
          {
            walkTo: { x: 350, y: 965 },
            waitMs: 3000,
            animation: "put",
            direction: "right",
          },
          {
            walkTo: { x: 207, y: 990 },
            waitMs: 9000,
            animation: "sit",
            direction: "right",
            depth: 400,
          },
        ],
        loop: true,
      },
    },

    {
      id: "staff_receptionist",
      x: 255,
      y: 1090,
      spriteKey: "staff01",
      name: "Receptionist",
      autoTask: {
        id: "patrol_desk",
        name: "Patrol Reception Desk",
        steps: [
          {
            walkTo: { x: 254, y: 1090 },
            waitMs: 3000,
            animation: "idle",
            direction: "down",
          },
          {
            walkTo: { x: 254, y: 1090 },
            waitMs: 3000,
            animation: "read",
            direction: "down",
          },
          {
            walkTo: { x: 254, y: 1090 },
            waitMs: 4000,
            animation: "idle",
            direction: "down",
          },
          {
            walkTo: { x: 254, y: 1090 },
            waitMs: 3000,
            animation: "put",
            direction: "down",
          },
        ],
        loop: true,
      },
    },
  ],
  tablets: [
    {
      id: "tablet_reception",
      x: 368,
      y: 1152,
      pointerRange: 150,
    },
  ],
  gameConfig: {
    // Patient spawn timing
    spawnRateMs: 1000, // Start: spawn every 15 seconds
    minSpawnRateMs: 8000, // Minimum: spawn every 8 seconds
    spawnRateDecreaseMs: 100, // Decrease by 100ms each spawn
    maxPatients: 8, // Maximum patients at once
    // Urgency distribution (higher = more likely)
    urgencyWeights: {
      severity1: 30, // 30% low urgency
      severity2: 25, // 25%
      severity3: 20, // 20% medium
      severity4: 15, // 15%
      severity5: 10, // 10% high urgency
    },
    // Patient spawn and walk-to configuration
    patientSpawn: {
      spawnPoint: { x: 0, y: 1160 },
      walkToPoint: { x: 252, y: 1150 },
      faceDirection: "up",
    },
  },
};

// Add more maps here as needed:
// export const MAP_ER_FLOOR2: MapConfig = { ... };
// export const MAP_ICU: MapConfig = { ... };

// ===========================================
// MAP REGISTRY
// ===========================================

export const MAPS: Record<string, MapConfig> = {
  er_floor1: MAP_ER_FLOOR1,
  // Add more maps to the registry
};

/**
 * Get a map config by ID
 */
export function getMapById(mapId: string): MapConfig | undefined {
  return MAPS[mapId];
}

/**
 * Default map to load
 */
export const DEFAULT_MAP = MAP_ER_FLOOR1;
