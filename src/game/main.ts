import { Boot } from "./scenes/Boot";
import { Preloader } from "./scenes/Preloader";
import { MainMenu } from "./scenes/MainMenu";
import { HowToPlay } from "./scenes/HowToPlay";
import { Settings } from "./scenes/Settings";
import { Game as MainGame } from "./scenes/Game";
import { Pause } from "./scenes/Pause";
import { GameOver } from "./scenes/GameOver";
import { AnimationDebug } from "./scenes/AnimationDebug";
import { AUTO, Game } from "phaser";
import { GAME_CONFIG, UI_CONFIG } from "./utils/Constants";

/**
 * Phaser Game Configuration
 * https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
 */
const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  width: GAME_CONFIG.WIDTH,
  height: GAME_CONFIG.HEIGHT,
  parent: "game-container",
  backgroundColor: UI_CONFIG.COLORS.SECONDARY,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    Boot,
    Preloader,
    MainMenu,
    HowToPlay,
    Settings,
    MainGame,
    Pause,
    GameOver,
    AnimationDebug,
  ],
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  input: {
    keyboard: true,
    mouse: true,
    touch: true,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
};

/**
 * Start the game
 * @param parent - Parent container ID
 */
const StartGame = (parent: string): Phaser.Game => {
  return new Game({ ...config, parent });
};

export default StartGame;
