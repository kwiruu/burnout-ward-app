/**
 * Slider UI Component
 * Reusable slider for volume controls and other values
 */

import { UI_CONFIG } from "../utils/Constants";

export interface SliderConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width?: number;
  min?: number;
  max?: number;
  value?: number;
  label?: string;
  showValue?: boolean;
  onChange?: (value: number) => void;
}

export class Slider extends Phaser.GameObjects.Container {
  private track: Phaser.GameObjects.Graphics;
  private fill: Phaser.GameObjects.Graphics;
  private handle: Phaser.GameObjects.Arc;
  private valueText: Phaser.GameObjects.Text | null = null;
  private _labelText: Phaser.GameObjects.Text | null = null;

  private config: SliderConfig;
  private sliderValue: number;
  private _isDragging: boolean = false;
  private trackWidth: number;
  private trackHeight: number = 8;

  constructor(config: SliderConfig) {
    super(config.scene, config.x, config.y);

    this.config = {
      width: 200,
      min: 0,
      max: 100,
      value: 50,
      showValue: true,
      ...config,
    };

    this.trackWidth = this.config.width!;
    this.sliderValue = this.config.value!;

    // Create components
    this.track = this.createTrack();
    this.fill = this.createFill();
    this.handle = this.createHandle();

    // Optional label
    if (this.config.label) {
      this._labelText = this.createLabel();
    }

    // Optional value display
    if (this.config.showValue) {
      this.valueText = this.createValueText();
    }

    // Set up interactions
    this.setupInteractions();

    // Add to scene
    config.scene.add.existing(this);

    // Initial update
    this.updateSlider();
  }

  /**
   * Create the track background
   */
  private createTrack(): Phaser.GameObjects.Graphics {
    const track = this.scene.add.graphics();
    track.fillStyle(0x333333, 1);
    track.fillRoundedRect(
      -this.trackWidth / 2,
      -this.trackHeight / 2,
      this.trackWidth,
      this.trackHeight,
      4
    );
    this.add(track);
    return track;
  }

  /**
   * Create the filled portion
   */
  private createFill(): Phaser.GameObjects.Graphics {
    const fill = this.scene.add.graphics();
    this.add(fill);
    return fill;
  }

  /**
   * Create the draggable handle
   */
  private createHandle(): Phaser.GameObjects.Arc {
    const handle = this.scene.add.circle(0, 0, 12, 0xffffff);
    handle.setStrokeStyle(2, UI_CONFIG.COLORS.PRIMARY);
    handle.setInteractive({ useHandCursor: true, draggable: true });
    this.add(handle);
    return handle;
  }

  /**
   * Create label text
   */
  private createLabel(): Phaser.GameObjects.Text {
    const label = this.scene.add
      .text(-this.trackWidth / 2 - 20, 0, this.config.label!, {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
      })
      .setOrigin(1, 0.5);
    this.add(label);
    return label;
  }

  /**
   * Create value display text
   */
  private createValueText(): Phaser.GameObjects.Text {
    const text = this.scene.add
      .text(this.trackWidth / 2 + 20, 0, `${this.sliderValue}%`, {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#888888",
      })
      .setOrigin(0, 0.5);
    this.add(text);
    return text;
  }

  /**
   * Set up drag interactions
   */
  private setupInteractions(): void {
    // Handle drag start
    this.handle.on("dragstart", () => {
      this._isDragging = true;
      this.handle.setScale(1.2);
    });

    // Handle drag
    this.handle.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number) => {
      const minX = -this.trackWidth / 2;
      const maxX = this.trackWidth / 2;
      const clampedX = Phaser.Math.Clamp(dragX, minX, maxX);

      // Calculate new value
      const percentage = (clampedX - minX) / this.trackWidth;
      const range = this.config.max! - this.config.min!;
      const newValue = Math.round(this.config.min! + percentage * range);

      this.setValue(newValue);
    });

    // Handle drag end
    this.handle.on("dragend", () => {
      this._isDragging = false;
      this.handle.setScale(1);
    });

    // Click on track to set value
    const trackHitArea = this.scene.add.rectangle(
      0,
      0,
      this.trackWidth,
      30,
      0x000000,
      0
    );
    trackHitArea.setInteractive({ useHandCursor: true });
    this.add(trackHitArea);

    trackHitArea.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const localX = pointer.x - this.x;
      const minX = -this.trackWidth / 2;
      const clampedX = Phaser.Math.Clamp(localX, minX, this.trackWidth / 2);

      const percentage = (clampedX - minX) / this.trackWidth;
      const range = this.config.max! - this.config.min!;
      const newValue = Math.round(this.config.min! + percentage * range);

      this.setValue(newValue);
    });

    // Move track hit area below handle
    this.sendToBack(trackHitArea);
    this.sendToBack(this.track);
  }

  /**
   * Update slider visuals
   */
  private updateSlider(): void {
    const percentage =
      (this.sliderValue - this.config.min!) /
      (this.config.max! - this.config.min!);
    const fillWidth = this.trackWidth * percentage;
    const handleX = -this.trackWidth / 2 + fillWidth;

    // Update fill
    this.fill.clear();
    this.fill.fillStyle(UI_CONFIG.COLORS.PRIMARY, 1);
    this.fill.fillRoundedRect(
      -this.trackWidth / 2,
      -this.trackHeight / 2,
      fillWidth,
      this.trackHeight,
      4
    );

    // Update handle position
    this.handle.x = handleX;

    // Update value text
    if (this.valueText) {
      this.valueText.setText(`${this.sliderValue}%`);
    }
  }

  /**
   * Set slider value
   */
  setValue(value: number): void {
    const clampedValue = Phaser.Math.Clamp(
      value,
      this.config.min!,
      this.config.max!
    );

    if (clampedValue !== this.sliderValue) {
      this.sliderValue = clampedValue;
      this.updateSlider();

      if (this.config.onChange) {
        this.config.onChange(this.sliderValue);
      }
    }
  }

  /**
   * Get current value
   */
  getValue(): number {
    return this.sliderValue;
  }

  /**
   * Enable the slider
   */
  enable(): void {
    this.handle.setInteractive({ useHandCursor: true, draggable: true });
    this.setAlpha(1);
  }

  /**
   * Disable the slider
   */
  disable(): void {
    this.handle.disableInteractive();
    this.setAlpha(0.5);
  }
}
