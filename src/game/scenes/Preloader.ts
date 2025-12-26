import { Scene } from "phaser";
import { SCENES, UI_CONFIG, GAME_CONFIG } from "../utils/Constants";
import {
  SPRITES,
  registerAnimations,
  addCustomFramesToTexture,
} from "../config/SpriteConfigs";

/**
 * Preloader Scene
 * Loads all game assets and shows loading progress
 */
export class Preloader extends Scene {
  private loadingBar!: Phaser.GameObjects.Graphics;
  private progressBar!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.PRELOADER);
  }

  init(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;

    // Background
    this.cameras.main.setBackgroundColor(UI_CONFIG.COLORS.SECONDARY);

    // Game title
    this.add
      .text(centerX, centerY - 100, "Title", {
        fontFamily: "Arial Black",
        fontSize: "64px",
        color: "#ff4757",
        stroke: "#000000",
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, centerY - 40, "ER SHIFT", {
        fontFamily: "Arial Black",
        fontSize: "32px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // Loading bar background
    this.loadingBar = this.add.graphics();
    this.loadingBar.fillStyle(0x222222, 1);
    this.loadingBar.fillRoundedRect(centerX - 200, centerY + 50, 400, 30, 10);

    // Progress bar
    this.progressBar = this.add.graphics();

    // Loading text
    this.loadingText = this.add
      .text(centerX, centerY + 100, "Loading...", {
        fontFamily: "Arial",
        fontSize: "20px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // Progress event
    this.load.on("progress", (value: number) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(UI_CONFIG.COLORS.PRIMARY, 1);
      this.progressBar.fillRoundedRect(
        centerX - 195,
        centerY + 55,
        390 * value,
        20,
        8
      );
      this.loadingText.setText(`Loading... ${Math.round(value * 100)}%`);
    });

    // File progress event
    this.load.on("fileprogress", (file: Phaser.Loader.File) => {
      this.loadingText.setText(`Loading: ${file.key}`);
    });

    // Complete event
    this.load.on("complete", () => {
      this.loadingText.setText("Complete!");
    });
  }

  preload(): void {
    // Load map layer images (exported from Tiled as PNGs)
    this.load.image("layer_bg", "src/resources/map01-layers/bg.png");
    this.load.image(
      "layer_floor_wall",
      "src/resources/map01-layers/floor-wall.png"
    );
    this.load.image(
      "layer_floor_objects_behind",
      "src/resources/map01-layers/floor-objects-behind.png"
    );
    this.load.image(
      "layer_floor_objects",
      "src/resources/map01-layers/floor-objects.png"
    );
    this.load.image(
      "layer_floor_wall2",
      "src/resources/map01-layers/floor-wall2.png"
    );
    this.load.image(
      "layer_above_player",
      "src/resources/map01-layers/above-player.png"
    );

    // Load collision data (extracted from Tiled)
    this.load.json("collision_data", "src/resources/collision.json");

    // Load door spritesheets
    this.load.spritesheet("door01", "src/resources/doors/door01.png", {
      frameWidth: 64,
      frameHeight: 128,
    });
    this.load.spritesheet("door02", "src/resources/doors/door02.png", {
      frameWidth: 64,
      frameHeight: 128,
    });
    this.load.spritesheet("door03", "src/resources/doors/door03.png", {
      frameWidth: 64,
      frameHeight: 128,
    });

    // Load chairs spritesheet
    // 3 rows (yellow, green, red) x 6 columns (directions)
    this.load.spritesheet("chairs", "src/resources/objects/chairs.png", {
      frameWidth: 32,
      frameHeight: 48,
    });

    // Load tablet sprite (32x64)
    this.load.image("tablet", "src/resources/objects/tablet.png");

    // Load UI icon spritesheets (32x32, 6 frames each)
    this.load.spritesheet(
      "ui_arrow_down",
      "src/resources/ui_icons/arrow_down.png",
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );
    this.load.spritesheet("ui_e_key", "src/resources/ui_icons/e_key.png", {
      frameWidth: 32,
      frameHeight: 32,
    });

    // Load character sprites as images (not spritesheets)
    // We'll add custom frames in create() to handle the 16px vertical gaps
    Object.values(SPRITES).forEach((sprite) => {
      this.load.image(sprite.key, sprite.path);
    });

    // Load placeholder assets from assets folder
    this.load.setPath("assets");
    for (let i = 0; i < 100; i++) {
      this.load.image(`placeholder_${i}`, "logo.png");
    }
  }

  create(): void {
    // Add custom frames to character textures (handles 16px vertical gaps)
    Object.values(SPRITES).forEach((sprite) => {
      addCustomFramesToTexture(this, sprite);
    });

    // Register all sprite animations
    Object.values(SPRITES).forEach((sprite) => {
      registerAnimations(this, sprite);
    });

    // Create UI icon animations
    this.createUIAnimations();

    // Create placeholder textures
    this.createPlaceholderTextures();

    // Small delay before transitioning to show "Complete!"
    this.time.delayedCall(500, () => {
      this.scene.start(SCENES.MAIN_MENU);
    });
  }

  /**
   * Create placeholder textures for development
   * These will be replaced with real sprites later
   */
  private createPlaceholderTextures(): void {
    // Player placeholder (blue square)
    const playerGraphics = this.make.graphics({ x: 0, y: 0 });
    playerGraphics.fillStyle(0x3498db, 1);
    playerGraphics.fillRoundedRect(0, 0, 32, 32, 4);
    playerGraphics.generateTexture("player", 32, 32);
    playerGraphics.destroy();

    // Patient placeholder (colored by severity - default green)
    const patientGraphics = this.make.graphics({ x: 0, y: 0 });
    patientGraphics.fillStyle(0x4ade80, 1);
    patientGraphics.fillCircle(16, 16, 14);
    patientGraphics.generateTexture("patient", 32, 32);
    patientGraphics.destroy();

    // Nurse placeholder (blue circle)
    const nurseGraphics = this.make.graphics({ x: 0, y: 0 });
    nurseGraphics.fillStyle(0x3b82f6, 1);
    nurseGraphics.fillCircle(16, 16, 14);
    nurseGraphics.lineStyle(2, 0xffffff);
    nurseGraphics.strokeCircle(16, 16, 14);
    nurseGraphics.generateTexture("nurse", 32, 32);
    nurseGraphics.destroy();

    // Doctor placeholder (purple circle)
    const doctorGraphics = this.make.graphics({ x: 0, y: 0 });
    doctorGraphics.fillStyle(0x8b5cf6, 1);
    doctorGraphics.fillCircle(16, 16, 14);
    doctorGraphics.lineStyle(2, 0xffffff);
    doctorGraphics.strokeCircle(16, 16, 14);
    doctorGraphics.generateTexture("doctor", 32, 32);
    doctorGraphics.destroy();

    // Bed placeholder (rectangle)
    const bedGraphics = this.make.graphics({ x: 0, y: 0 });
    bedGraphics.fillStyle(0x6b7280, 1);
    bedGraphics.fillRoundedRect(0, 0, 48, 64, 4);
    bedGraphics.fillStyle(0x9ca3af, 1);
    bedGraphics.fillRoundedRect(4, 4, 40, 20, 2);
    bedGraphics.generateTexture("bed", 48, 64);
    bedGraphics.destroy();

    // Bed occupied placeholder
    const bedOccupiedGraphics = this.make.graphics({ x: 0, y: 0 });
    bedOccupiedGraphics.fillStyle(0x6b7280, 1);
    bedOccupiedGraphics.fillRoundedRect(0, 0, 48, 64, 4);
    bedOccupiedGraphics.fillStyle(0xfbbf24, 1);
    bedOccupiedGraphics.fillRoundedRect(4, 4, 40, 20, 2);
    bedOccupiedGraphics.generateTexture("bed_occupied", 48, 64);
    bedOccupiedGraphics.destroy();

    console.log("✅ Placeholder textures created");
  }

  /**
   * Create UI icon animations (arrow_down, e_key)
   */
  private createUIAnimations(): void {
    // Arrow down animation (bouncing pointer)
    this.anims.create({
      key: "ui_arrow_down_anim",
      frames: this.anims.generateFrameNumbers("ui_arrow_down", {
        start: 0,
        end: 5,
      }),
      frameRate: 8,
      repeat: -1,
    });

    // E key animation (press indicator)
    this.anims.create({
      key: "ui_e_key_anim",
      frames: this.anims.generateFrameNumbers("ui_e_key", { start: 0, end: 5 }),
      frameRate: 8,
      repeat: -1,
    });

    console.log("✅ UI icon animations created");
  }
}
