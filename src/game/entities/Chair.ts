/**
 * Chair Entity
 * Waiting room chairs with different colors for urgency levels
 */

export type ChairColor = "yellow" | "green" | "red";
export type ChairDirection =
  | "left_with_arm_rest"
  | "left"
  | "down"
  | "right"
  | "right_with_arm_rest"
  | "up";

// Map chair direction to sit animation direction (only "left" and "right" exist)
export const CHAIR_TO_SIT_DIRECTION: Record<ChairDirection, "left" | "right"> =
  {
    left_with_arm_rest: "left",
    left: "left",
    down: "right", // Sitting facing down, show right-facing sit pose
    right: "right",
    right_with_arm_rest: "right",
    up: "left", // Sitting facing up, show left-facing sit pose
  };

export interface ChairConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  color?: ChairColor;
  direction?: ChairDirection;
  spriteKey?: string;
}

// Frame mapping based on spritesheet layout
// 3 rows (yellow, green, red) x 6 columns (directions)
const COLOR_ROW: Record<ChairColor, number> = {
  yellow: 0,
  green: 1,
  red: 2,
};

const DIRECTION_COLUMN: Record<ChairDirection, number> = {
  left_with_arm_rest: 0,
  left: 1,
  down: 2,
  right: 3,
  right_with_arm_rest: 4,
  up: 5,
};

export class Chair extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private chairColor: ChairColor;
  private direction: ChairDirection;
  private spriteKey: string;
  private isOccupied: boolean = false;

  constructor(config: ChairConfig) {
    super(config.scene, config.x, config.y);

    this.spriteKey = config.spriteKey || "chairs";
    this.chairColor = config.color || "yellow";
    this.direction = config.direction || "down";

    // Calculate frame index based on color and direction
    const frameIndex = this.getFrameIndex();

    // Create chair sprite
    this.sprite = config.scene.add.sprite(0, 0, this.spriteKey, frameIndex);
    this.sprite.setOrigin(0.5, 0.5);
    this.add(this.sprite);

    // Add to scene
    config.scene.add.existing(this);

    // Update depth based on Y position
    this.updateDepth();
  }

  /**
   * Calculate frame index from color and direction
   */
  private getFrameIndex(): number {
    const row = COLOR_ROW[this.chairColor];
    const col = DIRECTION_COLUMN[this.direction];
    // 6 columns per row
    return row * 6 + col;
  }

  /**
   * Update depth based on Y position (for proper rendering order)
   */
  updateDepth(): void {
    // Objects with higher Y (lower on screen) should render on top
    this.setDepth(80 + this.y * 0.1);
  }

  /**
   * Set chair color
   */
  setChairColor(color: ChairColor): void {
    this.chairColor = color;
    this.sprite.setFrame(this.getFrameIndex());
  }

  /**
   * Set chair direction
   */
  setDirection(direction: ChairDirection): void {
    this.direction = direction;
    this.sprite.setFrame(this.getFrameIndex());
  }

  /**
   * Get chair color
   */
  getChairColor(): ChairColor {
    return this.chairColor;
  }

  /**
   * Get chair direction
   */
  getDirection(): ChairDirection {
    return this.direction;
  }

  /**
   * Check if chair is occupied
   */
  getIsOccupied(): boolean {
    return this.isOccupied;
  }

  /**
   * Set occupied state
   */
  setOccupied(occupied: boolean): void {
    this.isOccupied = occupied;
  }

  /**
   * Get chair collision/interaction bounds
   */
  getInteractionBounds(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    return {
      x: this.x - 16,
      y: this.y - 24,
      width: 32,
      height: 48,
    };
  }

  /**
   * Get the sit animation direction for this chair
   */
  getSitDirection(): "left" | "right" {
    return CHAIR_TO_SIT_DIRECTION[this.direction];
  }

  /**
   * Check if this chair should use sit animation or idle animation
   * Up/down chairs use idle, left/right use sit
   */
  shouldUseSitAnimation(): boolean {
    return (
      this.direction === "left" ||
      this.direction === "left_with_arm_rest" ||
      this.direction === "right" ||
      this.direction === "right_with_arm_rest"
    );
  }

  /**
   * Get the animation action to use when sitting (either "sit" or "idle")
   */
  getSitAnimationAction(): "sit" | "idle" {
    return this.shouldUseSitAnimation() ? "sit" : "idle";
  }

  /**
   * Get the direction for the sitting animation
   * For up/down chairs, returns the chair direction; for left/right, uses sit direction
   */
  getSitAnimationDirection(): "left" | "right" | "up" | "down" {
    if (this.shouldUseSitAnimation()) {
      return this.getSitDirection();
    }
    // For up/down chairs, return the actual direction
    return this.direction === "up" ? "up" : "down";
  }

  /**
   * Get the sitting position offset based on chair direction
   * Returns offset from chair center where entity should sit
   */
  getSitOffset(): { x: number; y: number } {
    // Adjust sitting position based on chair facing
    switch (this.direction) {
      case "left_with_arm_rest":
      case "left":
        return { x: 2, y: 0.1 };
      case "right_with_arm_rest":
      case "right":
        return { x: -2, y: 0.1 };
      case "up":
        return { x: 0, y: -0.1 };
      case "down":
        return { x: 0, y: 0.1 };
      default:
        return { x: 0, y: 2 };
    }
  }

  /**
   * Get the absolute depth for a sitting entity
   * - DOWN: Player in front of chair back = render ON TOP (chair depth + large offset)
   * - UP: Player behind chair seat = render BEHIND (chair depth - large offset)
   * - LEFT/RIGHT: Player on chair = render ON TOP (chair depth + large offset)
   */
  getSitDepth(): number {
    const chairDepth = this.depth;
    switch (this.direction) {
      case "up":
        // Player is behind the chair, render below chair
        return chairDepth - 1;
      case "down":
        // Player is in front of chair back, render above chair
        return chairDepth + 1;
      case "left":
      case "left_with_arm_rest":
      case "right":
      case "right_with_arm_rest":
      default:
        // Player is on the chair, render above chair
        return chairDepth + 1;
    }
  }

  /**
   * Set position and update depth
   */
  setPosition(x: number, y?: number): this {
    super.setPosition(x, y);
    if (y !== undefined) {
      this.updateDepth();
    }
    return this;
  }

  destroy(): void {
    this.sprite?.destroy();
    super.destroy();
  }
}
