/**
 * Button UI Component
 * Reusable button with hover/click effects and sound
 */

import { UI_CONFIG } from "../utils/Constants";
import { SaveManager } from "../utils/SaveManager";

export interface ButtonConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  text: string;
  width?: number;
  height?: number;
  onClick: () => void;
  style?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  soundKey?: string; // Optional custom sound key
  noSound?: boolean; // Disable sound for this button
}

export class Button extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics;
  private buttonText: Phaser.GameObjects.Text;
  private hitArea: Phaser.GameObjects.Rectangle;
  private config: ButtonConfig;
  private isDisabled: boolean;

  constructor(config: ButtonConfig) {
    super(config.scene, config.x, config.y);

    this.config = config;
    this.isDisabled = config.disabled || false;

    const width = config.width || UI_CONFIG.BUTTON.WIDTH;
    const height = config.height || UI_CONFIG.BUTTON.HEIGHT;

    // Background
    this.background = config.scene.add.graphics();
    this.drawBackground(this.getBackgroundColor());
    this.add(this.background);

    // Text
    this.buttonText = config.scene.add
      .text(0, 0, config.text, {
        fontFamily: "Arial Black",
        fontSize: "20px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.add(this.buttonText);

    // Hit area
    this.hitArea = config.scene.add.rectangle(0, 0, width, height, 0x000000, 0);
    if (!this.isDisabled) {
      this.hitArea.setInteractive({ useHandCursor: true });
      this.setupInteractions();
    }
    this.add(this.hitArea);

    // Add to scene
    config.scene.add.existing(this);

    // Apply disabled state
    if (this.isDisabled) {
      this.setAlpha(0.5);
    }
  }

  /**
   * Get background color based on style
   */
  private getBackgroundColor(): number {
    if (this.isDisabled) return 0x666666;

    switch (this.config.style) {
      case "danger":
        return UI_CONFIG.COLORS.DANGER;
      case "secondary":
        return 0x666666;
      case "primary":
      default:
        return UI_CONFIG.COLORS.PRIMARY;
    }
  }

  /**
   * Get hover color
   */
  private getHoverColor(): number {
    switch (this.config.style) {
      case "danger":
        return 0xff6b6b;
      case "secondary":
        return 0x888888;
      case "primary":
      default:
        return 0x1dd1a1;
    }
  }

  /**
   * Draw button background
   */
  private drawBackground(color: number): void {
    const width = this.config.width || UI_CONFIG.BUTTON.WIDTH;
    const height = this.config.height || UI_CONFIG.BUTTON.HEIGHT;
    const radius = UI_CONFIG.BUTTON.RADIUS;

    this.background.clear();
    this.background.fillStyle(color, 1);
    this.background.fillRoundedRect(
      -width / 2,
      -height / 2,
      width,
      height,
      radius
    );
  }

  /**
   * Set up mouse interactions
   */
  private setupInteractions(): void {
    this.hitArea.on("pointerover", () => {
      if (this.isDisabled) return;

      this.scene.tweens.add({
        targets: this,
        scaleX: UI_CONFIG.BUTTON.HOVER_SCALE,
        scaleY: UI_CONFIG.BUTTON.HOVER_SCALE,
        duration: 100,
      });
      this.drawBackground(this.getHoverColor());

      // Play hover sound if available
      this.playSound("ui_hover");
    });

    this.hitArea.on("pointerout", () => {
      if (this.isDisabled) return;

      this.scene.tweens.add({
        targets: this,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
      });
      this.drawBackground(this.getBackgroundColor());
    });

    this.hitArea.on("pointerdown", () => {
      if (this.isDisabled) return;
      this.setScale(0.95);
    });

    this.hitArea.on("pointerup", () => {
      if (this.isDisabled) return;
      this.setScale(UI_CONFIG.BUTTON.HOVER_SCALE);

      // Play click sound
      this.playSound(this.config.soundKey || "ui_click");

      this.config.onClick();
    });
  }

  /**
   * Play a sound effect if available
   */
  private playSound(key: string): void {
    if (this.config.noSound) return;

    const settings = SaveManager.getSettings();
    const volume = settings.sfxVolume / 100;

    // Check if sound exists before playing
    if (this.scene.sound.get(key) || this.scene.cache.audio.exists(key)) {
      this.scene.sound.play(key, { volume });
    }
  }

  /**
   * Enable the button
   */
  enable(): void {
    this.isDisabled = false;
    this.setAlpha(1);
    this.hitArea.setInteractive({ useHandCursor: true });
    this.drawBackground(this.getBackgroundColor());
  }

  /**
   * Disable the button
   */
  disable(): void {
    this.isDisabled = true;
    this.setAlpha(0.5);
    this.hitArea.disableInteractive();
    this.drawBackground(0x666666);
  }

  /**
   * Update button text
   */
  setText(text: string): void {
    this.buttonText.setText(text);
  }

  /**
   * Update button style
   */
  setStyle(style: "primary" | "secondary" | "danger"): void {
    this.config.style = style;
    this.drawBackground(this.getBackgroundColor());
  }

  /**
   * Check if button is disabled
   */
  getIsDisabled(): boolean {
    return this.isDisabled;
  }
}
