/**
 * Door Entity
 * Interactive door that animates based on player approach direction
 */

export type DoorState = "closed" | "opening" | "open" | "closing";
export type DoorDirection = "up" | "down";
export type DoorType = "single" | "dual";

export interface DoorConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  spriteKey?: string;
  /** If true, door opens automatically when player is near */
  autoOpen?: boolean;
  /** Distance at which door auto-opens */
  triggerDistance?: number;
  /** Door type: "single" (only opens one direction) or "dual" (opens both directions) */
  doorType?: DoorType;
  /** For single doors, the fixed direction it opens */
  fixedDirection?: DoorDirection;
}

export class Door extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;

  // State
  private doorState: DoorState = "closed";
  private openDirection: DoorDirection = "down";
  private autoOpen: boolean = true;
  private triggerDistance: number = 50;
  private spriteKey: string;
  private closeTimer: number = 0;
  private closeDelay: number = 1000; // 1 second delay before closing
  private openCooldown: number = 0; // Cooldown after opening
  private openCooldownDelay: number = 1000; // 1 second cooldown after opening
  private doorType: DoorType = "dual";
  private fixedDirection: DoorDirection = "down";

  constructor(config: DoorConfig) {
    super(config.scene, config.x, config.y);

    this.spriteKey = config.spriteKey || "door01";
    this.autoOpen = config.autoOpen ?? true;
    this.triggerDistance = config.triggerDistance ?? 50;
    this.doorType = config.doorType || "dual";
    this.fixedDirection = config.fixedDirection || "down";

    // Create door sprite
    this.sprite = config.scene.add.sprite(0, 0, this.spriteKey, 0);
    this.sprite.setOrigin(0.5, 0.5);
    this.add(this.sprite);

    // Add to scene
    config.scene.add.existing(this);

    // Create animations
    this.createAnimations();

    // Update depth based on Y position
    this.updateDepth();
  }

  /**
   * Create door animations
   */
  private createAnimations(): void {
    const anims = this.scene.anims;
    const key = this.spriteKey;

    // Open from below (player approaching from bottom)
    if (!anims.exists(`${key}_open_down`)) {
      anims.create({
        key: `${key}_open_down`,
        frames: [
          { key: key, frame: 0 }, // closed
          { key: key, frame: 1 }, // slight_open_down
          { key: key, frame: 2 }, // open_down
        ],
        frameRate: 8,
        repeat: 0,
      });
    }

    // Close from below
    if (!anims.exists(`${key}_close_down`)) {
      anims.create({
        key: `${key}_close_down`,
        frames: [
          { key: key, frame: 2 }, // open_up
          { key: key, frame: 1 }, // slight_open_up
          { key: key, frame: 0 }, // closed
        ],
        frameRate: 8,
        repeat: 0,
      });
    }

    // Open from above (player approaching from top)
    if (!anims.exists(`${key}_open_up`)) {
      anims.create({
        key: `${key}_open_up`,
        frames: [
          { key: key, frame: 0 }, // closed
          { key: key, frame: 3 }, // slight_open_up
          { key: key, frame: 4 }, // open_up
        ],
        frameRate: 8,
        repeat: 0,
      });
    }

    // Close from above
    if (!anims.exists(`${key}_close_up`)) {
      anims.create({
        key: `${key}_close_up`,
        frames: [
          { key: key, frame: 4 }, // open_up
          { key: key, frame: 3 }, // slight_open_up
          { key: key, frame: 0 }, // closed
        ],
        frameRate: 8,
        repeat: 0,
      });
    }
  }

  /**
   * Update depth based on Y position (for proper rendering order)
   */
  updateDepth(): void {
    // Objects with higher Y (lower on screen) should render on top
    // Add offset to base depth (100 is around player level)
    this.setDepth(80 + this.y * 0.1);
  }

  /**
   * Check if player or NPCs are near and handle auto-open
   */
  update(
    playerX: number,
    playerY: number,
    delta: number,
    npcs: Array<{ x: number; y: number }> = []
  ): void {
    if (!this.autoOpen) return;

    // Decrement cooldown timer
    if (this.openCooldown > 0) {
      this.openCooldown -= delta;
    }

    // Check player distance
    const playerDx = playerX - this.x;
    const playerDy = playerY - this.y;
    const playerDistance = Math.sqrt(playerDx * playerDx + playerDy * playerDy);

    // Check NPC distances
    let closestNpcDistance = Infinity;
    let closestNpcDy = 0;
    for (const npc of npcs) {
      const dx = npc.x - this.x;
      const dy = npc.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < closestNpcDistance) {
        closestNpcDistance = distance;
        closestNpcDy = dy;
      }
    }

    // Use the closest entity (player or NPC)
    const minDistance = Math.min(playerDistance, closestNpcDistance);
    const usePlayerDirection = playerDistance <= closestNpcDistance;
    const approachDy = usePlayerDirection ? playerDy : closestNpcDy;

    if (minDistance < this.triggerDistance) {
      // Someone is near - open door
      let direction: DoorDirection;

      if (this.doorType === "single") {
        // Single door always opens in fixed direction
        direction = this.fixedDirection;
      } else {
        // Dual door opens based on approach direction (prioritize player)
        direction = approachDy < 0 ? "up" : "down";
      }

      this.open(direction);
      this.closeTimer = 0; // Reset timer while someone is near
    } else if (minDistance > this.triggerDistance + 20) {
      // Everyone moved away - start close timer
      if (this.doorState === "open") {
        this.closeTimer += delta;
        if (this.closeTimer >= this.closeDelay) {
          this.close();
          this.closeTimer = 0;
        }
      }
    }
  }

  /**
   * Open the door
   */
  open(direction: DoorDirection): void {
    // For dual doors, don't change direction during cooldown period
    if (
      this.doorType === "dual" &&
      this.openCooldown > 0 &&
      this.openDirection !== direction
    ) {
      return;
    }

    if (this.doorState === "open" || this.doorState === "opening") {
      return;
    }

    this.openDirection = direction;
    this.doorState = "opening";
    this.openCooldown = this.openCooldownDelay; // Start cooldown

    // Show slight open frame first, then fully open after a brief delay
    // Frame 1 = slight_open (down), Frame 3 = slight_open (up)
    const slightFrame = direction === "up" ? 3 : 1;
    const openFrame = direction === "up" ? 4 : 2;

    this.sprite.setFrame(slightFrame);

    // Then fully open after 125ms
    this.scene.time.delayedCall(125, () => {
      this.sprite.setFrame(openFrame);
      this.doorState = "open";
    });
  }

  /**
   * Close the door
   */
  close(): void {
    if (this.doorState === "closed" || this.doorState === "closing") return;

    this.doorState = "closing";

    const animKey = `${this.spriteKey}_close_${this.openDirection}`;
    this.sprite.play(animKey);

    this.sprite.once("animationcomplete", () => {
      this.doorState = "closed";
    });
  }

  /**
   * Toggle door state
   */
  toggle(direction: DoorDirection): void {
    if (this.doorState === "closed") {
      this.open(direction);
    } else if (this.doorState === "open") {
      this.close();
    }
  }

  /**
   * Get current state
   */
  getState(): DoorState {
    return this.doorState;
  }

  /**
   * Check if door is open (for collision purposes)
   */
  isOpen(): boolean {
    return this.doorState === "open";
  }

  /**
   * Get door collision bounds
   */
  getCollisionBounds(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    return {
      x: this.x - 32,
      y: this.y - 64,
      width: 64,
      height: 128,
    };
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
