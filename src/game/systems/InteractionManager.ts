/**
 * Interaction Manager
 *
 * Handles interaction prompts and player interactions with objects.
 * Shows "Press E" prompts when near interactable objects.
 */

import { PLAYER_CONFIG } from "../utils/Constants";
import EventBus from "../utils/EventBus";

export interface Interactable {
  id: string;
  x: number;
  y: number;
  type:
    | "bed"
    | "equipment"
    | "patient"
    | "staff"
    | "furniture"
    | "door"
    | "chair"
    | "tablet";
  label?: string;
  /** Optional dynamic label function - called each frame when prompt is visible */
  getLabel?: () => string;
  canInteract: () => boolean;
  onInteract: () => void;
  /** Optional: show pointer indicator when not in range (for tablets) */
  showPointerWhenFar?: boolean;
  /** Optional: custom Y offset for the prompt */
  promptYOffset?: number;
}

export class InteractionManager {
  private scene: Phaser.Scene;
  private interactables: Map<string, Interactable> = new Map();
  private currentTarget: Interactable | null = null;
  private promptContainer: Phaser.GameObjects.Container | null = null;
  private eKeySprite: Phaser.GameObjects.Sprite | null = null;
  private interactionKey: Phaser.Input.Keyboard.Key | null = null;
  private interactionRange: number = PLAYER_CONFIG.INTERACTION_RANGE;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createPromptUI();
    this.setupInput();
  }

  /**
   * Create the interaction prompt UI with animated E key sprite
   */
  private createPromptUI(): void {
    this.promptContainer = this.scene.add.container(0, 0);
    this.promptContainer.setDepth(500);
    this.promptContainer.setVisible(false);

    // E key sprite (animated)
    this.eKeySprite = this.scene.add.sprite(0, 0, "ui_e_key", 0);
    this.eKeySprite.setOrigin(0.5);
    this.promptContainer.add(this.eKeySprite);
  }

  /**
   * Setup input handling
   */
  private setupInput(): void {
    this.interactionKey = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.E
    );

    this.interactionKey.on("down", () => {
      this.tryInteract();
    });
  }

  /**
   * Register an interactable object
   */
  register(interactable: Interactable): void {
    this.interactables.set(interactable.id, interactable);
  }

  /**
   * Unregister an interactable object
   */
  unregister(id: string): void {
    this.interactables.delete(id);
    if (this.currentTarget?.id === id) {
      this.currentTarget = null;
      this.hidePrompt();
    }
  }

  /**
   * Update interactable position
   */
  updatePosition(id: string, x: number, y: number): void {
    const interactable = this.interactables.get(id);
    if (interactable) {
      interactable.x = x;
      interactable.y = y;
    }
  }

  /**
   * Update check - call every frame with player position
   */
  update(playerX: number, playerY: number): void {
    let nearestTarget: Interactable | null = null;
    let nearestDistance = this.interactionRange;

    // Find nearest interactable within range
    for (const interactable of this.interactables.values()) {
      if (!interactable.canInteract()) continue;

      const distance = Phaser.Math.Distance.Between(
        playerX,
        playerY,
        interactable.x,
        interactable.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestTarget = interactable;
      }
    }

    // Update current target if changed
    if (nearestTarget !== this.currentTarget) {
      this.currentTarget = nearestTarget;

      if (nearestTarget) {
        this.showPrompt(nearestTarget);
      } else {
        this.hidePrompt();
      }
    }

    // Update prompt position if visible
    if (nearestTarget && this.promptContainer?.visible) {
      const yOffset = nearestTarget.promptYOffset ?? -40;
      this.promptContainer.setPosition(
        nearestTarget.x,
        nearestTarget.y + yOffset
      );
    }
  }

  /**
   * Show interaction prompt with E key animation
   */
  private showPrompt(target: Interactable): void {
    if (!this.promptContainer || !this.eKeySprite) return;

    // Play E key animation
    if (this.scene.anims.exists("ui_e_key_anim")) {
      this.eKeySprite.play("ui_e_key_anim");
    }

    // Position and show
    const yOffset = target.promptYOffset ?? -40;
    this.promptContainer.setPosition(target.x, target.y + yOffset);
    this.promptContainer.setVisible(true);

    // Pop animation
    this.promptContainer.setScale(0.8);
    this.scene.tweens.add({
      targets: this.promptContainer,
      scaleX: 1,
      scaleY: 1,
      duration: 100,
      ease: "Back.easeOut",
    });

    EventBus.emit("interaction:prompt_shown", { target });
  }

  /**
   * Hide interaction prompt
   */
  private hidePrompt(): void {
    if (!this.promptContainer) return;

    this.scene.tweens.add({
      targets: this.promptContainer,
      scaleX: 0.8,
      scaleY: 0.8,
      alpha: 0,
      duration: 100,
      onComplete: () => {
        this.promptContainer?.setVisible(false);
        this.promptContainer?.setAlpha(1);
        // Stop animation when hidden
        this.eKeySprite?.stop();
      },
    });

    EventBus.emit("interaction:prompt_hidden");
  }

  /**
   * Try to interact with current target
   */
  private tryInteract(): void {
    if (!this.currentTarget) return;
    if (!this.currentTarget.canInteract()) return;

    EventBus.emit("interaction:start", { target: this.currentTarget });
    this.currentTarget.onInteract();
    EventBus.emit("interaction:complete", { target: this.currentTarget });
  }

  /**
   * Get current interaction target
   */
  getCurrentTarget(): Interactable | null {
    return this.currentTarget;
  }

  /**
   * Check if player is near any interactable
   */
  hasNearbyInteractable(): boolean {
    return this.currentTarget !== null;
  }

  /**
   * Force interaction with specific target (for UI buttons, etc.)
   */
  forceInteract(id: string): void {
    const target = this.interactables.get(id);
    if (target && target.canInteract()) {
      EventBus.emit("interaction:start", { target });
      target.onInteract();
      EventBus.emit("interaction:complete", { target });
    }
  }

  /**
   * Set custom interaction range
   */
  setInteractionRange(range: number): void {
    this.interactionRange = range;
  }

  /**
   * Get current interaction range
   */
  getInteractionRange(): number {
    return this.interactionRange;
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.interactables.clear();
    this.promptContainer?.destroy();
    this.interactionKey?.destroy();
  }
}
