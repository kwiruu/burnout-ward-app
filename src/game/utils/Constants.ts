/**
 * Game Constants
 * Central configuration for all game values
 */

// ===========================================
// GAME SETTINGS
// ===========================================
export const GAME_CONFIG = {
  WIDTH: 1506,
  HEIGHT: 768,
  TITLE: "Code Red: ER Shift",
} as const;

// Map padding (to center the map with margins)
export const MAP_PADDING = {
  TOP: 128,
  BOTTOM: 128,
} as const;

// ===========================================
// SHIFT SETTINGS
// ===========================================
export const SHIFT_CONFIG = {
  // Shift durations in seconds
  SHORT: 5 * 60, // 5 minutes
  NORMAL: 10 * 60, // 10 minutes
  LONG: 15 * 60, // 15 minutes

  // Default shift duration
  DEFAULT: 10 * 60,
} as const;

// ===========================================
// DIFFICULTY SETTINGS
// ===========================================
export const DIFFICULTY = {
  EASY: {
    name: "Easy",
    patientTimerMultiplier: 1.5, // 50% more time
    spawnRateMultiplier: 0.7, // 30% slower spawns
    deathThreshold: 5, // 5 deaths allowed
    staffFatigueRate: 0.7, // 30% slower fatigue
    equipmentBreakChance: 0.05, // 5% break chance
  },
  NORMAL: {
    name: "Normal",
    patientTimerMultiplier: 1.0,
    spawnRateMultiplier: 1.0,
    deathThreshold: 3,
    staffFatigueRate: 1.0,
    equipmentBreakChance: 0.1,
  },
  HARD: {
    name: "Hard",
    patientTimerMultiplier: 0.7, // 30% less time
    spawnRateMultiplier: 1.3, // 30% faster spawns
    deathThreshold: 2, // Only 2 deaths allowed
    staffFatigueRate: 1.3, // 30% faster fatigue
    equipmentBreakChance: 0.15, // 15% break chance
  },
} as const;

export type DifficultyLevel = keyof typeof DIFFICULTY;

// ===========================================
// PLAYER SETTINGS
// ===========================================
export const PLAYER_CONFIG = {
  SPEED: 200, // pixels per second
  INTERACTION_RANGE: 50, // pixels
  FATIGUE_MAX: 100,
  FATIGUE_RECOVERY_RATE: 5, // per second in break room
} as const;

// ===========================================
// PATIENT SETTINGS
// ===========================================
export const PATIENT_CONFIG = {
  // Severity levels
  SEVERITY: {
    MIN: 1,
    MAX: 5,
  },

  // Base timer in seconds (modified by severity)
  BASE_TIMER: 60,

  // Timer per severity (higher = less time)
  TIMER_BY_SEVERITY: {
    1: 90, // Minor: 90 seconds
    2: 75, // Low: 75 seconds
    3: 60, // Medium: 60 seconds
    4: 45, // High: 45 seconds
    5: 30, // Critical: 30 seconds
  } as Record<number, number>,

  // Treatment time in seconds (modified by staff skill)
  BASE_TREATMENT_TIME: 15,

  // Discharge delay after stabilization
  DISCHARGE_DELAY: 5,

  // Walking speed
  SPEED: 80,

  // Colors for severity visualization
  COLORS: {
    1: 0x4ade80, // Green - Minor
    2: 0xfbbf24, // Yellow - Low
    3: 0xf97316, // Orange - Medium
    4: 0xef4444, // Red - High
    5: 0x7c2d12, // Dark Red - Critical
  } as Record<number, number>,
} as const;

// ===========================================
// STAFF SETTINGS
// ===========================================
export const STAFF_CONFIG = {
  // Types
  TYPES: {
    NURSE: {
      name: "Nurse",
      skill: 1,
      color: 0x3b82f6, // Blue
    },
    DOCTOR: {
      name: "Doctor",
      skill: 2,
      color: 0x8b5cf6, // Purple
    },
  },

  // Fatigue settings
  FATIGUE: {
    MAX: 100,
    EXHAUSTED_THRESHOLD: 80,
    WORK_RATE: 2, // Per second while treating
    IDLE_RATE: 0.5, // Per second while idle
    RECOVERY_RATE: 10, // Per second in break room
  },

  // Movement
  SPEED: 120,

  // AI
  AI_UPDATE_INTERVAL: 2000, // ms between AI decisions
} as const;

// ===========================================
// ROOM SETTINGS
// ===========================================
export const ROOM_CONFIG = {
  WAITING_AREA: {
    name: "Waiting Area",
    capacity: 10,
  },
  ER_BEDS: {
    name: "ER Beds",
    capacity: 6,
  },
  BREAK_ROOM: {
    name: "Break Room",
    capacity: 3,
  },
  TRIAGE: {
    name: "Triage",
    capacity: 2,
  },
} as const;

// ===========================================
// CHAOS SYSTEM
// ===========================================
export const CHAOS_CONFIG = {
  // Maximum chaos before game over
  MAX: 100,

  // Warning thresholds
  WARNING_THRESHOLD: 70,
  CRITICAL_THRESHOLD: 90,

  // Chaos weights
  WEIGHTS: {
    WAITING_PATIENT: 3,
    CRITICAL_PATIENT: 8,
    DEATH: 20,
    BROKEN_EQUIPMENT: 10,
    EXHAUSTED_STAFF: 5,
    FULL_BEDS: 2,
  },

  // Decay rate per second when things are good
  DECAY_RATE: 0.5,
} as const;

// ===========================================
// SPAWN SETTINGS
// ===========================================
export const SPAWN_CONFIG = {
  // Initial spawn interval in seconds
  BASE_INTERVAL: 15,

  // Minimum spawn interval
  MIN_INTERVAL: 5,

  // How much interval decreases per minute
  INTERVAL_DECAY: 1,

  // Early game severity distribution (0-40% of shift)
  EARLY_SEVERITY_WEIGHTS: {
    1: 40, // 40% chance
    2: 35, // 35% chance
    3: 20, // 20% chance
    4: 5, // 5% chance
    5: 0, // 0% chance
  } as Record<number, number>,

  // Late game severity distribution (60-100% of shift)
  LATE_SEVERITY_WEIGHTS: {
    1: 10,
    2: 20,
    3: 30,
    4: 25,
    5: 15,
  } as Record<number, number>,
} as const;

// ===========================================
// EQUIPMENT SETTINGS
// ===========================================
export const EQUIPMENT_CONFIG = {
  // Repair time in seconds
  REPAIR_TIME: 3,

  // Breakdown check interval
  BREAKDOWN_CHECK_INTERVAL: 30, // seconds

  // Types
  TYPES: {
    BED: {
      name: "Bed",
      repairable: true,
    },
    MONITOR: {
      name: "Monitor",
      repairable: true,
    },
  },
} as const;

// ===========================================
// UI SETTINGS
// ===========================================
export const UI_CONFIG = {
  // Colors
  COLORS: {
    PRIMARY: 0x16c79a, // Teal
    SECONDARY: 0x1a1a2e, // Dark blue
    DANGER: 0xff4757, // Red
    WARNING: 0xffa502, // Orange
    SUCCESS: 0x2ed573, // Green
    TEXT: 0xffffff, // White
    TEXT_DARK: 0x1a1a2e, // Dark
  },

  // Font
  FONT: {
    FAMILY: "Arial, sans-serif",
    SIZES: {
      SMALL: 16,
      MEDIUM: 24,
      LARGE: 32,
      XLARGE: 48,
      TITLE: 64,
    },
  },

  // Button
  BUTTON: {
    WIDTH: 250,
    HEIGHT: 50,
    RADIUS: 10,
    HOVER_SCALE: 1.05,
  },

  // HUD
  HUD: {
    PADDING: 20,
    BAR_WIDTH: 300,
    BAR_HEIGHT: 24,
  },

  // Notification
  NOTIFICATION: {
    DURATION: 3000, // ms
    FADE_TIME: 500, // ms
  },
} as const;

// ===========================================
// SCENE KEYS
// ===========================================
export const SCENES = {
  BOOT: "Boot",
  PRELOADER: "Preloader",
  MAIN_MENU: "MainMenu",
  HOW_TO_PLAY: "HowToPlay",
  SETTINGS: "Settings",
  GAME: "Game",
  PAUSE: "Pause",
  GAME_OVER: "GameOver",
  ANIMATION_DEBUG: "AnimationDebug",
} as const;

// ===========================================
// ASSET KEYS
// ===========================================
export const ASSETS = {
  // Images
  IMAGES: {
    BACKGROUND: "background",
    LOGO: "logo",
    PLAYER: "player",
    PATIENT: "patient",
    NURSE: "nurse",
    DOCTOR: "doctor",
    BED: "bed",
    BED_OCCUPIED: "bed_occupied",
  },

  // Spritesheets
  SPRITES: {
    PLAYER_WALK: "player_walk",
    PATIENT_WALK: "patient_walk",
  },

  // Audio
  AUDIO: {
    MUSIC_MENU: "music_menu",
    MUSIC_GAME: "music_game",
    SFX_CLICK: "sfx_click",
    SFX_BEEP: "sfx_beep",
    SFX_ALARM: "sfx_alarm",
    SFX_FLATLINE: "sfx_flatline",
    SFX_SUCCESS: "sfx_success",
  },

  // Tilemaps
  TILEMAPS: {
    ER_MAP: "er_map",
  },
} as const;

// ===========================================
// EVENTS
// ===========================================
export const EVENTS = {
  // Patient events
  PATIENT_ARRIVED: "patient:arrived",
  PATIENT_TRIAGED: "patient:triaged",
  PATIENT_ASSIGNED_BED: "patient:assignedBed",
  PATIENT_WORSENED: "patient:worsened",
  PATIENT_DIED: "patient:died",
  PATIENT_STABILIZED: "patient:stabilized",
  PATIENT_DISCHARGED: "patient:discharged",

  // Staff events
  STAFF_ASSIGNED: "staff:assigned",
  STAFF_EXHAUSTED: "staff:exhausted",
  STAFF_RECOVERED: "staff:recovered",
  STAFF_STARTED_TREATMENT: "staff:startedTreatment",
  STAFF_FINISHED_TREATMENT: "staff:finishedTreatment",

  // Equipment events
  EQUIPMENT_BROKEN: "equipment:broken",
  EQUIPMENT_REPAIRED: "equipment:repaired",

  // Game events
  CHAOS_CHANGED: "game:chaosChanged",
  SHIFT_WARNING: "game:shiftWarning",
  SHIFT_ENDED: "game:shiftEnded",
  GAME_OVER: "game:gameOver",
  GAME_PAUSED: "game:paused",
  GAME_RESUMED: "game:resumed",

  // UI events
  NOTIFICATION: "ui:notification",
  SHOW_TOOLTIP: "ui:showTooltip",
  HIDE_TOOLTIP: "ui:hideTooltip",
} as const;

// ===========================================
// GRADE CALCULATION
// ===========================================
export const GRADE_CONFIG = {
  S: { minScore: 95, deaths: 0, maxChaos: 30 },
  A: { minScore: 85, deaths: 1, maxChaos: 50 },
  B: { minScore: 70, deaths: 2, maxChaos: 70 },
  C: { minScore: 55, deaths: 3, maxChaos: 85 },
  D: { minScore: 40, deaths: 4, maxChaos: 95 },
  F: { minScore: 0, deaths: 999, maxChaos: 100 },
} as const;

export type Grade = keyof typeof GRADE_CONFIG;
