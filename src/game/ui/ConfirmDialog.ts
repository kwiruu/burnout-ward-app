/**
 * ConfirmDialog UI Component
 * Modal dialog for confirmation prompts
 */

import { GAME_CONFIG } from "../utils/Constants";
import { Panel } from "./Panel";
import { Button } from "./Button";

export interface ConfirmDialogConfig {
  scene: Phaser.Scene;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  dangerous?: boolean;
}

export class ConfirmDialog extends Phaser.GameObjects.Container {
  private overlay: Phaser.GameObjects.Rectangle;
  private panel: Panel;
  private _confirmButton: Button;
  private _cancelButton: Button;
  private isOpen: boolean = false;

  constructor(config: ConfirmDialogConfig) {
    super(config.scene, 0, 0);

    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;

    // Dark overlay
    this.overlay = config.scene.add.rectangle(
      centerX,
      centerY,
      GAME_CONFIG.WIDTH,
      GAME_CONFIG.HEIGHT,
      0x000000,
      0.7
    );
    this.overlay.setInteractive(); // Block clicks behind
    this.add(this.overlay);

    // Panel
    this.panel = new Panel({
      scene: config.scene,
      x: centerX,
      y: centerY,
      width: 400,
      height: 220,
      title: config.title,
    });
    this.add(this.panel);

    // Message text
    const message = config.scene.add
      .text(centerX, centerY - 20, config.message, {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#cccccc",
        align: "center",
        wordWrap: { width: 340 },
      })
      .setOrigin(0.5);
    this.add(message);

    // Cancel button
    this._cancelButton = new Button({
      scene: config.scene,
      x: centerX - 90,
      y: centerY + 60,
      text: config.cancelText || "CANCEL",
      width: 150,
      height: 45,
      style: "secondary",
      onClick: () => {
        this.close();
        if (config.onCancel) config.onCancel();
      },
    });

    // Confirm button
    this._confirmButton = new Button({
      scene: config.scene,
      x: centerX + 90,
      y: centerY + 60,
      text: config.confirmText || "CONFIRM",
      width: 150,
      height: 45,
      style: config.dangerous ? "danger" : "primary",
      onClick: () => {
        this.close();
        config.onConfirm();
      },
    });

    // Add to scene
    config.scene.add.existing(this);

    // Start hidden
    this.setVisible(false);
    this.setDepth(1000);
  }

  /**
   * Open the dialog
   */
  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;

    this.setVisible(true);
    this.setAlpha(0);
    this.panel.setScale(0.8);

    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 200,
    });

    this.scene.tweens.add({
      targets: this.panel,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: "Back.easeOut",
    });
  }

  /**
   * Close the dialog
   */
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 150,
      onComplete: () => {
        this.setVisible(false);
      },
    });

    this.scene.tweens.add({
      targets: this.panel,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: 150,
    });
  }

  /**
   * Check if dialog is open
   */
  getIsOpen(): boolean {
    return this.isOpen;
  }
}
