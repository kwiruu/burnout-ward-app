/**
 * Animation Debug Scene
 * Test and preview all character animations
 */

import { Scene } from "phaser";
import { SCENES, GAME_CONFIG } from "../utils/Constants";
import {
  SPRITES,
  getAvailableAnimations,
  registerAnimations,
} from "../config/SpriteConfigs";

export class AnimationDebug extends Scene {
  private sprite!: Phaser.GameObjects.Sprite;
  private currentSpriteKey: string = "doctor01";
  private currentAnimIndex: number = 0;
  private animationList: { key: string; direction: string }[] = [];

  // UI elements
  private spriteNameText!: Phaser.GameObjects.Text;
  private animNameText!: Phaser.GameObjects.Text;
  private frameText!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.ANIMATION_DEBUG);
  }

  create(): void {
    // Background
    this.cameras.main.setBackgroundColor(0x2d2d44);

    // Register animations for all sprites
    Object.values(SPRITES).forEach((config) => {
      registerAnimations(this, config);
    });

    // Get animation list
    this.animationList = getAvailableAnimations(this.currentSpriteKey).map(
      (a) => ({
        key: a.key,
        direction: a.direction,
      })
    );

    // Create sprite in center
    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;

    this.sprite = this.add.sprite(centerX, centerY, this.currentSpriteKey, 0);
    this.sprite.setScale(4); // Scale up for visibility

    // Create UI
    this.createUI();

    // Setup input
    this.setupInput();

    // Play first animation
    this.playCurrentAnimation();
  }

  private createUI(): void {
    const padding = 20;

    // Title
    this.add
      .text(GAME_CONFIG.WIDTH / 2, 30, "🎬 ANIMATION DEBUG", {
        fontFamily: "Arial Black",
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // Sprite name
    this.spriteNameText = this.add.text(padding, 80, "", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#16c79a",
    });

    // Animation name
    this.animNameText = this.add.text(padding, 110, "", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
    });

    // Frame info
    this.frameText = this.add.text(padding, 145, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#888888",
    });

    // Controls
    this.controlsText = this.add
      .text(
        GAME_CONFIG.WIDTH / 2,
        GAME_CONFIG.HEIGHT - 80,
        [
          "Controls:",
          "← → or A/D: Previous/Next Animation",
          "↑ ↓ or W/S: Previous/Next Sprite",
          "SPACE: Pause/Resume",
          "R: Restart Animation",
          "ESC: Back to Menu",
        ].join("\n"),
        {
          fontFamily: "Arial",
          fontSize: "16px",
          color: "#aaaaaa",
          align: "center",
        }
      )
      .setOrigin(0.5);

    // Animation list panel (right side)
    this.createAnimationListPanel();
  }

  private createAnimationListPanel(): void {
    const panelX = GAME_CONFIG.WIDTH - 250;
    const panelY = 80;
    const lineHeight = 22;

    this.add.text(panelX, panelY - 30, "Animations:", {
      fontFamily: "Arial Black",
      fontSize: "18px",
      color: "#ffffff",
    });

    // Create clickable animation list
    this.animationList.forEach((anim, index) => {
      const y = panelY + index * lineHeight;

      // Only show first 25 animations to fit on screen
      if (index >= 25) return;

      const displayName = anim.key.replace(`${this.currentSpriteKey}_`, "");
      const text = this.add.text(panelX, y, `${index + 1}. ${displayName}`, {
        fontFamily: "Arial",
        fontSize: "14px",
        color: index === this.currentAnimIndex ? "#16c79a" : "#888888",
      });

      // Make clickable
      text.setInteractive({ useHandCursor: true });
      text.on("pointerdown", () => {
        this.currentAnimIndex = index;
        this.playCurrentAnimation();
        this.updateAnimationListHighlight();
      });
      text.on("pointerover", () => {
        if (index !== this.currentAnimIndex) {
          text.setColor("#ffffff");
        }
      });
      text.on("pointerout", () => {
        text.setColor(index === this.currentAnimIndex ? "#16c79a" : "#888888");
      });

      // Store reference for highlighting
      (text as any).animIndex = index;
    });
  }

  private updateAnimationListHighlight(): void {
    // Update all text colors based on current selection
    this.children.list.forEach((child) => {
      if (
        child instanceof Phaser.GameObjects.Text &&
        (child as any).animIndex !== undefined
      ) {
        const idx = (child as any).animIndex;
        child.setColor(idx === this.currentAnimIndex ? "#16c79a" : "#888888");
      }
    });
  }

  private setupInput(): void {
    // Arrow keys / WASD for navigation
    this.input.keyboard!.on("keydown-RIGHT", () => this.nextAnimation());
    this.input.keyboard!.on("keydown-D", () => this.nextAnimation());
    this.input.keyboard!.on("keydown-LEFT", () => this.prevAnimation());
    this.input.keyboard!.on("keydown-A", () => this.prevAnimation());

    // Change sprite
    this.input.keyboard!.on("keydown-UP", () => this.nextSprite());
    this.input.keyboard!.on("keydown-W", () => this.nextSprite());
    this.input.keyboard!.on("keydown-DOWN", () => this.prevSprite());
    this.input.keyboard!.on("keydown-S", () => this.prevSprite());

    // Pause/Resume
    this.input.keyboard!.on("keydown-SPACE", () => {
      if (this.sprite.anims.isPlaying) {
        this.sprite.anims.pause();
      } else {
        this.sprite.anims.resume();
      }
    });

    // Restart
    this.input.keyboard!.on("keydown-R", () => {
      this.sprite.anims.restart();
    });

    // Back to menu
    this.input.keyboard!.on("keydown-ESC", () => {
      this.scene.start(SCENES.MAIN_MENU);
    });

    // Number keys 1-9 for quick selection
    for (let i = 1; i <= 9; i++) {
      this.input.keyboard!.on(`keydown-${i}`, () => {
        if (i - 1 < this.animationList.length) {
          this.currentAnimIndex = i - 1;
          this.playCurrentAnimation();
          this.updateAnimationListHighlight();
        }
      });
    }
  }

  private nextAnimation(): void {
    this.currentAnimIndex =
      (this.currentAnimIndex + 1) % this.animationList.length;
    this.playCurrentAnimation();
    this.updateAnimationListHighlight();
  }

  private prevAnimation(): void {
    this.currentAnimIndex =
      (this.currentAnimIndex - 1 + this.animationList.length) %
      this.animationList.length;
    this.playCurrentAnimation();
    this.updateAnimationListHighlight();
  }

  private nextSprite(): void {
    const spriteKeys = Object.keys(SPRITES);
    const currentIndex = spriteKeys.indexOf(this.currentSpriteKey);
    const nextIndex = (currentIndex + 1) % spriteKeys.length;
    this.changeSprite(spriteKeys[nextIndex]);
  }

  private prevSprite(): void {
    const spriteKeys = Object.keys(SPRITES);
    const currentIndex = spriteKeys.indexOf(this.currentSpriteKey);
    const prevIndex =
      (currentIndex - 1 + spriteKeys.length) % spriteKeys.length;
    this.changeSprite(spriteKeys[prevIndex]);
  }

  private changeSprite(newSpriteKey: string): void {
    this.currentSpriteKey = newSpriteKey;
    this.currentAnimIndex = 0;
    this.animationList = getAvailableAnimations(newSpriteKey).map((a) => ({
      key: a.key,
      direction: a.direction,
    }));

    // Update sprite texture
    this.sprite.setTexture(newSpriteKey, 0);

    // Recreate animation list panel
    this.children.list
      .filter((child) => (child as any).animIndex !== undefined)
      .forEach((child) => child.destroy());
    this.createAnimationListPanel();

    this.playCurrentAnimation();
  }

  private playCurrentAnimation(): void {
    if (this.animationList.length === 0) return;

    const anim = this.animationList[this.currentAnimIndex];

    // Update UI
    this.spriteNameText.setText(`Sprite: ${this.currentSpriteKey}`);
    this.animNameText.setText(
      `▶ ${anim.key.replace(`${this.currentSpriteKey}_`, "")}`
    );

    // Play animation
    if (this.anims.exists(anim.key)) {
      this.sprite.play(anim.key);
    } else {
      console.warn(`Animation not found: ${anim.key}`);
    }
  }

  update(): void {
    // Update frame info
    if (this.sprite.anims.currentAnim) {
      const currentFrame = this.sprite.anims.currentFrame?.index ?? 0;
      const totalFrames = this.sprite.anims.currentAnim.frames.length;
      const fps = this.sprite.anims.currentAnim.frameRate;
      const paused = !this.sprite.anims.isPlaying ? " (PAUSED)" : "";
      this.frameText.setText(
        `Frame: ${currentFrame + 1}/${totalFrames} @ ${fps}fps${paused}`
      );
    }
  }
}
