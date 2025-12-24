import { Scene } from "phaser";
import { SCENES, UI_CONFIG, GAME_CONFIG, Grade } from "../utils/Constants";
import { GameOverSceneData, GameStats } from "../types";
import { SaveManager } from "../utils/SaveManager";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

/**
 * Game Over Scene
 * Shows results after a shift ends
 */
export class GameOver extends Scene {
  private sceneData!: GameOverSceneData;

  constructor() {
    super(SCENES.GAME_OVER);
  }

  init(data: GameOverSceneData): void {
    this.sceneData = data || {
      won: true,
      stats: {
        patientsArrived: 0,
        patientsSaved: 0,
        patientsDied: 0,
        staffBurnouts: 0,
        equipmentRepairs: 0,
        peakChaos: 0,
        finalChaos: 0,
        grade: "C" as Grade,
      },
    };
  }

  create(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const { won, stats } = this.sceneData;

    // Background
    this.cameras.main.setBackgroundColor(UI_CONFIG.COLORS.SECONDARY);

    // Result header
    if (won) {
      this.createWinHeader(centerX);
    } else {
      this.createLoseHeader(centerX);
    }

    // Stats panel
    this.createStatsPanel(centerX, stats);

    // Grade display
    this.createGradeDisplay(centerX, stats.grade);

    // Buttons
    this.createButtons(centerX);

    // Update persistent stats
    SaveManager.updateStats(
      stats.patientsSaved,
      stats.patientsDied,
      stats.grade,
      0 // TODO: Track actual play time
    );

    // Fade in
    this.cameras.main.fadeIn(500);
  }

  /**
   * Create win header
   */
  private createWinHeader(centerX: number): void {
    this.add
      .text(centerX, 60, "✅ SHIFT COMPLETE!", {
        fontFamily: "Arial Black",
        fontSize: "48px",
        color: "#4ade80",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, 110, "You survived the shift!", {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#888888",
      })
      .setOrigin(0.5);
  }

  /**
   * Create lose header
   */
  private createLoseHeader(centerX: number): void {
    const title = this.add
      .text(centerX, 60, "❌ ER SHUTDOWN", {
        fontFamily: "Arial Black",
        fontSize: "48px",
        color: "#ef4444",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    // Shake effect
    this.tweens.add({
      targets: title,
      x: centerX + 5,
      duration: 50,
      yoyo: true,
      repeat: 5,
    });

    this.add
      .text(centerX, 110, "The ER has collapsed...", {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#888888",
      })
      .setOrigin(0.5);
  }

  /**
   * Create stats panel
   */
  private createStatsPanel(centerX: number, stats: GameStats): void {
    const panelY = 300;

    // Panel using component
    new Panel({
      scene: this,
      x: centerX,
      y: panelY,
      width: 400,
      height: 280,
      title: "📊 SHIFT REPORT",
    });

    // Stats list
    const statsList = [
      { label: "Patients Arrived", value: stats.patientsArrived, icon: "👥" },
      {
        label: "Patients Saved",
        value: stats.patientsSaved,
        icon: "✅",
        color: "#4ade80",
      },
      {
        label: "Patients Lost",
        value: stats.patientsDied,
        icon: "💀",
        color: "#ef4444",
      },
      { label: "Staff Burnouts", value: stats.staffBurnouts, icon: "😓" },
      {
        label: "Equipment Repaired",
        value: stats.equipmentRepairs,
        icon: "🔧",
      },
      { label: "Peak Chaos", value: `${stats.peakChaos}%`, icon: "📈" },
      { label: "Final Chaos", value: `${stats.finalChaos}%`, icon: "📊" },
    ];

    let y = panelY - 95;
    statsList.forEach((stat) => {
      // Icon and label
      this.add
        .text(centerX - 170, y, `${stat.icon} ${stat.label}`, {
          fontFamily: "Arial",
          fontSize: "18px",
          color: "#cccccc",
        })
        .setOrigin(0, 0.5);

      // Value
      this.add
        .text(centerX + 170, y, String(stat.value), {
          fontFamily: "Arial Black",
          fontSize: "18px",
          color: stat.color || "#ffffff",
        })
        .setOrigin(1, 0.5);

      y += 32;
    });
  }

  /**
   * Create grade display
   */
  private createGradeDisplay(centerX: number, grade: Grade): void {
    const gradeY = 500;

    // Grade background circle
    const gradeColors: Record<Grade, number> = {
      S: 0xffd700, // Gold
      A: 0x4ade80, // Green
      B: 0x3b82f6, // Blue
      C: 0xfbbf24, // Yellow
      D: 0xf97316, // Orange
      F: 0xef4444, // Red
    };

    const circle = this.add.graphics();
    circle.fillStyle(gradeColors[grade], 1);
    circle.fillCircle(centerX, gradeY, 50);

    // Grade letter
    const gradeText = this.add
      .text(centerX, gradeY, grade, {
        fontFamily: "Arial Black",
        fontSize: "56px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // Pop-in animation
    circle.setScale(0);
    gradeText.setScale(0);

    this.tweens.add({
      targets: [circle, gradeText],
      scaleX: 1,
      scaleY: 1,
      duration: 500,
      delay: 500,
      ease: "Back.easeOut",
    });

    // Grade label
    this.add
      .text(centerX, gradeY + 70, "GRADE", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#666666",
      })
      .setOrigin(0.5);
  }

  /**
   * Create navigation buttons
   */
  private createButtons(centerX: number): void {
    const buttonY = GAME_CONFIG.HEIGHT - 60;

    // Play Again button
    new Button({
      scene: this,
      x: centerX - 130,
      y: buttonY,
      text: "PLAY AGAIN",
      width: 200,
      height: 50,
      style: "primary",
      onClick: () => {
        this.cameras.main.fadeOut(300);
        this.cameras.main.once("camerafadeoutcomplete", () => {
          this.scene.start(SCENES.GAME);
        });
      },
    });

    // Main Menu button
    new Button({
      scene: this,
      x: centerX + 130,
      y: buttonY,
      text: "MAIN MENU",
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
  }
}
