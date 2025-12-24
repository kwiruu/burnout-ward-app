/**
 * Equipment Entity (Base Class)
 *
 * Base class for all equipment that can break and be repaired.
 * Extends this for specific equipment types (monitors, defibrillators, etc.)
 */

import { EquipmentState, EquipmentType } from "../types";
import { UI_CONFIG } from "../utils/Constants";
import EventBus from "../utils/EventBus";

export interface EquipmentConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  id: string;
  type: EquipmentType;
  repairTime?: number; // Time in seconds to repair
}

export class Equipment extends Phaser.GameObjects.Container {
  protected equipmentId: string;
  protected equipmentType: EquipmentType;
  protected currentState: EquipmentState;
  protected repairProgress: number = 0;
  protected repairTime: number;
  protected isBeingRepaired: boolean = false;

  // Visual components
  protected sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
  protected statusIndicator: Phaser.GameObjects.Arc;
  protected repairBar: Phaser.GameObjects.Graphics | null = null;
  protected warningIcon: Phaser.GameObjects.Text | null = null;

  constructor(config: EquipmentConfig) {
    super(config.scene, config.x, config.y);

    this.equipmentId = config.id;
    this.equipmentType = config.type;
    this.currentState = "WORKING";
    this.repairTime = config.repairTime || 5; // 5 seconds default

    // Create visuals
    this.createVisuals();

    // Add to scene
    config.scene.add.existing(this);
    this.setDepth(20);
  }

  /**
   * Create equipment visuals (override in subclasses)
   */
  protected createVisuals(): void {
    // Default equipment sprite (rectangle)
    this.sprite = this.scene.add.rectangle(0, 0, 40, 40, 0x4a4a6a);
    this.add(this.sprite);

    // Status indicator
    this.statusIndicator = this.scene.add.circle(20, -20, 6, 0x4ade80);
    this.statusIndicator.setVisible(false);
    this.add(this.statusIndicator);

    // Warning icon (hidden by default)
    this.warningIcon = this.scene.add.text(0, -30, "⚠️", {
      fontSize: "20px",
    });
    this.warningIcon.setOrigin(0.5);
    this.warningIcon.setVisible(false);
    this.add(this.warningIcon);
  }

  /**
   * Update equipment state visuals
   */
  protected updateVisuals(): void {
    switch (this.currentState) {
      case "WORKING":
        if ("clearTint" in this.sprite) {
          (this.sprite as Phaser.GameObjects.Sprite).clearTint();
        }
        this.statusIndicator.setFillStyle(0x4ade80);
        this.statusIndicator.setVisible(false);
        this.warningIcon?.setVisible(false);
        break;

      case "BROKEN":
        (this.sprite as Phaser.GameObjects.Rectangle).setFillStyle(0x444444);
        this.statusIndicator.setFillStyle(0xef4444);
        this.statusIndicator.setVisible(true);
        this.warningIcon?.setVisible(true);

        // Flash warning
        if (this.warningIcon) {
          this.scene.tweens.add({
            targets: this.warningIcon,
            alpha: 0.3,
            duration: 500,
            yoyo: true,
            repeat: -1,
          });
        }
        break;
    }
  }

  /**
   * Break the equipment
   */
  break(): void {
    if (this.currentState === "BROKEN") return;

    this.currentState = "BROKEN";
    this.repairProgress = 0;
    this.updateVisuals();

    EventBus.emit("equipment:broken", {
      id: this.equipmentId,
      type: this.equipmentType,
    });
  }

  /**
   * Start repairing the equipment
   */
  startRepair(): boolean {
    if (this.currentState !== "BROKEN") return false;
    if (this.isBeingRepaired) return false;

    this.isBeingRepaired = true;
    this.showRepairBar();

    EventBus.emit("equipment:repair_start", {
      id: this.equipmentId,
      type: this.equipmentType,
    });

    return true;
  }

  /**
   * Continue repair (call each frame while repairing)
   */
  updateRepair(delta: number): boolean {
    if (!this.isBeingRepaired) return false;

    this.repairProgress += delta / 1000; // Convert to seconds
    this.updateRepairBar();

    if (this.repairProgress >= this.repairTime) {
      this.completeRepair();
      return true;
    }

    return false;
  }

  /**
   * Cancel repair in progress
   */
  cancelRepair(): void {
    if (!this.isBeingRepaired) return;

    this.isBeingRepaired = false;
    this.hideRepairBar();

    EventBus.emit("equipment:repair_cancel", {
      id: this.equipmentId,
      type: this.equipmentType,
      progress: this.repairProgress,
    });
  }

  /**
   * Complete the repair
   */
  private completeRepair(): void {
    this.isBeingRepaired = false;
    this.repairProgress = 0;
    this.currentState = "WORKING";
    this.hideRepairBar();
    this.updateVisuals();

    EventBus.emit("equipment:repaired", {
      id: this.equipmentId,
      type: this.equipmentType,
    });

    // Stop any warning animations
    if (this.warningIcon) {
      this.scene.tweens.killTweensOf(this.warningIcon);
      this.warningIcon.setAlpha(1);
    }
  }

  /**
   * Show repair progress bar
   */
  private showRepairBar(): void {
    if (this.repairBar) return;

    this.repairBar = this.scene.add.graphics();
    this.add(this.repairBar);
    this.updateRepairBar();
  }

  /**
   * Update repair progress bar
   */
  private updateRepairBar(): void {
    if (!this.repairBar) return;

    this.repairBar.clear();

    const barWidth = 40;
    const barHeight = 6;
    const progress = this.repairProgress / this.repairTime;

    // Background
    this.repairBar.fillStyle(0x333333, 1);
    this.repairBar.fillRoundedRect(-barWidth / 2, 30, barWidth, barHeight, 2);

    // Fill
    this.repairBar.fillStyle(UI_CONFIG.COLORS.PRIMARY, 1);
    this.repairBar.fillRoundedRect(
      -barWidth / 2,
      30,
      barWidth * progress,
      barHeight,
      2
    );
  }

  /**
   * Hide repair progress bar
   */
  private hideRepairBar(): void {
    this.repairBar?.destroy();
    this.repairBar = null;
  }

  /**
   * Get equipment ID
   */
  getId(): string {
    return this.equipmentId;
  }

  /**
   * Get equipment type
   */
  getType(): EquipmentType {
    return this.equipmentType;
  }

  /**
   * Get current state
   */
  getState(): EquipmentState {
    return this.currentState;
  }

  /**
   * Check if working
   */
  isWorking(): boolean {
    return this.currentState === "WORKING";
  }

  /**
   * Check if broken
   */
  isBroken(): boolean {
    return this.currentState === "BROKEN";
  }

  /**
   * Get repair progress (0-1)
   */
  getRepairProgress(): number {
    return this.repairProgress / this.repairTime;
  }

  /**
   * Check if being repaired
   */
  getIsBeingRepaired(): boolean {
    return this.isBeingRepaired;
  }

  /**
   * Check if can interact (for InteractionManager)
   */
  canInteract(): boolean {
    return this.currentState === "BROKEN" && !this.isBeingRepaired;
  }

  /**
   * Get position
   */
  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /**
   * Destroy equipment
   */
  destroy(fromScene?: boolean): void {
    this.repairBar?.destroy();
    super.destroy(fromScene);
  }
}
