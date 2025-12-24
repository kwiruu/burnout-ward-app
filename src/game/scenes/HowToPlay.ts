import { Scene } from "phaser";
import { SCENES, UI_CONFIG, GAME_CONFIG } from "../utils/Constants";
import { Button } from "../ui/Button";

/**
 * How To Play Scene
 * Tutorial and controls explanation
 */
export class HowToPlay extends Scene {
  constructor() {
    super(SCENES.HOW_TO_PLAY);
  }

  create(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;

    // Background
    this.cameras.main.setBackgroundColor(UI_CONFIG.COLORS.SECONDARY);

    // Title
    this.add
      .text(centerX, 50, "HOW TO PLAY", {
        fontFamily: "Arial Black",
        fontSize: "48px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    // Content sections
    let yPos = 120;

    // Controls section
    yPos = this.createSection(centerX, yPos, "🎮 CONTROLS", [
      "WASD / Arrow Keys - Move around the ER",
      "E - Interact with patients, staff, equipment",
      "Hold E - Pick up / carry patients",
      "1-6 - Quick assign patient to bed number",
      "ESC - Pause game",
    ]);

    // Goal section
    yPos = this.createSection(centerX, yPos + 20, "🎯 GOAL", [
      "Survive the shift!",
      "Triage incoming patients and assign them to beds",
      "Keep the chaos meter below 100%",
      "Don't let too many patients die",
    ]);

    // Tips section
    yPos = this.createSection(centerX, yPos + 20, "💡 TIPS", [
      "• Critical patients (red) need immediate attention",
      "• Don't let staff get too tired - send them to break room",
      "• Fix broken equipment quickly to prevent cascading failures",
      "• Higher severity = less time, prioritize wisely!",
    ]);

    // Severity legend
    this.createSeverityLegend(centerX, yPos + 30);

    // Back button
    this.createBackButton();

    // Fade in
    this.cameras.main.fadeIn(300);
  }

  /**
   * Create a content section with title and bullet points
   */
  private createSection(
    x: number,
    y: number,
    title: string,
    lines: string[]
  ): number {
    // Section title
    this.add
      .text(x, y, title, {
        fontFamily: "Arial Black",
        fontSize: "28px",
        color: "#16c79a",
      })
      .setOrigin(0.5);

    y += 40;

    // Section content
    lines.forEach((line) => {
      this.add
        .text(x, y, line, {
          fontFamily: "Arial",
          fontSize: "18px",
          color: "#cccccc",
        })
        .setOrigin(0.5);
      y += 28;
    });

    return y;
  }

  /**
   * Create visual severity legend
   */
  private createSeverityLegend(x: number, y: number): void {
    this.add
      .text(x, y, "🏥 PATIENT SEVERITY", {
        fontFamily: "Arial Black",
        fontSize: "24px",
        color: "#16c79a",
      })
      .setOrigin(0.5);

    const severities = [
      { level: 1, color: 0x4ade80, name: "Minor" },
      { level: 2, color: 0xfbbf24, name: "Low" },
      { level: 3, color: 0xf97316, name: "Medium" },
      { level: 4, color: 0xef4444, name: "High" },
      { level: 5, color: 0x7c2d12, name: "Critical" },
    ];

    const startX = x - 200;
    const spacing = 100;

    severities.forEach((sev, index) => {
      const posX = startX + index * spacing;
      const posY = y + 50;

      // Color circle
      this.add.circle(posX, posY, 15, sev.color);

      // Level number
      this.add
        .text(posX, posY, `${sev.level}`, {
          fontFamily: "Arial Black",
          fontSize: "16px",
          color: "#ffffff",
        })
        .setOrigin(0.5);

      // Name
      this.add
        .text(posX, posY + 30, sev.name, {
          fontFamily: "Arial",
          fontSize: "14px",
          color: "#888888",
        })
        .setOrigin(0.5);
    });
  }

  /**
   * Create back button
   */
  private createBackButton(): void {
    new Button({
      scene: this,
      x: GAME_CONFIG.WIDTH / 2,
      y: GAME_CONFIG.HEIGHT - 60,
      text: "← BACK",
      width: 200,
      height: 50,
      style: "secondary",
      onClick: () => {
        this.cameras.main.fadeOut(300);
        this.cameras.main.once("camerafadeoutcomplete", () => {
          this.scene.start(SCENES.MAIN_MENU);
        });
      },
    });

    // Also allow ESC to go back
    this.input.keyboard?.on("keydown-ESC", () => {
      this.cameras.main.fadeOut(300);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start(SCENES.MAIN_MENU);
      });
    });
  }
}
