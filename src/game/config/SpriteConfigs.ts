/**
 * Sprite Configuration System
 *
 * Define spritesheets and their animations in a flexible way.
 * Supports variable frame sizes and Y positions for complex spritesheets.
 */

// ===========================================
// TYPES
// ===========================================

export type AnimationDirection = "down" | "up" | "left" | "right" | "none";

export interface AnimationDef {
  /** Unique key for this animation */
  key: string;
  /** Y position in pixels (top of this animation row) */
  y: number;
  /** Starting X position in pixels (default: 0) */
  x?: number;
  /** Number of frames in this animation */
  frameCount: number;
  /** Direction the character faces during this animation */
  direction: AnimationDirection;
  /** Frames per second (default: 8) */
  frameRate?: number;
  /** Loop count: -1 = infinite, 0 = no repeat, n = repeat n times (default: -1) */
  repeat?: number;
  /** Whether this is an idle animation (single frame or very slow) */
  isIdle?: boolean;
}

export interface SpriteSheetConfig {
  /** Unique key for this spritesheet */
  key: string;
  /** Path to the image file */
  path: string;
  /** Width of a single frame */
  frameWidth: number;
  /** Height of a single frame */
  frameHeight: number;
  /** Total width of spritesheet in pixels */
  imageWidth: number;
  /** Total height of spritesheet in pixels */
  imageHeight: number;
  /** All animations defined for this spritesheet */
  animations: AnimationDef[];
}

// ===========================================
// ANIMATION TEMPLATE (shared by all characters)
// ===========================================

/**
 * Standard character animation template
 * Frame size: 32x64 (no gap between rows)
 */
export interface CharacterAnimationTemplate {
  frameWidth: number;
  frameHeight: number;
  gapBetweenAnimations: number;
  animations: {
    name: string;
    directions: AnimationDirection[];
    frameCount: number;
    frameRate?: number;
  }[];
}

export const CHARACTER_ANIM_TEMPLATE: CharacterAnimationTemplate = {
  frameWidth: 32,
  frameHeight: 64,
  gapBetweenAnimations: 0,
  animations: [
    // Order matters - this determines Y position!
    {
      name: "no_anim_idle",
      directions: ["right", "up", "left", "down"],
      frameCount: 1,
      frameRate: 1,
    },
    {
      name: "idle",
      directions: ["right", "up", "left", "down"],
      frameCount: 6,
      frameRate: 6,
    },
    {
      name: "walk",
      directions: ["right", "up", "left", "down"],
      frameCount: 6,
      frameRate: 8,
    },
    { name: "sleep", directions: ["none"], frameCount: 6, frameRate: 4 },
    { name: "sit", directions: ["right", "left"], frameCount: 6, frameRate: 6 },
    {
      name: "idle_hold",
      directions: ["right", "left"],
      frameCount: 6,
      frameRate: 6,
    },
    { name: "drink", directions: ["none"], frameCount: 12, frameRate: 8 },
    { name: "read", directions: ["none"], frameCount: 12, frameRate: 6 },
    {
      name: "carry_walk",
      directions: ["right", "up", "left", "down"],
      frameCount: 6,
      frameRate: 8,
    },
    {
      name: "take",
      directions: ["right", "up", "left", "down"],
      frameCount: 12,
      frameRate: 12,
    },
    {
      name: "put",
      directions: ["right", "up", "left", "down"],
      frameCount: 10,
      frameRate: 10,
    },
    {
      name: "carry",
      directions: ["right", "up", "left", "down"],
      frameCount: 10,
      frameRate: 8,
    },
    {
      name: "place",
      directions: ["right", "up", "left", "down"],
      frameCount: 10,
      frameRate: 10,
    },
    {
      name: "slap",
      directions: ["right", "up", "left", "down"],
      frameCount: 6,
      frameRate: 8,
    },
    {
      name: "punch",
      directions: ["right", "up", "left", "down"],
      frameCount: 6,
      frameRate: 10,
    },
  ],
};

/**
 * Generate animations from template for a character
 *
 * Layout: Each animation group is ONE ROW with directions laid out horizontally:
 * [right frames][up frames][left frames][down frames]
 *
 * Frames are 32x64 with no gaps between rows.
 */
export function generateCharacterAnimations(
  spriteKey: string,
  template: CharacterAnimationTemplate = CHARACTER_ANIM_TEMPLATE
): AnimationDef[] {
  const animations: AnimationDef[] = [];
  let currentY = 0; // No initial gap

  for (const anim of template.animations) {
    // All directions are in the SAME ROW, laid out horizontally
    let currentX = 0;

    for (const dir of anim.directions) {
      const key =
        dir === "none"
          ? `${spriteKey}_${anim.name}`
          : `${spriteKey}_${anim.name}_${dir}`;

      animations.push({
        key,
        y: currentY,
        x: currentX,
        frameCount: anim.frameCount,
        direction: dir,
        frameRate: anim.frameRate ?? 8,
        repeat: -1,
        isIdle: anim.name.includes("idle") || anim.frameCount === 1,
      });

      // Move X to the next direction's frames
      currentX += anim.frameCount * template.frameWidth;
    }

    // Move to next row (frame height + gap)
    currentY += template.frameHeight + template.gapBetweenAnimations;
  }

  return animations;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Add custom frames to a texture for a character spritesheet
 * This handles the 16px vertical gaps between animation rows
 */
export function addCustomFramesToTexture(
  scene: Phaser.Scene,
  config: SpriteSheetConfig
): void {
  const texture = scene.textures.get(config.key);
  if (!texture) {
    console.error(`Texture "${config.key}" not found`);
    return;
  }

  let frameIndex = 0;

  // For each animation, add frames at the correct pixel positions
  for (const anim of config.animations) {
    const startX = anim.x ?? 0;
    const y = anim.y;

    for (let i = 0; i < anim.frameCount; i++) {
      const x = startX + i * config.frameWidth;

      // Add frame with exact pixel coordinates
      texture.add(
        frameIndex,
        0, // source index (0 for single-image texture)
        x,
        y,
        config.frameWidth,
        config.frameHeight
      );

      frameIndex++;
    }
  }

  console.log(`✅ Added ${frameIndex} custom frames to "${config.key}"`);
}

/**
 * Get frame indices for an animation (sequential based on animation order)
 */
export function getAnimationFrameIndices(
  anim: AnimationDef,
  config: SpriteSheetConfig
): number[] {
  // Calculate starting frame index by counting all frames before this animation
  let startFrame = 0;
  for (const a of config.animations) {
    if (a.key === anim.key) break;
    startFrame += a.frameCount;
  }

  const frames: number[] = [];
  for (let i = 0; i < anim.frameCount; i++) {
    frames.push(startFrame + i);
  }

  return frames;
}

/**
 * Create Phaser animation config from our AnimationDef
 */
export function createPhaserAnimConfig(
  config: SpriteSheetConfig,
  anim: AnimationDef
): Phaser.Types.Animations.Animation {
  const frames = getAnimationFrameIndices(anim, config);

  return {
    key: anim.key,
    frames: frames.map((frameIndex) => ({
      key: config.key,
      frame: frameIndex,
    })),
    frameRate: anim.frameRate ?? 8,
    repeat: anim.repeat ?? -1,
  };
}

/**
 * Register all animations from a spritesheet config in a Phaser scene
 */
export function registerAnimations(
  scene: Phaser.Scene,
  config: SpriteSheetConfig
): void {
  config.animations.forEach((anim) => {
    // Skip if animation already exists
    if (scene.anims.exists(anim.key)) return;

    const animConfig = createPhaserAnimConfig(config, anim);
    scene.anims.create(animConfig);
  });

  console.log(
    `✅ Registered ${config.animations.length} animations for "${config.key}"`
  );
}

/**
 * Get all animation keys for a sprite
 */
export function getAnimationKeys(config: SpriteSheetConfig): string[] {
  return config.animations.map((a) => a.key);
}

/**
 * Get animation key for a specific action and direction
 */
export function getAnimationKey(
  spriteKey: string,
  action: string,
  direction: AnimationDirection
): string {
  if (direction === "none") {
    return `${spriteKey}_${action}`;
  }
  return `${spriteKey}_${action}_${direction}`;
}

// ===========================================
// SPRITE DEFINITIONS
// ===========================================

/**
 * Create a character sprite config
 */
function createCharacterConfig(key: string, path: string): SpriteSheetConfig {
  return {
    key,
    path,
    frameWidth: CHARACTER_ANIM_TEMPLATE.frameWidth,
    frameHeight: CHARACTER_ANIM_TEMPLATE.frameHeight,
    imageWidth: 1792,
    imageHeight: 1280,
    animations: generateCharacterAnimations(key),
  };
}

// Character sprites
export const SPRITE_DOCTOR01 = createCharacterConfig(
  "doctor01",
  "src/resources/characters/doctor01.png"
);

// Patient sprites (same layout as characters)
export const SPRITE_PATIENT01 = createCharacterConfig(
  "patient01",
  "src/resources/patients/patient01.png"
);
export const SPRITE_PATIENT02 = createCharacterConfig(
  "patient02",
  "src/resources/patients/patient02.png"
);
export const SPRITE_PATIENT03 = createCharacterConfig(
  "patient03",
  "src/resources/patients/patient03.png"
);
export const SPRITE_PATIENT04 = createCharacterConfig(
  "patient04",
  "src/resources/patients/patient04.png"
);
export const SPRITE_PATIENT05 = createCharacterConfig(
  "patient05",
  "src/resources/patients/patient05.png"
);
export const SPRITE_PATIENT06 = createCharacterConfig(
  "patient06",
  "src/resources/patients/patient06.png"
);
export const SPRITE_PATIENT07 = createCharacterConfig(
  "patient07",
  "src/resources/patients/patient07.png"
);
export const SPRITE_PATIENT08 = createCharacterConfig(
  "patient08",
  "src/resources/patients/patient08.png"
);
export const SPRITE_PATIENT09 = createCharacterConfig(
  "patient09",
  "src/resources/patients/patient09.png"
);

// Staff sprites (same layout as characters)
export const SPRITE_STAFF01 = createCharacterConfig(
  "staff01",
  "src/resources/staffs/staff01.png"
);
export const SPRITE_STAFF02 = createCharacterConfig(
  "staff02",
  "src/resources/staffs/staff02.png"
);
export const SPRITE_STAFF03 = createCharacterConfig(
  "staff03",
  "src/resources/staffs/staff03.png"
);
export const SPRITE_STAFF04 = createCharacterConfig(
  "staff04",
  "src/resources/staffs/staff04.png"
);
export const SPRITE_STAFF05 = createCharacterConfig(
  "staff05",
  "src/resources/staffs/staff05.png"
);
export const SPRITE_STAFF06 = createCharacterConfig(
  "staff06",
  "src/resources/staffs/staff06.png"
);
export const SPRITE_STAFF07 = createCharacterConfig(
  "staff07",
  "src/resources/staffs/staff07.png"
);
export const SPRITE_STAFF08 = createCharacterConfig(
  "staff08",
  "src/resources/staffs/staff08.png"
);

// Add more characters easily:
// export const SPRITE_NURSE01 = createCharacterConfig(
//   "nurse01",
//   "src/resources/characters/nurse01.png"
// );

// ===========================================
// SPRITE REGISTRY
// ===========================================

/** All available sprite configurations */
export const SPRITES: Record<string, SpriteSheetConfig> = {
  doctor01: SPRITE_DOCTOR01,
  patient01: SPRITE_PATIENT01,
  patient02: SPRITE_PATIENT02,
  patient03: SPRITE_PATIENT03,
  patient04: SPRITE_PATIENT04,
  patient05: SPRITE_PATIENT05,
  patient06: SPRITE_PATIENT06,
  patient07: SPRITE_PATIENT07,
  patient08: SPRITE_PATIENT08,
  patient09: SPRITE_PATIENT09,
  staff01: SPRITE_STAFF01,
  staff02: SPRITE_STAFF02,
  staff03: SPRITE_STAFF03,
  staff04: SPRITE_STAFF04,
  staff05: SPRITE_STAFF05,
  staff06: SPRITE_STAFF06,
  staff07: SPRITE_STAFF07,
  staff08: SPRITE_STAFF08,
  // nurse01: SPRITE_NURSE01,
};

/**
 * Get sprite config by key
 */
export function getSpriteConfig(key: string): SpriteSheetConfig | undefined {
  return SPRITES[key];
}

/**
 * Get list of all available animations for a sprite (for debug UI)
 */
export function getAvailableAnimations(
  spriteKey: string
): { key: string; direction: AnimationDirection }[] {
  const config = getSpriteConfig(spriteKey);
  if (!config) return [];

  return config.animations.map((a) => ({
    key: a.key,
    direction: a.direction,
  }));
}
