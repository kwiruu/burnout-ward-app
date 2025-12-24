/**
 * Interaction Manager
 *
 * Handles interaction prompts and player interactions with objects.
 * Shows "Press E" prompts when near interactable objects.
 */

import { PLAYER_CONFIG, UI_CONFIG } from "../utils/Constants";
import EventBus from "../utils/EventBus";

export interface Interactable {
  id: string;
  x: number;
  y: number;
  type: "bed" | "equipment" | "patient" | "staff" | "furniture" | "door";
  label?: string;
  canInteract: () => boolean;
  onInteract: () => void;
}

export class InteractionManager {
  private scene: Phaser.Scene;
  private interactables: Map<string, Interactable> = new Map();
  private currentTarget: Interactable | null = null;
  private promptContainer: Phaser.GameObjects.Container | null = null;
  private promptText: Phaser.GameObjects.Text | null = null;
  private promptBg: Phaser.GameObjects.Graphics | null = null;
  private interactionKey: Phaser.Input.Keyboard.Key | null = null;
  private interactionRange: number = PLAYER_CONFIG.INTERACTION_RANGE;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createPromptUI();
    this.setupInput();
  }

  /**
   * Create the interaction prompt UI
   */
  private createPromptUI(): void {
    this.promptContainer = this.scene.add.container(0, 0);
    this.promptContainer.setDepth(500);
    this.promptContainer.setVisible(false);

    // Background
    this.promptBg = this.scene.add.graphics();
    this.promptContainer.add(this.promptBg);

    // Text
    this.promptText = this.scene.add.text(0, 0, "", {
      fontFamily: "Arial Black",
      fontSize: "14px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
    });
    this.promptText.setOrigin(0.5);
    this.promptContainer.add(this.promptText);
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
      this.promptContainer.setPosition(nearestTarget.x, nearestTarget.y - 50);
    }
  }

  /**
   * Show interaction prompt
   */
  private showPrompt(target: Interactable): void {
    if (!this.promptContainer || !this.promptText || !this.promptBg) return;

    // Set text based on target type
    const actionText = this.getActionText(target);
    const labelText = target.label || this.getDefaultLabel(target);
    const fullText = `[E] ${actionText} ${labelText}`;

    this.promptText.setText(fullText);

    // Update background size
    const padding = 10;
    const width = this.promptText.width + padding * 2;
    const height = this.promptText.height + padding * 2;

    this.promptBg.clear();
    this.promptBg.fillStyle(0x000000, 0.7);
    this.promptBg.fillRoundedRect(-width / 2, -height / 2, width, height, 6);
    this.promptBg.lineStyle(2, UI_CONFIG.COLORS.PRIMARY, 1);
    this.promptBg.strokeRoundedRect(-width / 2, -height / 2, width, height, 6);

    // Position and show
    this.promptContainer.setPosition(target.x, target.y - 50);
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
   * Get action text based on target type
   */
  private getActionText(target: Interactable): string {
    switch (target.type) {
      case "bed":
        return "Interact with";
      case "equipment":
        return "Use";
      case "patient":
        return "Attend to";
      case "staff":
        return "Talk to";
      case "furniture":
        return "Use";
      case "door":
        return "Open";
      default:
        return "Interact with";
    }
  }

  /**
   * Get default label based on target type
   */
  private getDefaultLabel(target: Interactable): string {
    switch (target.type) {
      case "bed":
        return "Bed";
      case "equipment":
        return "Equipment";
      case "patient":
        return "Patient";
      case "staff":
        return "Staff";
      case "furniture":
        return "Object";
      case "door":
        return "Door";
      default:
        return "Object";
    }
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
   * Clean up
   */
  destroy(): void {
    this.interactables.clear();
    this.promptContainer?.destroy();
    this.interactionKey?.destroy();
  }
}
