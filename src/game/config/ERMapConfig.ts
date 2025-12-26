/**
 * ER Map Configuration
 *
 * This file defines the entire ER layout in an easily editable format.
 * When you're ready to design the actual UI/UX, simply modify this config
 * or replace it with a Tiled JSON tilemap.
 *
 * COORDINATE SYSTEM:
 * - Origin (0,0) is top-left
 * - X increases to the right
 * - Y increases downward
 * - All units are in pixels
 */

import { GAME_CONFIG } from "../utils/Constants";

// ===========================================
// TILE CONFIGURATION
// ===========================================
export const TILE_CONFIG = {
  // Tile size in pixels (for grid alignment)
  SIZE: 32,

  // Grid dimensions
  COLS: Math.floor(GAME_CONFIG.WIDTH / 32), // 32 columns
  ROWS: Math.floor(GAME_CONFIG.HEIGHT / 32), // 24 rows
} as const;

// ===========================================
// COLOR PALETTE (easily customizable)
// ===========================================
export const MAP_COLORS = {
  // Floor colors
  FLOOR_DEFAULT: 0x2d2d44,
  FLOOR_WAITING: 0x2a3a4a,
  FLOOR_TRIAGE: 0x3a3a4a,
  FLOOR_ER: 0x2d3d4d,
  FLOOR_BREAK: 0x3d2d4d,

  // Wall colors
  WALL_PRIMARY: 0x1a1a2e,
  WALL_ACCENT: 0x16c79a,

  // Room highlight colors (for floor tint)
  ROOM_WAITING: 0x16c79a,
  ROOM_TRIAGE: 0xfbbf24,
  ROOM_ER: 0x3b82f6,
  ROOM_BREAK: 0x8b5cf6,
} as const;

// ===========================================
// ROOM DEFINITIONS
// ===========================================
export interface RoomDefinition {
  id: string;
  name: string;
  emoji: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  floorColor: number;
  highlightColor: number;
  highlightAlpha: number;
}

export const ROOMS: RoomDefinition[] = [
  {
    id: "waiting",
    name: "WAITING AREA",
    emoji: "📋",
    bounds: { x: 50, y: 50, width: 250, height: 400 },
    floorColor: MAP_COLORS.FLOOR_WAITING,
    highlightColor: MAP_COLORS.ROOM_WAITING,
    highlightAlpha: 0.1,
  },
  {
    id: "triage",
    name: "TRIAGE",
    emoji: "🏥",
    bounds: { x: 300, y: 50, width: 150, height: 150 },
    floorColor: MAP_COLORS.FLOOR_TRIAGE,
    highlightColor: MAP_COLORS.ROOM_TRIAGE,
    highlightAlpha: 0.1,
  },
  {
    id: "er_beds",
    name: "ER BEDS",
    emoji: "🛏️",
    bounds: { x: 450, y: 50, width: 400, height: 400 },
    floorColor: MAP_COLORS.FLOOR_ER,
    highlightColor: MAP_COLORS.ROOM_ER,
    highlightAlpha: 0.1,
  },
  {
    id: "break_room",
    name: "BREAK",
    emoji: "☕",
    bounds: { x: 850, y: 50, width: 124, height: 200 },
    floorColor: MAP_COLORS.FLOOR_BREAK,
    highlightColor: MAP_COLORS.ROOM_BREAK,
    highlightAlpha: 0.1,
  },
];

// ===========================================
// BED POSITIONS
// ===========================================
export interface BedPosition {
  id: string;
  number: number;
  x: number;
  y: number;
  roomId: string;
}

export const BED_POSITIONS: BedPosition[] = [
  { id: "bed_1", number: 1, x: 520, y: 150, roomId: "er_beds" },
  { id: "bed_2", number: 2, x: 620, y: 150, roomId: "er_beds" },
  { id: "bed_3", number: 3, x: 720, y: 150, roomId: "er_beds" },
  { id: "bed_4", number: 4, x: 520, y: 280, roomId: "er_beds" },
  { id: "bed_5", number: 5, x: 620, y: 280, roomId: "er_beds" },
  { id: "bed_6", number: 6, x: 720, y: 280, roomId: "er_beds" },
];

// ===========================================
// DOOR POSITIONS (visual only for now)
// ===========================================
export interface DoorPosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: "horizontal" | "vertical";
  connectsRooms: [string, string];
}

export const DOOR_POSITIONS: DoorPosition[] = [
  {
    id: "door_waiting_triage",
    x: 300,
    y: 110,
    width: 4,
    height: 40,
    orientation: "vertical",
    connectsRooms: ["waiting", "triage"],
  },
  {
    id: "door_triage_er",
    x: 450,
    y: 110,
    width: 4,
    height: 40,
    orientation: "vertical",
    connectsRooms: ["triage", "er_beds"],
  },
  {
    id: "door_er_break",
    x: 850,
    y: 130,
    width: 4,
    height: 40,
    orientation: "vertical",
    connectsRooms: ["er_beds", "break_room"],
  },
  {
    id: "door_entrance",
    x: 50,
    y: 250,
    width: 4,
    height: 60,
    orientation: "vertical",
    connectsRooms: ["outside", "waiting"],
  },
];

// ===========================================
// FURNITURE & PROPS
// ===========================================
export interface FurnitureItem {
  id: string;
  type: "desk" | "chair" | "table" | "vending" | "plant" | "monitor";
  x: number;
  y: number;
  width: number;
  height: number;
  roomId: string;
  isCollidable: boolean;
  isInteractable: boolean;
}

export const FURNITURE: FurnitureItem[] = [
  // Triage desk
  {
    id: "triage_desk",
    type: "desk",
    x: 375,
    y: 125,
    width: 80,
    height: 40,
    roomId: "triage",
    isCollidable: true,
    isInteractable: true,
  },
  // Waiting area chairs (represented as a group)
  {
    id: "waiting_chairs_1",
    type: "chair",
    x: 100,
    y: 150,
    width: 120,
    height: 30,
    roomId: "waiting",
    isCollidable: true,
    isInteractable: false,
  },
  {
    id: "waiting_chairs_2",
    type: "chair",
    x: 100,
    y: 250,
    width: 120,
    height: 30,
    roomId: "waiting",
    isCollidable: true,
    isInteractable: false,
  },
  {
    id: "waiting_chairs_3",
    type: "chair",
    x: 100,
    y: 350,
    width: 120,
    height: 30,
    roomId: "waiting",
    isCollidable: true,
    isInteractable: false,
  },
  // Break room table
  {
    id: "break_table",
    type: "table",
    x: 912,
    y: 150,
    width: 50,
    height: 60,
    roomId: "break_room",
    isCollidable: true,
    isInteractable: false,
  },
  // Vending machine
  {
    id: "vending_machine",
    type: "vending",
    x: 890,
    y: 80,
    width: 30,
    height: 50,
    roomId: "break_room",
    isCollidable: true,
    isInteractable: true,
  },
];

// ===========================================
// COLLISION WALLS
// Define walls as rectangles for collision detection
// ===========================================
export interface WallDefinition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const WALLS: WallDefinition[] = [
  // Outer walls
  { id: "wall_top", x: 50, y: 46, width: 924, height: 4 },
  { id: "wall_bottom", x: 50, y: 450, width: 924, height: 4 },
  { id: "wall_left", x: 46, y: 50, width: 4, height: 404 },
  { id: "wall_right", x: 974, y: 50, width: 4, height: 404 },

  // Room dividers (with gaps for doors)
  // Waiting to Triage wall
  { id: "wall_wait_tri_top", x: 300, y: 50, width: 4, height: 60 },
  { id: "wall_wait_tri_bot", x: 300, y: 150, width: 4, height: 300 },

  // Triage to ER wall
  { id: "wall_tri_er_top", x: 450, y: 50, width: 4, height: 60 },
  { id: "wall_tri_er_bot", x: 450, y: 150, width: 4, height: 50 },
  { id: "wall_triage_bottom", x: 300, y: 200, width: 150, height: 4 },

  // ER to Break Room wall
  { id: "wall_er_break_top", x: 850, y: 50, width: 4, height: 80 },
  { id: "wall_er_break_bot", x: 850, y: 170, width: 4, height: 80 },
  { id: "wall_break_bottom", x: 850, y: 250, width: 124, height: 4 },
];

// ===========================================
// SPAWN POINTS
// ===========================================
export interface SpawnPoint {
  id: string;
  x: number;
  y: number;
  type: "patient" | "player" | "staff";
}

export const SPAWN_POINTS: SpawnPoint[] = [
  // Patient entrance (from outside to waiting)
  { id: "patient_spawn", x: 60, y: 280, type: "patient" },

  // Player start position
  { id: "player_spawn", x: 64, y: 1160, type: "player" },

  // Staff spawn points
  { id: "nurse_spawn_1", x: 500, y: 350, type: "staff" },
  { id: "nurse_spawn_2", x: 600, y: 350, type: "staff" },
  { id: "doctor_spawn", x: 700, y: 350, type: "staff" },
];

// ===========================================
// DISCHARGE POINT
// ===========================================
export const DISCHARGE_POINT = {
  x: 60,
  y: 280,
};

// ===========================================
// MAP BOUNDS (playable area)
// ===========================================
export const MAP_BOUNDS = {
  // Match Tiled map size 960x1312 (origin at 0,0)
  minX: 0,
  maxX: 960,
  minY: 0,
  maxY: 1312,
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Get room by ID
 */
export function getRoomById(roomId: string): RoomDefinition | undefined {
  return ROOMS.find((room) => room.id === roomId);
}

/**
 * Get room at position
 */
export function getRoomAtPosition(
  x: number,
  y: number
): RoomDefinition | undefined {
  return ROOMS.find((room) => {
    const b = room.bounds;
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  });
}

/**
 * Get spawn point by type
 */
export function getSpawnPointByType(
  type: SpawnPoint["type"]
): SpawnPoint | undefined {
  return SPAWN_POINTS.find((sp) => sp.type === type);
}

/**
 * Get bed position by number
 */
export function getBedPositionByNumber(num: number): BedPosition | undefined {
  return BED_POSITIONS.find((bed) => bed.number === num);
}

/**
 * Check if a point is inside a room
 */
export function isInsideRoom(x: number, y: number, roomId: string): boolean {
  const room = getRoomById(roomId);
  if (!room) return false;
  const b = room.bounds;
  return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
}
