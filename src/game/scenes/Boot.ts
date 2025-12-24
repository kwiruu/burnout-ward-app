import { Scene } from "phaser";
import { SCENES } from "../utils/Constants";

/**
 * Boot Scene
 * First scene to load - handles minimal assets needed for the preloader
 */
export class Boot extends Scene {
  constructor() {
    super(SCENES.BOOT);
  }

  preload(): void {
    // Load minimal assets needed for preloader
    // These should be small files that load quickly
    this.load.setPath("assets");

    // Load a simple background or logo for the loading screen
    // For now, we'll create placeholder graphics in the Preloader
  }

  create(): void {
    // Initialize any global game systems here
    console.log("🏥 Code Red: ER Shift - Booting...");

    // Move to the preloader scene
    this.scene.start(SCENES.PRELOADER);
  }
}
