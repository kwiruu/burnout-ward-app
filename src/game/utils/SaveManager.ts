/**
 * SaveManager
 * Handles persistence of game settings and data using localStorage
 */

import { SHIFT_CONFIG, DIFFICULTY, DifficultyLevel } from "./Constants";

// ===========================================
// TYPES
// ===========================================

export interface GameSettings {
  musicVolume: number; // 0-100
  sfxVolume: number; // 0-100
  shiftDuration: number; // seconds
  difficulty: DifficultyLevel;
}

export interface GameStats {
  totalGamesPlayed: number;
  totalPatientsHealed: number;
  totalPatientsLost: number;
  bestGrade: string;
  totalPlayTime: number; // seconds
}

// ===========================================
// STORAGE KEYS
// ===========================================

const STORAGE_KEYS = {
  SETTINGS: "codeRed_settings",
  STATS: "codeRed_stats",
  HIGH_SCORES: "codeRed_highScores",
} as const;

// ===========================================
// DEFAULT VALUES
// ===========================================

const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 80,
  sfxVolume: 100,
  shiftDuration: SHIFT_CONFIG.DEFAULT,
  difficulty: "NORMAL",
};

const DEFAULT_STATS: GameStats = {
  totalGamesPlayed: 0,
  totalPatientsHealed: 0,
  totalPatientsLost: 0,
  bestGrade: "F",
  totalPlayTime: 0,
};

// ===========================================
// SAVE MANAGER CLASS
// ===========================================

class SaveManagerClass {
  private settings: GameSettings;
  private stats: GameStats;

  constructor() {
    this.settings = this.loadSettings();
    this.stats = this.loadStats();
  }

  // ===========================================
  // SETTINGS
  // ===========================================

  /**
   * Load settings from localStorage
   */
  private loadSettings(): GameSettings {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to handle new properties
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.warn("Failed to load settings:", error);
    }
    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem(
        STORAGE_KEYS.SETTINGS,
        JSON.stringify(this.settings)
      );
    } catch (error) {
      console.warn("Failed to save settings:", error);
    }
  }

  /**
   * Get current settings
   */
  getSettings(): GameSettings {
    return { ...this.settings };
  }

  /**
   * Update a single setting
   */
  setSetting<K extends keyof GameSettings>(
    key: K,
    value: GameSettings[K]
  ): void {
    this.settings[key] = value;
    this.saveSettings();
  }

  /**
   * Update multiple settings
   */
  setSettings(settings: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.saveSettings();
  }

  /**
   * Reset settings to defaults
   */
  resetSettings(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
  }

  // ===========================================
  // INDIVIDUAL SETTING ACCESSORS
  // ===========================================

  getMusicVolume(): number {
    return this.settings.musicVolume;
  }

  setMusicVolume(volume: number): void {
    this.setSetting("musicVolume", Math.max(0, Math.min(100, volume)));
  }

  getSfxVolume(): number {
    return this.settings.sfxVolume;
  }

  setSfxVolume(volume: number): void {
    this.setSetting("sfxVolume", Math.max(0, Math.min(100, volume)));
  }

  getShiftDuration(): number {
    return this.settings.shiftDuration;
  }

  setShiftDuration(duration: number): void {
    this.setSetting("shiftDuration", duration);
  }

  getDifficulty(): DifficultyLevel {
    return this.settings.difficulty;
  }

  getDifficultySettings() {
    return DIFFICULTY[this.settings.difficulty];
  }

  setDifficulty(difficulty: DifficultyLevel): void {
    this.setSetting("difficulty", difficulty);
  }

  // ===========================================
  // STATS
  // ===========================================

  /**
   * Load stats from localStorage
   */
  private loadStats(): GameStats {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STATS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_STATS, ...parsed };
      }
    } catch (error) {
      console.warn("Failed to load stats:", error);
    }
    return { ...DEFAULT_STATS };
  }

  /**
   * Save stats to localStorage
   */
  private saveStats(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(this.stats));
    } catch (error) {
      console.warn("Failed to save stats:", error);
    }
  }

  /**
   * Get current stats
   */
  getStats(): GameStats {
    return { ...this.stats };
  }

  /**
   * Update stats after a game
   */
  updateStats(
    patientsHealed: number,
    patientsLost: number,
    grade: string,
    playTime: number
  ): void {
    this.stats.totalGamesPlayed++;
    this.stats.totalPatientsHealed += patientsHealed;
    this.stats.totalPatientsLost += patientsLost;
    this.stats.totalPlayTime += playTime;

    // Update best grade (S > A > B > C > D > F)
    const gradeOrder = ["S", "A", "B", "C", "D", "F"];
    const currentBestIndex = gradeOrder.indexOf(this.stats.bestGrade);
    const newGradeIndex = gradeOrder.indexOf(grade);
    if (newGradeIndex < currentBestIndex) {
      this.stats.bestGrade = grade;
    }

    this.saveStats();
  }

  /**
   * Reset stats
   */
  resetStats(): void {
    this.stats = { ...DEFAULT_STATS };
    this.saveStats();
  }

  // ===========================================
  // UTILITY
  // ===========================================

  /**
   * Clear all saved data
   */
  clearAllData(): void {
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.STATS);
    localStorage.removeItem(STORAGE_KEYS.HIGH_SCORES);
    this.settings = { ...DEFAULT_SETTINGS };
    this.stats = { ...DEFAULT_STATS };
  }

  /**
   * Check if localStorage is available
   */
  isStorageAvailable(): boolean {
    try {
      const test = "__storage_test__";
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }
}

// Export singleton instance
export const SaveManager = new SaveManagerClass();
export default SaveManager;
