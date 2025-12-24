import { Scene } from "phaser";
import { SCENES, UI_CONFIG, GAME_CONFIG } from "../utils/Constants";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

interface ShiftStats {
  timeRemaining: number;
  chaosScore: number;
  patientsArrived: number;
  patientsSaved: number;
  patientsDied: number;
}

/**
 * Pause Scene
 * Overlay scene when game is paused
 */
export class Pause extends Scene {
  private confirmDialog: Phaser.GameObjects.Container | null = null;
  private shiftStats: ShiftStats = {
    timeRemaining: 0,
    chaosScore: 0,
    patientsArrived: 0,
    patientsSaved: 0,
    patientsDied: 0,
  };

  constructor() {
    super(SCENES.PAUSE);
  }

  init(data: { stats?: ShiftStats }): void {
    if (data?.stats) {
      this.shiftStats = data.stats;
    }
  }

  create(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;

    // Semi-transparent background
    const overlay = this.add.rectangle(
      centerX,
      centerY,
      GAME_CONFIG.WIDTH,
      GAME_CONFIG.HEIGHT,
      0x000000,
      0.7
    );

    // Pause panel using our new Panel component
    const _panel = new Panel({
      scene: this,
      x: centerX,
      y: centerY,
      width: 420,
      height: 480,
      title: "⏸️ PAUSED",
    });

    // Current shift stats
    this.createStatsDisplay(centerX, centerY - 130);

    // Buttons
    const buttonY = centerY + 20;
    const buttonSpacing = 60;

    new Button({
      scene: this,
      x: centerX,
      y: buttonY,
      text: "▶️ RESUME",
      width: 240,
      height: 50,
      style: "primary",
      onClick: () => this.resumeGame(),
    });

    new Button({
      scene: this,
      x: centerX,
      y: buttonY + buttonSpacing,
      text: "🔄 RESTART",
      width: 240,
      height: 50,
      style: "secondary",
      onClick: () => this.showRestartConfirm(),
    });

    new Button({
      scene: this,
      x: centerX,
      y: buttonY + buttonSpacing * 2,
      text: "⚙️ SETTINGS",
      width: 240,
      height: 50,
      style: "secondary",
      onClick: () => this.openSettings(),
    });

    new Button({
      scene: this,
      x: centerX,
      y: buttonY + buttonSpacing * 3,
      text: "🚪 QUIT",
      width: 240,
      height: 50,
      style: "danger",
      onClick: () => this.showQuitConfirm(),
    });

    // ESC to resume
    this.input.keyboard?.on("keydown-ESC", () => {
      if (!this.confirmDialog?.visible) {
        this.resumeGame();
      }
    });

    // Prevent clicks from going through
    overlay.setInteractive();
  }

  /**
   * Create current shift stats display
   */
  private createStatsDisplay(x: number, y: number): void {
    const timeMinutes = Math.floor(this.shiftStats.timeRemaining / 60);
    const timeSeconds = this.shiftStats.timeRemaining % 60;
    const timeStr = `${timeMinutes}:${timeSeconds.toString().padStart(2, "0")}`;

    // Stats title
    this.add
      .text(x, y, "📊 CURRENT SHIFT", {
        fontFamily: "Arial Black",
        fontSize: "18px",
        color: "#16c79a",
      })
      .setOrigin(0.5);

    // Stats grid
    const stats = [
      { label: "Time Left", value: timeStr, icon: "⏱️" },
      {
        label: "Chaos",
        value: `${Math.round(this.shiftStats.chaosScore)}%`,
        icon: "📈",
      },
      {
        label: "Patients",
        value: `${this.shiftStats.patientsArrived}`,
        icon: "👥",
      },
      {
        label: "Saved",
        value: `${this.shiftStats.patientsSaved}`,
        icon: "✅",
        color: "#4ade80",
      },
      {
        label: "Lost",
        value: `${this.shiftStats.patientsDied}`,
        icon: "💀",
        color: "#ef4444",
      },
    ];

    let statY = y + 30;
    stats.forEach((stat) => {
      this.add
        .text(x - 100, statY, `${stat.icon} ${stat.label}:`, {
          fontFamily: "Arial",
          fontSize: "16px",
          color: "#888888",
        })
        .setOrigin(0, 0.5);

      this.add
        .text(x + 100, statY, stat.value, {
          fontFamily: "Arial Black",
          fontSize: "16px",
          color: stat.color || "#ffffff",
        })
        .setOrigin(1, 0.5);

      statY += 25;
    });
  }

  /**
   * Show restart confirmation dialog
   */
  private showRestartConfirm(): void {
    this.showConfirmDialog(
      "🔄 RESTART SHIFT?",
      "All progress will be lost.\nAre you sure?",
      "RESTART",
      () => this.restartGame(),
      true
    );
  }

  /**
   * Show quit confirmation dialog
   */
  private showQuitConfirm(): void {
    this.showConfirmDialog(
      "🚪 QUIT TO MENU?",
      "All progress will be lost.\nAre you sure?",
      "QUIT",
      () => this.quitToMenu(),
      true
    );
  }

  /**
   * Show a generic confirm dialog
   */
  private showConfirmDialog(
    title: string,
    message: string,
    confirmText: string,
    onConfirm: () => void,
    dangerous: boolean = false
  ): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;

    // Create dialog container
    this.confirmDialog = this.add.container(0, 0);
    this.confirmDialog.setDepth(100);

    // Extra overlay
    const dialogOverlay = this.add.rectangle(
      centerX,
      centerY,
      GAME_CONFIG.WIDTH,
      GAME_CONFIG.HEIGHT,
      0x000000,
      0.5
    );
    dialogOverlay.setInteractive();
    this.confirmDialog.add(dialogOverlay);

    // Dialog panel
    const dialogPanel = this.add.graphics();
    dialogPanel.fillStyle(UI_CONFIG.COLORS.SECONDARY, 1);
    dialogPanel.fillRoundedRect(centerX - 180, centerY - 100, 360, 200, 15);
    dialogPanel.lineStyle(
      2,
      dangerous ? 0xef4444 : UI_CONFIG.COLORS.PRIMARY,
      1
    );
    dialogPanel.strokeRoundedRect(centerX - 180, centerY - 100, 360, 200, 15);
    this.confirmDialog.add(dialogPanel);

    // Title
    const titleText = this.add
      .text(centerX, centerY - 70, title, {
        fontFamily: "Arial Black",
        fontSize: "24px",
        color: dangerous ? "#ef4444" : "#ffffff",
      })
      .setOrigin(0.5);
    this.confirmDialog.add(titleText);

    // Message
    const messageText = this.add
      .text(centerX, centerY - 15, message, {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#cccccc",
        align: "center",
      })
      .setOrigin(0.5);
    this.confirmDialog.add(messageText);

    // Cancel button
    const cancelBtn = this.createDialogButton(
      centerX - 80,
      centerY + 55,
      "CANCEL",
      0x666666,
      () => this.closeConfirmDialog()
    );
    this.confirmDialog.add(cancelBtn);

    // Confirm button
    const confirmBtn = this.createDialogButton(
      centerX + 80,
      centerY + 55,
      confirmText,
      dangerous ? 0xef4444 : UI_CONFIG.COLORS.PRIMARY,
      () => {
        this.closeConfirmDialog();
        onConfirm();
      }
    );
    this.confirmDialog.add(confirmBtn);

    // Animate in
    this.confirmDialog.setAlpha(0);
    this.tweens.add({
      targets: this.confirmDialog,
      alpha: 1,
      duration: 150,
    });
  }

  /**
   * Create a simple dialog button
   */
  private createDialogButton(
    x: number,
    y: number,
    text: string,
    color: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-65, -20, 130, 40, 8);
    container.add(bg);

    const buttonText = this.add
      .text(0, 0, text, {
        fontFamily: "Arial Black",
        fontSize: "16px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    container.add(buttonText);

    const hitArea = this.add.rectangle(0, 0, 130, 40, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on("pointerover", () => container.setScale(1.05));
    hitArea.on("pointerout", () => container.setScale(1));
    hitArea.on("pointerup", onClick);

    return container;
  }

  /**
   * Close the confirm dialog
   */
  private closeConfirmDialog(): void {
    if (this.confirmDialog) {
      this.tweens.add({
        targets: this.confirmDialog,
        alpha: 0,
        duration: 100,
        onComplete: () => {
          this.confirmDialog?.destroy();
          this.confirmDialog = null;
        },
      });
    }
  }

  /**
   * Resume the game
   */
  private resumeGame(): void {
    this.scene.resume(SCENES.GAME);
    const gameScene = this.scene.get(SCENES.GAME) as Scene & {
      resumeGame?: () => void;
    };
    if (gameScene?.resumeGame) {
      gameScene.resumeGame();
    }
    this.scene.stop();
  }

  /**
   * Open settings (will need to return to pause after)
   */
  private openSettings(): void {
    // Store that we came from pause
    this.scene.start(SCENES.SETTINGS, { returnScene: SCENES.PAUSE });
    this.scene.stop(SCENES.GAME);
  }

  /**
   * Restart the current shift
   */
  private restartGame(): void {
    this.scene.stop(SCENES.GAME);
    this.scene.start(SCENES.GAME);
    this.scene.stop();
  }

  /**
   * Quit to main menu
   */
  private quitToMenu(): void {
    this.scene.stop(SCENES.GAME);
    this.scene.start(SCENES.MAIN_MENU);
    this.scene.stop();
  }
}
