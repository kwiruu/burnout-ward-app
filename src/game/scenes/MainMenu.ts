import { Scene, GameObjects } from "phaser";
import { SCENES, UI_CONFIG, GAME_CONFIG } from "../utils/Constants";
import { SaveManager } from "../utils/SaveManager";
import { Button } from "../ui/Button";

/**
 * Main Menu Scene
 * Title screen with game options
 */
export class MainMenu extends Scene {
  private buttons: (GameObjects.Container | Button)[] = [];

  constructor() {
    super(SCENES.MAIN_MENU);
  }

  create(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;

    // Background
    this.cameras.main.setBackgroundColor(UI_CONFIG.COLORS.SECONDARY);

    // Create animated background pattern
    this.createBackgroundPattern();

    // Game title
    const titleText = this.add
      .text(centerX, 120, "Title", {
        fontFamily: "Arial Black",
        fontSize: "72px",
        color: "#ff4757",
        stroke: "#000000",
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(centerX, 180, "ER SHIFT", {
        fontFamily: "Arial Black",
        fontSize: "36px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // Pulsing animation on title
    this.tweens.add({
      targets: titleText,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Hospital icon (cross)
    this.createHospitalIcon(centerX, 280);

    // Menu buttons
    const buttonStartY = 380;
    const buttonSpacing = 70;

    // Use our proper Button component
    const startBtn = new Button({
      scene: this,
      x: centerX,
      y: buttonStartY,
      text: "🏥 START SHIFT",
      width: 280,
      height: 55,
      style: "primary",
      onClick: () => this.startGame(),
    });
    this.buttons.push(startBtn);

    const howToPlayBtn = new Button({
      scene: this,
      x: centerX,
      y: buttonStartY + buttonSpacing,
      text: "📖 HOW TO PLAY",
      width: 280,
      height: 55,
      style: "secondary",
      onClick: () => {
        this.cameras.main.fadeOut(300);
        this.cameras.main.once("camerafadeoutcomplete", () => {
          this.scene.start(SCENES.HOW_TO_PLAY);
        });
      },
    });
    this.buttons.push(howToPlayBtn);

    const settingsBtn = new Button({
      scene: this,
      x: centerX,
      y: buttonStartY + buttonSpacing * 2,
      text: "⚙️ SETTINGS",
      width: 280,
      height: 55,
      style: "secondary",
      onClick: () => {
        this.cameras.main.fadeOut(300);
        this.cameras.main.once("camerafadeoutcomplete", () => {
          this.scene.start(SCENES.SETTINGS);
        });
      },
    });
    this.buttons.push(settingsBtn);

    // Debug button (small, bottom-right)
    const debugBtn = new Button({
      scene: this,
      x: GAME_CONFIG.WIDTH - 80,
      y: GAME_CONFIG.HEIGHT - 60,
      text: "🎬 Anim Debug",
      width: 140,
      height: 35,
      style: "secondary",
      onClick: () => {
        this.scene.start(SCENES.ANIMATION_DEBUG);
      },
    });
    this.buttons.push(debugBtn);

    // Version number
    this.add
      .text(GAME_CONFIG.WIDTH - 20, GAME_CONFIG.HEIGHT - 20, "v0.1.0 - MVP", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#666666",
      })
      .setOrigin(1, 1);

    // Credits hint
    this.add
      .text(20, GAME_CONFIG.HEIGHT - 20, "🎄 Made with ❤️ for the holidays", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#666666",
      })
      .setOrigin(0, 1);

    // Display current settings
    const settings = SaveManager.getSettings();
    this.add.text(20, 20, `Difficulty: ${settings.difficulty}`, {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#888888",
    });
  }

  /**
   * Create a decorative hospital icon
   */
  private createHospitalIcon(x: number, y: number): void {
    const graphics = this.add.graphics();

    // White cross
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(x - 8, y - 24, 16, 48);
    graphics.fillRect(x - 24, y - 8, 48, 16);

    // Red background circle
    const circle = this.add.graphics();
    circle.fillStyle(0xff4757, 0.3);
    circle.fillCircle(x, y, 40);

    // Pulse animation
    this.tweens.add({
      targets: circle,
      alpha: 0.1,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /**
   * Create animated background pattern
   */
  private createBackgroundPattern(): void {
    // Create subtle grid pattern
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x2a2a4e, 0.3);

    // Vertical lines
    for (let x = 0; x < GAME_CONFIG.WIDTH; x += 50) {
      graphics.lineBetween(x, 0, x, GAME_CONFIG.HEIGHT);
    }

    // Horizontal lines
    for (let y = 0; y < GAME_CONFIG.HEIGHT; y += 50) {
      graphics.lineBetween(0, y, GAME_CONFIG.WIDTH, y);
    }

    // Add some floating particles
    for (let i = 0; i < 20; i++) {
      const particle = this.add.circle(
        Phaser.Math.Between(0, GAME_CONFIG.WIDTH),
        Phaser.Math.Between(0, GAME_CONFIG.HEIGHT),
        Phaser.Math.Between(2, 5),
        0x16c79a,
        0.2
      );

      this.tweens.add({
        targets: particle,
        y: particle.y - 100,
        alpha: 0,
        duration: Phaser.Math.Between(3000, 6000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 3000),
      });
    }
  }

  /**
   * Create a menu button
   */
  private createButton(
    x: number,
    y: number,
    text: string,
    onClick: () => void
  ): void {
    const container = this.add.container(x, y);

    // Button background
    const bg = this.add.graphics();
    bg.fillStyle(UI_CONFIG.COLORS.PRIMARY, 1);
    bg.fillRoundedRect(-125, -25, 250, 50, 10);
    container.add(bg);

    // Button text
    const buttonText = this.add
      .text(0, 0, text, {
        fontFamily: "Arial Black",
        fontSize: "24px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    container.add(buttonText);

    // Make interactive
    const hitArea = this.add.rectangle(0, 0, 250, 50, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    container.add(hitArea);

    // Hover effects
    hitArea.on("pointerover", () => {
      this.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
      });
      bg.clear();
      bg.fillStyle(0x1dd1a1, 1);
      bg.fillRoundedRect(-125, -25, 250, 50, 10);
    });

    hitArea.on("pointerout", () => {
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
      });
      bg.clear();
      bg.fillStyle(UI_CONFIG.COLORS.PRIMARY, 1);
      bg.fillRoundedRect(-125, -25, 250, 50, 10);
    });

    hitArea.on("pointerdown", () => {
      container.setScale(0.95);
    });

    hitArea.on("pointerup", () => {
      container.setScale(1.05);
      onClick();
    });

    this.buttons.push(container);
  }

  /**
   * Start the game with current settings
   */
  private startGame(): void {
    const settings = SaveManager.getSettings();

    // Fade out transition
    this.cameras.main.fadeOut(500, 0, 0, 0);

    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start(SCENES.GAME, {
        difficulty: settings.difficulty,
        shiftDuration: settings.shiftDuration,
      });
    });
  }
}
