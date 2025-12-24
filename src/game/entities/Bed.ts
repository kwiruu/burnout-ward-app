/**
 * Bed Entity
 * Hospital beds where patients are treated
 */

import { BedState, BedData } from "../types";
import { UI_CONFIG } from "../utils/Constants";
import EventBus from "../utils/EventBus";

export interface BedConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  number: number;
  id: string;
}

export class Bed extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private numberLabel: Phaser.GameObjects.Text;
  private statusIndicator: Phaser.GameObjects.Arc;
  private needsAttentionIcon: Phaser.GameObjects.Text | null = null;
  private highlightGraphics: Phaser.GameObjects.Graphics | null = null;

  // Data
  private bedId: string;
  private bedNumber: number;
  private currentState: BedState;
  private patientId: string | null = null;
  private isWorking: boolean = true;
  private needsAttention: boolean = false;

  // Collision bounds (for CollisionManager)
  public readonly collisionBounds = {
    width: 48,
    height: 64,
  };

  constructor(config: BedConfig) {
    super(config.scene, config.x, config.y);

    this.bedId = config.id;
    this.bedNumber = config.number;
    this.currentState = "EMPTY";

    // Create visual representation
    this.createVisuals();

    // Add to scene
    config.scene.add.existing(this);
    this.setDepth(20);
  }

  /**
   * Create bed visuals
   */
  private createVisuals(): void {
    // Highlight graphics (shown when nearby/interactable)
    this.highlightGraphics = this.scene.add.graphics();
    this.add(this.highlightGraphics);

    // Bed sprite
    this.sprite = this.scene.add.sprite(0, 0, "bed");
    this.add(this.sprite);

    // Number label
    this.numberLabel = this.scene.add
      .text(0, 40, `${this.bedNumber}`, {
        fontFamily: "Arial Black",
        fontSize: "14px",
        color: "#666666",
      })
      .setOrigin(0.5);
    this.add(this.numberLabel);

    // Status indicator (shows occupied/reserved)
    this.statusIndicator = this.scene.add.circle(18, -28, 6, 0x4ade80);
    this.statusIndicator.setVisible(false);
    this.add(this.statusIndicator);

    // Needs attention icon
    this.needsAttentionIcon = this.scene.add.text(-18, -28, "❗", {
      fontSize: "16px",
    });
    this.needsAttentionIcon.setOrigin(0.5);
    this.needsAttentionIcon.setVisible(false);
    this.add(this.needsAttentionIcon);
  }

  /**
   * Update visual state
   */
  private updateVisuals(): void {
    if (!this.isWorking) {
      // Broken bed
      this.sprite.setTint(0xff4444);
      this.statusIndicator.setFillStyle(0xff4444);
      this.statusIndicator.setVisible(true);
      return;
    }

    switch (this.currentState) {
      case "EMPTY":
        this.sprite.setTexture("bed");
        this.sprite.clearTint();
        this.statusIndicator.setVisible(false);
        break;
      case "RESERVED":
        this.sprite.setTexture("bed");
        this.sprite.setTint(0xfbbf24);
        this.statusIndicator.setFillStyle(0xfbbf24);
        this.statusIndicator.setVisible(true);
        break;
      case "OCCUPIED":
        this.sprite.setTexture("bed_occupied");
        this.sprite.clearTint();
        this.statusIndicator.setFillStyle(0x3b82f6);
        this.statusIndicator.setVisible(true);
        break;
    }

    // Update needs attention indicator
    if (this.needsAttentionIcon) {
      this.needsAttentionIcon.setVisible(this.needsAttention);
      if (this.needsAttention) {
        // Pulse animation
        this.scene.tweens.add({
          targets: this.needsAttentionIcon,
          scale: 1.2,
          duration: 300,
          yoyo: true,
          repeat: -1,
        });
      } else {
        this.scene.tweens.killTweensOf(this.needsAttentionIcon);
        this.needsAttentionIcon.setScale(1);
      }
    }
  }

  /**
   * Reserve bed for a patient
   */
  reserve(patientId: string): boolean {
    if (this.currentState !== "EMPTY" || !this.isWorking) return false;

    this.currentState = "RESERVED";
    this.patientId = patientId;
    this.updateVisuals();
    return true;
  }

  /**
   * Patient arrives at bed
   */
  occupy(patientId: string): boolean {
    if (
      (this.currentState !== "RESERVED" && this.currentState !== "EMPTY") ||
      !this.isWorking
    )
      return false;

    this.currentState = "OCCUPIED";
    this.patientId = patientId;
    this.updateVisuals();
    return true;
  }

  /**
   * Patient leaves bed
   */
  release(): void {
    this.currentState = "EMPTY";
    this.patientId = null;
    this.updateVisuals();
  }

  /**
   * Break the bed
   */
  break(): void {
    this.isWorking = false;

    // If occupied, patient needs to be moved
    if (this.currentState === "OCCUPIED") {
      // This would trigger an emergency reassignment
    }

    this.updateVisuals();

    // Spark effect
    this.scene.tweens.add({
      targets: this,
      angle: 5,
      duration: 100,
      yoyo: true,
      repeat: 3,
    });
  }

  /**
   * Repair the bed
   */
  repair(): void {
    this.isWorking = true;
    this.updateVisuals();

    // Shine effect
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.5,
      duration: 200,
      yoyo: true,
    });
  }

  /**
   * Get bed data
   */
  getData(): BedData {
    return {
      id: this.bedId,
      number: this.bedNumber,
      state: this.currentState,
      patientId: this.patientId,
      position: { x: this.x, y: this.y },
      isWorking: this.isWorking,
    };
  }

  /**
   * Get bed state
   */
  getState(): BedState {
    return this.currentState;
  }

  /**
   * Get bed ID
   */
  getId(): string {
    return this.bedId;
  }

  /**
   * Get bed number
   */
  getNumber(): number {
    return this.bedNumber;
  }

  /**
   * Check if bed is available
   */
  isAvailable(): boolean {
    return this.currentState === "EMPTY" && this.isWorking;
  }

  /**
   * Check if bed is working
   */
  getIsWorking(): boolean {
    return this.isWorking;
  }

  /**
   * Get assigned patient ID
   */
  getPatientId(): string | null {
    return this.patientId;
  }

  /**
   * Set needs attention state
   */
  setNeedsAttention(needs: boolean): void {
    this.needsAttention = needs;
    this.updateVisuals();

    if (needs) {
      EventBus.emit("bed:needs_attention", {
        bedId: this.bedId,
        number: this.bedNumber,
      });
    }
  }

  /**
   * Get needs attention state
   */
  getNeedsAttention(): boolean {
    return this.needsAttention;
  }

  /**
   * Show highlight (when player is nearby)
   */
  showHighlight(show: boolean = true): void {
    if (!this.highlightGraphics) return;

    this.highlightGraphics.clear();

    if (show) {
      this.highlightGraphics.lineStyle(2, UI_CONFIG.COLORS.PRIMARY, 0.8);
      this.highlightGraphics.strokeRoundedRect(-28, -36, 56, 72, 4);
    }
  }

  /**
   * Check if bed can be interacted with
   */
  canInteract(): boolean {
    // Can interact if:
    // - Needs repair (broken)
    // - Has patient that needs attention
    // - Is empty and we're trying to assign patient
    return (
      !this.isWorking || this.needsAttention || this.currentState !== "EMPTY"
    );
  }

  /**
   * Get interaction label for InteractionManager
   */
  getInteractionLabel(): string {
    if (!this.isWorking) return `Repair Bed ${this.bedNumber}`;
    if (this.needsAttention) return `Attend Bed ${this.bedNumber}`;
    if (this.currentState === "OCCUPIED") return `Check Bed ${this.bedNumber}`;
    return `Bed ${this.bedNumber}`;
  }

  /**
   * Get collision rectangle for CollisionManager
   */
  getCollisionRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.x - this.collisionBounds.width / 2,
      y: this.y - this.collisionBounds.height / 2,
      width: this.collisionBounds.width,
      height: this.collisionBounds.height,
    };
  }

  /**
   * Get position
   */
  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /**
   * Destroy bed
   */
  destroy(fromScene?: boolean): void {
    if (this.needsAttentionIcon) {
      this.scene.tweens.killTweensOf(this.needsAttentionIcon);
    }
    this.highlightGraphics?.destroy();
    super.destroy(fromScene);
  }
}
