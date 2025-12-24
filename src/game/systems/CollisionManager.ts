/**
 * Collision Manager
 *
 * Handles collision detection for walls, furniture, and bounds.
 * Uses simple AABB (Axis-Aligned Bounding Box) collision.
 */

import { WALLS, FURNITURE, MAP_BOUNDS } from "../config/ERMapConfig";

export interface CollisionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollisionResult {
  collides: boolean;
  collidedWith: string | null;
  correctedX: number;
  correctedY: number;
}

export class CollisionManager {
  private scene: Phaser.Scene;
  private colliders: Map<string, CollisionRect> = new Map();
  private debugGraphics: Phaser.GameObjects.Graphics | null = null;
  private debugMode: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.initializeColliders();
  }

  /**
   * Initialize all collision rectangles
   */
  private initializeColliders(): void {
    // Add walls
    WALLS.forEach((wall) => {
      this.colliders.set(wall.id, {
        x: wall.x,
        y: wall.y,
        width: wall.width,
        height: wall.height,
      });
    });

    // Add collidable furniture
    FURNITURE.filter((f) => f.isCollidable).forEach((item) => {
      this.colliders.set(item.id, {
        x: item.x - item.width / 2,
        y: item.y - item.height / 2,
        width: item.width,
        height: item.height,
      });
    });
  }

  /**
   * Add a dynamic collider (e.g., beds)
   */
  addCollider(id: string, rect: CollisionRect): void {
    this.colliders.set(id, rect);
    if (this.debugMode) this.drawDebug();
  }

  /**
   * Remove a collider
   */
  removeCollider(id: string): void {
    this.colliders.delete(id);
    if (this.debugMode) this.drawDebug();
  }

  /**
   * Update a collider's position
   */
  updateCollider(id: string, rect: Partial<CollisionRect>): void {
    const existing = this.colliders.get(id);
    if (existing) {
      this.colliders.set(id, { ...existing, ...rect });
      if (this.debugMode) this.drawDebug();
    }
  }

  /**
   * Check if a point with radius collides with anything
   */
  checkCollision(
    x: number,
    y: number,
    radius: number = 16,
    excludeIds: string[] = []
  ): CollisionResult {
    let correctedX = x;
    let correctedY = y;
    let collides = false;
    let collidedWith: string | null = null;

    // Check map bounds first
    if (x - radius < MAP_BOUNDS.minX) {
      correctedX = MAP_BOUNDS.minX + radius;
      collides = true;
      collidedWith = "bounds";
    }
    if (x + radius > MAP_BOUNDS.maxX) {
      correctedX = MAP_BOUNDS.maxX - radius;
      collides = true;
      collidedWith = "bounds";
    }
    if (y - radius < MAP_BOUNDS.minY) {
      correctedY = MAP_BOUNDS.minY + radius;
      collides = true;
      collidedWith = "bounds";
    }
    if (y + radius > MAP_BOUNDS.maxY) {
      correctedY = MAP_BOUNDS.maxY - radius;
      collides = true;
      collidedWith = "bounds";
    }

    // Check against all colliders
    this.colliders.forEach((rect, id) => {
      if (excludeIds.includes(id)) return;

      if (this.circleRectCollision(correctedX, correctedY, radius, rect)) {
        collides = true;
        collidedWith = id;

        // Calculate correction
        const correction = this.getCollisionCorrection(
          correctedX,
          correctedY,
          radius,
          rect
        );
        correctedX = correction.x;
        correctedY = correction.y;
      }
    });

    return { collides, collidedWith, correctedX, correctedY };
  }

  /**
   * Check collision between a circle and a rectangle
   */
  private circleRectCollision(
    cx: number,
    cy: number,
    radius: number,
    rect: CollisionRect
  ): boolean {
    // Find closest point on rectangle to circle center
    const closestX = Phaser.Math.Clamp(cx, rect.x, rect.x + rect.width);
    const closestY = Phaser.Math.Clamp(cy, rect.y, rect.y + rect.height);

    // Calculate distance from circle center to closest point
    const dx = cx - closestX;
    const dy = cy - closestY;
    const distSquared = dx * dx + dy * dy;

    return distSquared < radius * radius;
  }

  /**
   * Get corrected position after collision
   */
  private getCollisionCorrection(
    cx: number,
    cy: number,
    radius: number,
    rect: CollisionRect
  ): { x: number; y: number } {
    // Find closest point on rectangle
    const closestX = Phaser.Math.Clamp(cx, rect.x, rect.x + rect.width);
    const closestY = Phaser.Math.Clamp(cy, rect.y, rect.y + rect.height);

    // Direction from closest point to circle center
    const dx = cx - closestX;
    const dy = cy - closestY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) {
      // Circle center is inside rectangle - push out based on nearest edge
      const toLeft = cx - rect.x;
      const toRight = rect.x + rect.width - cx;
      const toTop = cy - rect.y;
      const toBottom = rect.y + rect.height - cy;

      const minDist = Math.min(toLeft, toRight, toTop, toBottom);

      if (minDist === toLeft) return { x: rect.x - radius, y: cy };
      if (minDist === toRight)
        return { x: rect.x + rect.width + radius, y: cy };
      if (minDist === toTop) return { x: cx, y: rect.y - radius };
      return { x: cx, y: rect.y + rect.height + radius };
    }

    // Push circle out along the direction
    const overlap = radius - dist;
    const normX = dx / dist;
    const normY = dy / dist;

    return {
      x: cx + normX * overlap,
      y: cy + normY * overlap,
    };
  }

  /**
   * Check if a rectangle overlaps with any colliders
   */
  checkRectCollision(rect: CollisionRect, excludeIds: string[] = []): boolean {
    for (const [id, collider] of this.colliders) {
      if (excludeIds.includes(id)) continue;

      if (this.rectRectCollision(rect, collider)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Rectangle to rectangle collision
   */
  private rectRectCollision(a: CollisionRect, b: CollisionRect): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
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
   * Draw debug visualization of colliders
   */
  private drawDebug(): void {
    if (!this.debugGraphics) {
      this.debugGraphics = this.scene.add.graphics();
      this.debugGraphics.setDepth(1000);
    }

    this.debugGraphics.clear();

    // Draw colliders
    this.debugGraphics.lineStyle(2, 0xff0000, 0.5);
    this.colliders.forEach((rect) => {
      this.debugGraphics!.strokeRect(rect.x, rect.y, rect.width, rect.height);
    });

    // Draw bounds
    this.debugGraphics.lineStyle(2, 0x00ff00, 0.3);
    this.debugGraphics.strokeRect(
      MAP_BOUNDS.minX,
      MAP_BOUNDS.minY,
      MAP_BOUNDS.maxX - MAP_BOUNDS.minX,
      MAP_BOUNDS.maxY - MAP_BOUNDS.minY
    );
  }

  /**
   * Raycast from point in direction
   * Returns the first collision point or null
   */
  raycast(
    startX: number,
    startY: number,
    dirX: number,
    dirY: number,
    maxDistance: number = 1000
  ): { x: number; y: number; colliderId: string } | null {
    const steps = Math.ceil(maxDistance / 4); // Check every 4 pixels
    const stepX = (dirX / Math.sqrt(dirX * dirX + dirY * dirY)) * 4;
    const stepY = (dirY / Math.sqrt(dirX * dirX + dirY * dirY)) * 4;

    let x = startX;
    let y = startY;

    for (let i = 0; i < steps; i++) {
      x += stepX;
      y += stepY;

      for (const [id, rect] of this.colliders) {
        if (
          x >= rect.x &&
          x <= rect.x + rect.width &&
          y >= rect.y &&
          y <= rect.y + rect.height
        ) {
          return { x, y, colliderId: id };
        }
      }
    }

    return null;
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.colliders.clear();
    this.debugGraphics?.destroy();
  }
}
