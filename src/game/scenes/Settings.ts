import { Scene } from "phaser";
import {
  SCENES,
  UI_CONFIG,
  GAME_CONFIG,
  SHIFT_CONFIG,
  DIFFICULTY,
  DifficultyLevel,
} from "../utils/Constants";
import { SaveManager } from "../utils/SaveManager";
import { Button } from "../ui/Button";
import { Slider } from "../ui/Slider";
import { Panel } from "../ui/Panel";

/**
 * Settings Scene
 * Game options and configuration
 */
export class Settings extends Scene {
  private selectedDifficulty: DifficultyLevel = "NORMAL";
  private selectedDuration: number = SHIFT_CONFIG.DEFAULT;
  private difficultyButtons: Map<DifficultyLevel, Button> = new Map();
  private durationButtons: Map<number, Button> = new Map();
  private diffDescription!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.SETTINGS);
  }

  create(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;

    // Load current settings
    const settings = SaveManager.getSettings();
    this.selectedDifficulty = settings.difficulty;
    this.selectedDuration = settings.shiftDuration;

    // Background
    this.cameras.main.setBackgroundColor(UI_CONFIG.COLORS.SECONDARY);

    // Title
    this.add
      .text(centerX, 50, "⚙️ SETTINGS", {
        fontFamily: "Arial Black",
        fontSize: "48px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    let yPos = 130;

    // Volume sliders
    yPos = this.createVolumeSection(centerX, yPos, settings);

    // Shift duration
    yPos = this.createDurationSection(centerX, yPos + 40);

    // Difficulty
    yPos = this.createDifficultySection(centerX, yPos + 40);

    // Buttons
    this.createBottomButtons();

    // Fade in
    this.cameras.main.fadeIn(300);
  }

  /**
   * Create volume sliders section
   */
  private createVolumeSection(
    x: number,
    y: number,
    settings: ReturnType<typeof SaveManager.getSettings>
  ): number {
    // Audio panel
    new Panel({
      scene: this,
      x,
      y: y + 60,
      width: 450,
      height: 150,
      title: "🔊 AUDIO",
    });

    y += 40;

    // Music volume slider
    new Slider({
      scene: this,
      x: x + 40,
      y,
      width: 200,
      min: 0,
      max: 100,
      value: settings.musicVolume,
      label: "Music",
      showValue: true,
      onChange: (value) => {
        SaveManager.setMusicVolume(value);
      },
    });

    y += 60;

    // SFX volume slider
    new Slider({
      scene: this,
      x: x + 40,
      y,
      width: 200,
      min: 0,
      max: 100,
      value: settings.sfxVolume,
      label: "SFX",
      showValue: true,
      onChange: (value) => {
        SaveManager.setSfxVolume(value);
      },
    });

    return y + 20;
  }

  /**
   * Create shift duration section
   */
  private createDurationSection(x: number, y: number): number {
    // Duration panel
    new Panel({
      scene: this,
      x,
      y: y + 40,
      width: 450,
      height: 100,
      title: "⏱️ SHIFT DURATION",
    });

    y += 40;

    const durations = [
      { value: SHIFT_CONFIG.SHORT, label: "5 min" },
      { value: SHIFT_CONFIG.NORMAL, label: "10 min" },
      { value: SHIFT_CONFIG.LONG, label: "15 min" },
    ];

    const spacing = 140;
    const startX = x - spacing;

    durations.forEach((dur, index) => {
      const btn = new Button({
        scene: this,
        x: startX + index * spacing,
        y,
        text: dur.label,
        width: 110,
        height: 40,
        style: dur.value === this.selectedDuration ? "primary" : "secondary",
        onClick: () => {
          this.selectedDuration = dur.value;
          SaveManager.setShiftDuration(dur.value);
          this.updateDurationButtons();
        },
      });
      this.durationButtons.set(dur.value, btn);
    });

    return y + 30;
  }

  /**
   * Create difficulty section
   */
  private createDifficultySection(x: number, y: number): number {
    // Difficulty panel
    new Panel({
      scene: this,
      x,
      y: y + 60,
      width: 450,
      height: 140,
      title: "🎮 DIFFICULTY",
    });

    y += 40;

    const difficulties: DifficultyLevel[] = ["EASY", "NORMAL", "HARD"];
    const spacing = 140;
    const startX = x - spacing;

    difficulties.forEach((diff, index) => {
      const btn = new Button({
        scene: this,
        x: startX + index * spacing,
        y,
        text: DIFFICULTY[diff].name,
        width: 110,
        height: 40,
        style: diff === this.selectedDifficulty ? "primary" : "secondary",
        onClick: () => {
          this.selectedDifficulty = diff;
          SaveManager.setDifficulty(diff);
          this.updateDifficultyButtons();
        },
      });
      this.difficultyButtons.set(diff, btn);
    });

    // Difficulty description
    y += 55;
    this.diffDescription = this.add
      .text(x, y, this.getDifficultyDescription(this.selectedDifficulty), {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#888888",
        align: "center",
      })
      .setOrigin(0.5);

    return y + 40;
  }

  /**
   * Get difficulty description text
   */
  private getDifficultyDescription(diff: DifficultyLevel): string {
    const settings = DIFFICULTY[diff];
    const deathText = settings.deathThreshold <= 1 ? "death" : "deaths";
    return `Max ${settings.deathThreshold} ${deathText} allowed • ${Math.round(
      (1 - settings.patientTimerMultiplier) * -100
    )}% patient time`;
  }

  /**
   * Update difficulty button visuals
   */
  private updateDifficultyButtons(): void {
    this.difficultyButtons.forEach((btn, diff) => {
      const selected = diff === this.selectedDifficulty;
      btn.setStyle(selected ? "primary" : "secondary");
    });

    // Update description
    if (this.diffDescription) {
      this.diffDescription.setText(
        this.getDifficultyDescription(this.selectedDifficulty)
      );
    }
  }

  /**
   * Update duration button visuals
   */
  private updateDurationButtons(): void {
    this.durationButtons.forEach((btn, dur) => {
      const selected = dur === this.selectedDuration;
      btn.setStyle(selected ? "primary" : "secondary");
    });
  }

  /**
   * Create bottom navigation buttons
   */
  private createBottomButtons(): void {
    // Back button
    new Button({
      scene: this,
      x: GAME_CONFIG.WIDTH / 2 - 120,
      y: GAME_CONFIG.HEIGHT - 60,
      text: "← BACK",
      width: 180,
      height: 50,
      style: "secondary",
      onClick: () => {
        this.cameras.main.fadeOut(300);
        this.cameras.main.once("camerafadeoutcomplete", () => {
          this.scene.start(SCENES.MAIN_MENU);
        });
      },
    });

    // Reset button
    new Button({
      scene: this,
      x: GAME_CONFIG.WIDTH / 2 + 120,
      y: GAME_CONFIG.HEIGHT - 60,
      text: "RESET",
      width: 180,
      height: 50,
      style: "danger",
      onClick: () => {
        SaveManager.resetSettings();
        this.scene.restart();
      },
    });

    // ESC to go back
    this.input.keyboard?.on("keydown-ESC", () => {
      this.cameras.main.fadeOut(300);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start(SCENES.MAIN_MENU);
      });
    });
  }
}
