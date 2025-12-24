/**
 * Panel UI Component
 * Reusable container with background for menus and dialogs
 */

import { UI_CONFIG } from "../utils/Constants";

export interface PanelConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  backgroundColor?: number;
  borderColor?: number;
  borderWidth?: number;
  cornerRadius?: number;
  padding?: number;
  titleStyle?: Phaser.Types.GameObjects.Text.TextStyle;
}

export class Panel extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics;
  private border: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text | null = null;
  private contentContainer: Phaser.GameObjects.Container;

  private config: Required<
    Omit<PanelConfig, "scene" | "title" | "titleStyle">
  > & {
    title?: string;
    titleStyle?: Phaser.Types.GameObjects.Text.TextStyle;
  };

  constructor(config: PanelConfig) {
    super(config.scene, config.x, config.y);

    // Apply defaults
    this.config = {
      backgroundColor: UI_CONFIG.COLORS.SECONDARY,
      borderColor: UI_CONFIG.COLORS.PRIMARY,
      borderWidth: 2,
      cornerRadius: 15,
      padding: 20,
      ...config,
    };

    // Create components
    this.background = this.createBackground();
    this.border = this.createBorder();
    this.contentContainer = this.createContentContainer();

    // Optional title
    if (this.config.title) {
      this.titleText = this.createTitle();
    }

    // Add to scene
    config.scene.add.existing(this);
  }

  /**
   * Create panel background
   */
  private createBackground(): Phaser.GameObjects.Graphics {
    const bg = this.scene.add.graphics();
    bg.fillStyle(this.config.backgroundColor, 1);
    bg.fillRoundedRect(
      -this.config.width / 2,
      -this.config.height / 2,
      this.config.width,
      this.config.height,
      this.config.cornerRadius
    );
    this.add(bg);
    return bg;
  }

  /**
   * Create panel border
   */
  private createBorder(): Phaser.GameObjects.Graphics {
    const border = this.scene.add.graphics();
    border.lineStyle(this.config.borderWidth, this.config.borderColor, 1);
    border.strokeRoundedRect(
      -this.config.width / 2,
      -this.config.height / 2,
      this.config.width,
      this.config.height,
      this.config.cornerRadius
    );
    this.add(border);
    return border;
  }

  /**
   * Create content container
   */
  private createContentContainer(): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);
    this.add(container);
    return container;
  }

  /**
   * Create title text
   */
  private createTitle(): Phaser.GameObjects.Text {
    const defaultStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "Arial Black",
      fontSize: "28px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
    };

    const style = { ...defaultStyle, ...this.config.titleStyle };

    const text = this.scene.add
      .text(
        0,
        -this.config.height / 2 + this.config.padding + 10,
        this.config.title!,
        style
      )
      .setOrigin(0.5, 0);

    this.add(text);
    return text;
  }

  /**
   * Add content to the panel
   */
  addContent(gameObject: Phaser.GameObjects.GameObject): this {
    this.contentContainer.add(gameObject);
    return this;
  }

  /**
   * Clear all content from the panel
   */
  clearContent(): this {
    this.contentContainer.removeAll(true);
    return this;
  }

  /**
   * Set panel title
   */
  setTitle(title: string): this {
    if (this.titleText) {
      this.titleText.setText(title);
    } else {
      this.titleText = this.createTitle();
      this.config.title = title;
    }
    return this;
  }

  /**
   * Set panel background color
   */
  setBackgroundColor(color: number): this {
    this.config.backgroundColor = color;
    this.background.clear();
    this.background.fillStyle(color, 1);
    this.background.fillRoundedRect(
      -this.config.width / 2,
      -this.config.height / 2,
      this.config.width,
      this.config.height,
      this.config.cornerRadius
    );
    return this;
  }

  /**
   * Set panel border color
   */
  setBorderColor(color: number): this {
    this.config.borderColor = color;
    this.border.clear();
    this.border.lineStyle(this.config.borderWidth, color, 1);
    this.border.strokeRoundedRect(
      -this.config.width / 2,
      -this.config.height / 2,
      this.config.width,
      this.config.height,
      this.config.cornerRadius
    );
    return this;
  }

  /**
   * Show panel with animation
   */
  show(duration: number = 200): this {
    this.setVisible(true);
    this.setScale(0.8);
    this.setAlpha(0);

    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: duration,
      ease: "Back.easeOut",
    });

    return this;
  }

  /**
   * Hide panel with animation
   */
  hide(duration: number = 200, onComplete?: () => void): this {
    this.scene.tweens.add({
      targets: this,
      scaleX: 0.8,
      scaleY: 0.8,
      alpha: 0,
      duration: duration,
      ease: "Back.easeIn",
      onComplete: () => {
        this.setVisible(false);
        if (onComplete) onComplete();
      },
    });

    return this;
  }

  /**
   * Get content container for direct access
   */
  getContentContainer(): Phaser.GameObjects.Container {
    return this.contentContainer;
  }

  /**
   * Get panel dimensions
   */
  getDimensions(): { width: number; height: number; padding: number } {
    return {
      width: this.config.width,
      height: this.config.height,
      padding: this.config.padding,
    };
  }
}
