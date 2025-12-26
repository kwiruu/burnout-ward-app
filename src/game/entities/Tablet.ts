/**
 * Tablet Entity
 * Interactive tablet object with pointer indicator when player is far
 * and E key indicator when player is near
 */

export interface TabletConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  id: string;
  /** Sprite key for the tablet (default: "tablet") */
  spriteKey?: string;
}

export class Tablet extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private pointerSprite: Phaser.GameObjects.Sprite;
  private tabletId: string;
  private isPlayerNear: boolean = false;
  private pointerRange: number = 150; // Distance to show pointer (farther than interaction range)

  constructor(config: TabletConfig) {
    super(config.scene, config.x, config.y);

    this.tabletId = config.id;

    // Create tablet sprite (32x64)
    const spriteKey = config.spriteKey || "tablet";
    this.sprite = config.scene.add.sprite(0, 0, spriteKey);
    this.sprite.setOrigin(0.5, 1); // Bottom center origin for depth sorting
    this.add(this.sprite);

    // Create pointer sprite (arrow pointing down, shown when player is not near)
    this.pointerSprite = config.scene.add.sprite(0, -70, "ui_arrow_down", 0);
    this.pointerSprite.setOrigin(0.5);
    this.pointerSprite.setVisible(false);
    this.add(this.pointerSprite);

    // Add to scene
    config.scene.add.existing(this);

    // Update depth based on Y position
    this.updateDepth();
  }

  /**
   * Get tablet ID
   */
  getId(): string {
    return this.tabletId;
  }

  /**
   * Update depth based on Y position (for proper rendering order)
   */
  updateDepth(): void {
    this.setDepth(80 + this.y * 0.1);
    // Keep pointer at higher depth so it's always visible (if it exists)
    if (this.pointerSprite) {
      this.pointerSprite.setDepth(9999);
    }
  }

  /**
   * Update tablet state based on player distance
   * Call this every frame with the player position
   */
  update(playerX: number, playerY: number, interactionRange: number): void {
    const distance = Phaser.Math.Distance.Between(
      playerX,
      playerY,
      this.x,
      this.y
    );

    this.isPlayerNear = distance <= interactionRange;

    // Show/hide pointer based on distance
    // Show pointer when player is within pointer range but NOT within interaction range
    const shouldShowPointer =
      distance <= (this.pointerRange + 100) && distance > interactionRange;

    if (shouldShowPointer && !this.pointerSprite.visible) {
      this.showPointer();
    } else if (!shouldShowPointer && this.pointerSprite.visible) {
      this.hidePointer();
    }
  }

  /**
   * Show the pointer indicator
   */
  private showPointer(): void {
    this.pointerSprite.setVisible(true);

    // Play arrow animation
    if (this.scene.anims.exists("ui_arrow_down_anim")) {
      this.pointerSprite.play("ui_arrow_down_anim");
    }

    // Fade in
    this.pointerSprite.setAlpha(0);
    this.scene.tweens.add({
      targets: this.pointerSprite,
      alpha: 1,
      duration: 200,
      ease: "Power2",
    });
  }

  /**
   * Hide the pointer indicator
   */
  private hidePointer(): void {
    this.scene.tweens.add({
      targets: this.pointerSprite,
      alpha: 0,
      duration: 150,
      ease: "Power2",
      onComplete: () => {
        this.pointerSprite.setVisible(false);
        this.pointerSprite.stop();
      },
    });
  }

  /**
   * Check if player is near the tablet
   */
  getIsPlayerNear(): boolean {
    return this.isPlayerNear;
  }

  /**
   * Set the range at which the pointer appears
   */
  setPointerRange(range: number): void {
    this.pointerRange = range;
  }

  /**
   * Get interaction bounds for collision detection
   */
  getInteractionBounds(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    return {
      x: this.x - 16,
      y: this.y - 64,
      width: 32,
      height: 64,
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

  /**
   * Clean up
   */
  destroy(): void {
    this.sprite?.destroy();
    this.pointerSprite?.destroy();
    super.destroy();
  }
}
