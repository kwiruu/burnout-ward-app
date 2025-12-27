/**
 * Pathfinding Manager
 *
 * Uses EasyStar.js for A* pathfinding on a grid-based map.
 * Builds walkability grid from collision data.
 */

import EasyStar from "easystarjs";
import { CollisionManager, CollisionRect, MapBounds } from "./CollisionManager";

export interface PathPoint {
  x: number;
  y: number;
}

export class PathfindingManager {
  private scene: Phaser.Scene;
  private easystar: EasyStar.js;
  private grid: number[][] = [];
  private tileSize: number;
  private gridWidth: number = 0;
  private gridHeight: number = 0;
  private mapBounds: MapBounds;
  private collisionManager: CollisionManager;
  private debugGraphics: Phaser.GameObjects.Graphics | null = null;
  private debugMode: boolean = false;

  // Grid values - higher values = higher cost, not blocked
  private static readonly WALKABLE = 0;
  private static readonly BLOCKED = 99;
  private static readonly NEAR_WALL = 1; // Higher cost for tiles near walls

  constructor(
    scene: Phaser.Scene,
    collisionManager: CollisionManager,
    mapBounds: MapBounds,
    tileSize: number = 16
  ) {
    this.scene = scene;
    this.collisionManager = collisionManager;
    this.mapBounds = mapBounds;
    this.tileSize = tileSize;

    // Initialize EasyStar
    this.easystar = new EasyStar.js();
    // Accept walkable tiles (0) and near-wall tiles (1), but not blocked (99)
    this.easystar.setAcceptableTiles([
      PathfindingManager.WALKABLE,
      PathfindingManager.NEAR_WALL,
    ]);
    // Enable diagonals for natural-looking movement
    this.easystar.enableDiagonals();
    // Set tile costs - near-wall tiles cost more so path prefers center
    this.easystar.setTileCost(PathfindingManager.NEAR_WALL, 3);

    // Build the grid
    this.buildGrid();
  }

  /**
   * Build walkability grid from collision data
   */
  private buildGrid(): void {
    const width = this.mapBounds.maxX - this.mapBounds.minX;
    const height = this.mapBounds.maxY - this.mapBounds.minY;

    this.gridWidth = Math.ceil(width / this.tileSize);
    this.gridHeight = Math.ceil(height / this.tileSize);

    // Initialize grid as walkable
    this.grid = [];
    for (let y = 0; y < this.gridHeight; y++) {
      const row: number[] = [];
      for (let x = 0; x < this.gridWidth; x++) {
        row.push(PathfindingManager.WALKABLE);
      }
      this.grid.push(row);
    }

    // Mark blocked cells using collision check
    for (let gridY = 0; gridY < this.gridHeight; gridY++) {
      for (let gridX = 0; gridX < this.gridWidth; gridX++) {
        const worldX = this.gridToWorldX(gridX);
        const worldY = this.gridToWorldY(gridY);

        // Check if this tile center collides with anything
        const result = this.collisionManager.checkCollision(
          worldX,
          worldY,
          this.tileSize * 0.5,
          [] // Don't exclude any colliders
        );

        if (result.collides) {
          this.grid[gridY][gridX] = PathfindingManager.BLOCKED;
        }
      }
    }

    // Mark tiles adjacent to walls as NEAR_WALL (higher cost)
    // This makes the path prefer the center of corridors
    this.markNearWallTiles();

    // Update EasyStar grid
    this.easystar.setGrid(this.grid);

    console.log(
      `🗺️ Pathfinding grid built: ${this.gridWidth}x${this.gridHeight} tiles`
    );
  }

  /**
   * Mark tiles adjacent to blocked tiles as NEAR_WALL (higher traversal cost)
   * This makes pathfinding prefer center paths over wall-hugging
   */
  private markNearWallTiles(): void {
    // Find all blocked cells first
    const blockedCells: { x: number; y: number }[] = [];
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        if (this.grid[y][x] === PathfindingManager.BLOCKED) {
          blockedCells.push({ x, y });
        }
      }
    }

    // Mark adjacent walkable cells as NEAR_WALL
    for (const cell of blockedCells) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;

          const nx = cell.x + dx;
          const ny = cell.y + dy;

          if (
            nx >= 0 &&
            nx < this.gridWidth &&
            ny >= 0 &&
            ny < this.gridHeight &&
            this.grid[ny][nx] === PathfindingManager.WALKABLE
          ) {
            this.grid[ny][nx] = PathfindingManager.NEAR_WALL;
          }
        }
      }
    }
  }

  /**
   * Dilate blocked cells to create a buffer zone around walls
   * This makes paths stay away from walls by the specified radius
   */
  private dilateBlockedCells(radius: number): void {
    // Create a copy to avoid modifying while iterating
    const blockedCells: { x: number; y: number }[] = [];

    // Find all blocked cells
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        if (this.grid[y][x] === PathfindingManager.BLOCKED) {
          blockedCells.push({ x, y });
        }
      }
    }

    // For each blocked cell, mark adjacent cells as blocked too
    for (const cell of blockedCells) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = cell.x + dx;
          const ny = cell.y + dy;

          if (
            nx >= 0 &&
            nx < this.gridWidth &&
            ny >= 0 &&
            ny < this.gridHeight
          ) {
            this.grid[ny][nx] = PathfindingManager.BLOCKED;
          }
        }
      }
    }
  }

  /**
   * Rebuild the grid (call after collision changes)
   */
  rebuildGrid(): void {
    this.buildGrid();
    if (this.debugMode) this.drawDebug();
  }

  /**
   * Convert grid X to world X
   */
  private gridToWorldX(gridX: number): number {
    return this.mapBounds.minX + gridX * this.tileSize + this.tileSize / 2;
  }

  /**
   * Convert grid Y to world Y
   */
  private gridToWorldY(gridY: number): number {
    return this.mapBounds.minY + gridY * this.tileSize + this.tileSize / 2;
  }

  /**
   * Convert world X to grid X
   */
  private worldToGridX(worldX: number): number {
    return Math.floor((worldX - this.mapBounds.minX) / this.tileSize);
  }

  /**
   * Convert world Y to grid Y
   */
  private worldToGridY(worldY: number): number {
    return Math.floor((worldY - this.mapBounds.minY) / this.tileSize);
  }

  /**
   * Clamp grid coordinates to valid range
   */
  private clampGridX(gridX: number): number {
    return Math.max(0, Math.min(this.gridWidth - 1, gridX));
  }

  private clampGridY(gridY: number): number {
    return Math.max(0, Math.min(this.gridHeight - 1, gridY));
  }

  /**
   * Find path between two world positions
   * Returns a promise with array of waypoints or null if no path found
   */
  findPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): Promise<PathPoint[] | null> {
    return new Promise((resolve) => {
      // Convert to grid coordinates
      let startGridX = this.clampGridX(this.worldToGridX(startX));
      let startGridY = this.clampGridY(this.worldToGridY(startY));
      let endGridX = this.clampGridX(this.worldToGridX(endX));
      let endGridY = this.clampGridY(this.worldToGridY(endY));

      // If start is blocked, find nearest walkable
      if (this.grid[startGridY]?.[startGridX] === PathfindingManager.BLOCKED) {
        const nearest = this.findNearestWalkable(startGridX, startGridY);
        if (nearest) {
          startGridX = nearest.x;
          startGridY = nearest.y;
        } else {
          console.warn(
            `🚫 Pathfinding: No walkable start found near (${startX}, ${startY})`
          );
          resolve(null);
          return;
        }
      }

      // If end is blocked, find nearest walkable
      if (this.grid[endGridY]?.[endGridX] === PathfindingManager.BLOCKED) {
        const nearest = this.findNearestWalkable(endGridX, endGridY);
        if (nearest) {
          endGridX = nearest.x;
          endGridY = nearest.y;
        } else {
          console.warn(
            `🚫 Pathfinding: No walkable end found near (${endX}, ${endY})`
          );
          resolve(null);
          return;
        }
      }

      // Find path
      this.easystar.findPath(
        startGridX,
        startGridY,
        endGridX,
        endGridY,
        (path) => {
          if (!path || path.length === 0) {
            console.warn(
              `🚫 Pathfinding: No path from (${startX}, ${startY}) to (${endX}, ${endY})`
            );
            resolve(null);
            return;
          }

          // Convert grid path to world coordinates
          const worldPath: PathPoint[] = path.map((point) => ({
            x: this.gridToWorldX(point.x),
            y: this.gridToWorldY(point.y),
          }));

          // Simplify path by removing collinear points
          const simplifiedPath = this.simplifyPath(worldPath);

          // Force final waypoint to the exact requested destination so arrivals land on the true target
          if (simplifiedPath.length > 0) {
            simplifiedPath[simplifiedPath.length - 1] = { x: endX, y: endY };
          }

          resolve(simplifiedPath);
        }
      );

      this.easystar.calculate();
    });
  }

  /**
   * Find nearest walkable tile to a blocked position
   */
  private findNearestWalkable(
    gridX: number,
    gridY: number
  ): { x: number; y: number } | null {
    const maxRadius = 20; // Increased search radius

    for (let radius = 1; radius <= maxRadius; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

          const nx = gridX + dx;
          const ny = gridY + dy;

          if (
            nx >= 0 &&
            nx < this.gridWidth &&
            ny >= 0 &&
            ny < this.gridHeight &&
            this.grid[ny][nx] !== PathfindingManager.BLOCKED // Accept WALKABLE or NEAR_WALL
          ) {
            return { x: nx, y: ny };
          }
        }
      }
    }

    return null;
  }

  /**
   * Simplify path by removing collinear points
   */
  private simplifyPath(path: PathPoint[]): PathPoint[] {
    if (path.length <= 2) return path;

    const simplified: PathPoint[] = [path[0]];

    for (let i = 1; i < path.length - 1; i++) {
      const prev = simplified[simplified.length - 1];
      const curr = path[i];
      const next = path[i + 1];

      // Check if direction changes
      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;

      // If direction changes, keep this point
      if (
        Math.sign(dx1) !== Math.sign(dx2) ||
        Math.sign(dy1) !== Math.sign(dy2)
      ) {
        simplified.push(curr);
      }
    }

    // Always add the last point
    simplified.push(path[path.length - 1]);

    return simplified;
  }

  /**
   * Block a specific area (e.g., when a bed becomes occupied)
   */
  blockArea(rect: CollisionRect): void {
    const startGridX = this.clampGridX(this.worldToGridX(rect.x));
    const startGridY = this.clampGridY(this.worldToGridY(rect.y));
    const endGridX = this.clampGridX(this.worldToGridX(rect.x + rect.width));
    const endGridY = this.clampGridY(this.worldToGridY(rect.y + rect.height));

    for (let y = startGridY; y <= endGridY; y++) {
      for (let x = startGridX; x <= endGridX; x++) {
        if (this.grid[y]) {
          this.grid[y][x] = PathfindingManager.BLOCKED;
        }
      }
    }

    this.easystar.setGrid(this.grid);
    if (this.debugMode) this.drawDebug();
  }

  /**
   * Unblock a specific area
   */
  unblockArea(rect: CollisionRect): void {
    const startGridX = this.clampGridX(this.worldToGridX(rect.x));
    const startGridY = this.clampGridY(this.worldToGridY(rect.y));
    const endGridX = this.clampGridX(this.worldToGridX(rect.x + rect.width));
    const endGridY = this.clampGridY(this.worldToGridY(rect.y + rect.height));

    for (let y = startGridY; y <= endGridY; y++) {
      for (let x = startGridX; x <= endGridX; x++) {
        // Check if this tile should actually be walkable
        const worldX = this.gridToWorldX(x);
        const worldY = this.gridToWorldY(y);
        const result = this.collisionManager.checkCollision(
          worldX,
          worldY,
          this.tileSize / 2 - 2,
          []
        );

        if (!result.collides && this.grid[y]) {
          this.grid[y][x] = PathfindingManager.WALKABLE;
        }
      }
    }

    this.easystar.setGrid(this.grid);
    if (this.debugMode) this.drawDebug();
  }

  /**
   * Toggle debug visualization
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    if (enabled) {
      this.drawDebug();
    } else if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }
  }

  /**
   * Draw debug visualization
   */
  private drawDebug(): void {
    if (!this.debugGraphics) {
      this.debugGraphics = this.scene.add.graphics();
      this.debugGraphics.setDepth(999);
    }

    this.debugGraphics.clear();

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const worldX = this.gridToWorldX(x) - this.tileSize / 2;
        const worldY = this.gridToWorldY(y) - this.tileSize / 2;

        if (this.grid[y][x] === PathfindingManager.BLOCKED) {
          this.debugGraphics.fillStyle(0xff0000, 0.3);
          this.debugGraphics.fillRect(
            worldX,
            worldY,
            this.tileSize,
            this.tileSize
          );
        } else {
          this.debugGraphics.lineStyle(1, 0x00ff00, 0.1);
          this.debugGraphics.strokeRect(
            worldX,
            worldY,
            this.tileSize,
            this.tileSize
          );
        }
      }
    }
  }

  /**
   * Check if a world position is walkable
   */
  isWalkable(worldX: number, worldY: number): boolean {
    const gridX = this.worldToGridX(worldX);
    const gridY = this.worldToGridY(worldY);

    if (
      gridX < 0 ||
      gridX >= this.gridWidth ||
      gridY < 0 ||
      gridY >= this.gridHeight
    ) {
      return false;
    }

    // Walkable if not blocked (can be WALKABLE or NEAR_WALL)
    return this.grid[gridY][gridX] !== PathfindingManager.BLOCKED;
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.debugGraphics?.destroy();
    this.grid = [];
  }
}
