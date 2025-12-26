/**
 * Player Entity
 * The main character controlled by the user
 */

import { PLAYER_CONFIG } from "../utils/Constants";
import { CollisionManager } from "../systems/CollisionManager";
import { SpriteSheetConfig, getSpriteConfig } from "../config/SpriteConfigs";
import EventBus from "../utils/EventBus";
import { Chair } from "./Chair";

export type PlayerDirection = "down" | "up" | "left" | "right";

export interface PlayerConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  collisionManager?: CollisionManager;
  /** Sprite key from SpriteConfigs (default: "doctor01") */
  spriteKey?: string;
}

export class Player extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Ellipse;
  private collisionManager: CollisionManager | null = null;
  private spriteConfig: SpriteSheetConfig | null = null;
  private currentAnimKey: string = "";

  // State
  private fatigue: number = 0;
  private isCarrying: boolean = false;
  private carryingEntity: Phaser.GameObjects.GameObject | null = null;
  private isSitting: boolean = false;
  private currentChair: Chair | null = null;

  // Movement
  private moveSpeed: number = PLAYER_CONFIG.SPEED;
  private velocityX: number = 0;
  private velocityY: number = 0;
  private direction: PlayerDirection = "down";
  private isMoving: boolean = false;

  // Collision (circle at feet)
  private hitboxRadius: number = 15;
  private hitboxOffsetY: number = 16; // Offset down to player's feet

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  constructor(config: PlayerConfig) {
    super(config.scene, config.x, config.y);

    this.collisionManager = config.collisionManager || null;

    // Get sprite configuration
    const spriteKey = config.spriteKey || "doctor01";
    this.spriteConfig = getSpriteConfig(spriteKey) || null;

    // Create shadow
    this.shadow = config.scene.add.ellipse(0, 24, 24, 10, 0x000000, 0.3);
    this.add(this.shadow);

    // Create sprite using spritesheet or fallback to placeholder
    const textureKey = this.spriteConfig?.key || "player";
    this.sprite = config.scene.add.sprite(0, 0, textureKey, 0);
    this.add(this.sprite);

    // Setup input
    this.setupInput();

    // Set depth so player appears above floor (0-50) but below top layers (150+)
    this.setDepth(100);

    // Add to scene
    config.scene.add.existing(this);

    // Set depth
    this.setDepth(100);

    // Create animations
    this.createAnimations();
  }

  /**
   * Setup keyboard input
   */
  private setupInput(): void {
    // Arrow keys
    this.cursors = this.scene.input.keyboard!.createCursorKeys();

    // WASD keys
    this.wasd = {
      W: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  /**
   * Create walking animations
   */
  private createAnimations(): void {
    // Animations are registered in Preloader from SpriteConfigs
    // Just set the initial idle animation
    if (this.spriteConfig) {
      this.playAnimation("idle", this.direction);
    }
  }

  /**
   * Play animation for action and direction
   */
  private playAnimation(action: string, direction: PlayerDirection): void {
    if (!this.spriteConfig) return;

    const animKey = `${this.spriteConfig.key}_${action}_${direction}`;

    // Only change animation if it's different
    if (this.currentAnimKey !== animKey && this.scene.anims.exists(animKey)) {
      this.sprite.play(animKey);
      this.currentAnimKey = animKey;
    }
  }

  /**
   * Update player each frame
   */
  update(delta: number): void {
    // Handle input
    this.handleInput();

    // Calculate new position
    let newX = this.x + this.velocityX * (delta / 1000);
    let newY = this.y + this.velocityY * (delta / 1000);

    // Check collision (at feet position)
    if (this.collisionManager) {
      const collision = this.collisionManager.checkCollision(
        newX,
        newY + this.hitboxOffsetY, // Check at feet
        this.hitboxRadius
      );
      newX = collision.correctedX;
      newY = collision.correctedY - this.hitboxOffsetY; // Adjust back
    }

    // Apply movement
    this.x = newX;
    this.y = newY;

    // Update depth based on Y position (for proper rendering order)
    // Objects lower on screen (higher Y) render on top
    this.setDepth(80 + this.y * 0.1);

    // Update animations
    this.updateAnimations();
  }

  /**
   * Handle movement input
   */
  private handleInput(): void {
    // Can't move while sitting
    if (this.isSitting) {
      this.velocityX = 0;
      this.velocityY = 0;
      this.isMoving = false;
      return;
    }

    let vx = 0;
    let vy = 0;

    // Horizontal movement
    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      vx = -1;
      this.direction = "left";
    } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
      vx = 1;
      this.direction = "right";
    }

    // Vertical movement
    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      vy = -1;
      this.direction = "up";
    } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
      vy = 1;
      this.direction = "down";
    }

    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }

    // Apply speed
    this.velocityX = vx * this.moveSpeed;
    this.velocityY = vy * this.moveSpeed;
    this.isMoving = vx !== 0 || vy !== 0;
  }

  /**
   * Update animations based on state
   */
  private updateAnimations(): void {
    // Don't override sit animation
    if (this.isSitting) return;

    if (this.spriteConfig) {
      // Use real spritesheet animations
      if (this.isMoving) {
        this.playAnimation("walk", this.direction);
      } else {
        this.playAnimation("idle", this.direction);
      }
    } else {
      // Fallback: placeholder animation (simple bob effect)
      if (this.isMoving) {
        const bobAmount = Math.sin(this.scene.time.now / 100) * 2;
        this.sprite.y = bobAmount;
        const shadowScale = 1 + Math.sin(this.scene.time.now / 100) * 0.05;
        this.shadow.setScale(shadowScale, 1);
        if (this.direction === "left") {
          this.sprite.setFlipX(true);
        } else if (this.direction === "right") {
          this.sprite.setFlipX(false);
        }
      } else {
        const idleBob = Math.sin(this.scene.time.now / 500) * 1;
        this.sprite.y = idleBob;
        this.shadow.setScale(1, 1);
      }
    }

    // Fatigue visual effect
    if (this.fatigue > 60) {
      const fatigueAlpha = 0.7 + Math.sin(this.scene.time.now / 300) * 0.3;
      this.sprite.setAlpha(fatigueAlpha);
    } else {
      this.sprite.setAlpha(1);
    }
  }

  /**
   * Set collision manager reference
   */
  setCollisionManager(manager: CollisionManager): void {
    this.collisionManager = manager;
  }

  /**
   * Set movement velocity directly (for external control)
   */
  setVelocity(x: number, y: number): void {
    this.velocityX = x;
    this.velocityY = y;

    if (x !== 0 || y !== 0) {
      this.isMoving = true;
      // Update direction based on velocity
      if (Math.abs(x) > Math.abs(y)) {
        this.direction = x > 0 ? "right" : "left";
      } else {
        this.direction = y > 0 ? "down" : "up";
      }
    } else {
      this.isMoving = false;
    }
  }

  /**
   * Get current position
   */
  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /**
   * Get current direction
   */
  getDirection(): PlayerDirection {
    return this.direction;
  }

  /**
   * Get hitbox radius
   */
  getHitboxRadius(): number {
    return this.hitboxRadius;
  }

  /**
   * Set hitbox radius
   */
  setHitboxRadius(radius: number): void {
    this.hitboxRadius = radius;
  }

  /**
   * Check if player can interact with target
   */
  canInteractWith(target: { x: number; y: number }): boolean {
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      target.x,
      target.y
    );
    return distance <= PLAYER_CONFIG.INTERACTION_RANGE;
  }

  /**
   * Pick up an entity (patient, equipment)
   */
  pickUp(entity: Phaser.GameObjects.GameObject): void {
    if (this.isCarrying) return;

    this.isCarrying = true;
    this.carryingEntity = entity;
    this.moveSpeed = PLAYER_CONFIG.SPEED * 0.7; // Slower when carrying

    EventBus.emit("player:pickup", { entity });
  }

  /**
   * Drop carried entity
   */
  drop(): Phaser.GameObjects.GameObject | null {
    if (!this.isCarrying) return null;

    const entity = this.carryingEntity;
    this.isCarrying = false;
    this.carryingEntity = null;
    this.moveSpeed = PLAYER_CONFIG.SPEED;

    EventBus.emit("player:drop", { entity });
    return entity;
  }

  /**
   * Check if carrying something
   */
  getIsCarrying(): boolean {
    return this.isCarrying;
  }

  /**
   * Get carried entity
   */
  getCarriedEntity(): Phaser.GameObjects.GameObject | null {
    return this.carryingEntity;
  }

  /**
   * Check if moving
   */
  getIsMoving(): boolean {
    return this.isMoving;
  }

  /**
   * Get fatigue level
   */
  getFatigue(): number {
    return this.fatigue;
  }

  /**
   * Set fatigue level
   */
  setFatigue(amount: number): void {
    this.fatigue = Phaser.Math.Clamp(amount, 0, PLAYER_CONFIG.FATIGUE_MAX);
  }

  /**
   * Increase fatigue
   */
  addFatigue(amount: number): void {
    this.fatigue = Math.min(PLAYER_CONFIG.FATIGUE_MAX, this.fatigue + amount);

    if (this.fatigue >= PLAYER_CONFIG.FATIGUE_MAX) {
      EventBus.emit("player:exhausted");
    }
  }

  /**
   * Recover fatigue (in break room)
   */
  recoverFatigue(delta: number): void {
    const recovery = PLAYER_CONFIG.FATIGUE_RECOVERY_RATE * (delta / 1000);
    this.fatigue = Math.max(0, this.fatigue - recovery);
  }

  /**
   * Teleport to position (no collision check)
   */
  teleportTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /**
   * Get movement speed
   */
  getMoveSpeed(): number {
    return this.moveSpeed;
  }

  /**
   * Set movement speed
   */
  setMoveSpeed(speed: number): void {
    this.moveSpeed = speed;
  }

  /**
   * Flash player (for taking damage, etc.)
   */
  flash(color: number = 0xff0000, duration: number = 200): void {
    this.sprite.setTint(color);
    this.scene.time.delayedCall(duration, () => {
      this.sprite.clearTint();
    });
  }

  /**
   * Sit in a chair
   */
  sitInChair(chair: Chair): boolean {
    if (this.isSitting || chair.getIsOccupied()) return false;

    // Mark chair as occupied
    chair.setOccupied(true);
    this.currentChair = chair;
    this.isSitting = true;

    // Position player at chair with offset
    const offset = chair.getSitOffset();
    this.x = chair.x + offset.x;
    this.y = chair.y + offset.y;

    // Get correct animation based on chair direction
    const animAction = chair.getSitAnimationAction();
    const animDirection = chair.getSitAnimationDirection();
    this.playAnimation(animAction, animDirection as PlayerDirection);

    // Set depth based on chair direction for proper rendering
    this.setDepth(chair.getSitDepth());

    // Stop any movement
    this.velocityX = 0;
    this.velocityY = 0;
    this.isMoving = false;

    EventBus.emit("player:sit", { chair });
    return true;
  }

  /**
   * Stand up from chair
   */
  standUp(): boolean {
    if (!this.isSitting || !this.currentChair) return false;

    // Free the chair
    this.currentChair.setOccupied(false);
    const chair = this.currentChair;
    this.currentChair = null;
    this.isSitting = false;

    // Reset depth to normal
    this.setDepth(80 + this.y * 0.1);

    // Play idle animation in the direction we were sitting
    this.playAnimation("idle", this.direction);

    EventBus.emit("player:stand", { chair });
    return true;
  }

  /**
   * Check if player is sitting
   */
  getIsSitting(): boolean {
    return this.isSitting;
  }

  /**
   * Get current chair (if sitting)
   */
  getCurrentChair(): Chair | null {
    return this.currentChair;
  }

  /**
   * Destroy player
   */
  destroy(fromScene?: boolean): void {
    // Clean up any tweens
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.killTweensOf(this.shadow);
    super.destroy(fromScene);
  }
}
