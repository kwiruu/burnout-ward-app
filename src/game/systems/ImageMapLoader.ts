/**
 * Image Map Loader
 *
 * Loads map layers as pre-rendered images (exported from Tiled)
 * and collision data from a simple JSON file.
 *
 * This is simpler and avoids tileset size limitations.
 */

export interface LayerConfig {
  name: string;
  imageKey: string;
  depth: number;
}

export interface CollisionObject {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  type: string;
}

export interface CollisionData {
  mapWidth: number;
  mapHeight: number;
  tileWidth: number;
  tileHeight: number;
  collision: CollisionObject[];
}

export class ImageMapLoader {
  private scene: Phaser.Scene;
  private layers: Map<string, Phaser.GameObjects.Image> = new Map();
  private collisionData: CollisionData | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Load map layers as images
   */
  loadLayers(
    layerConfigs: LayerConfig[],
    offsetX: number = 0,
    offsetY: number = 0
  ): void {
    layerConfigs.forEach((config) => {
      // Create image at offset position with top-left anchor
      const image = this.scene.add.image(offsetX, offsetY, config.imageKey);
      image.setOrigin(0, 0);
      image.setDepth(config.depth);

      this.layers.set(config.name, image);
      console.log(
        `✅ Created layer image: ${config.name} (depth: ${config.depth})`
      );
    });

    console.log(`📊 Total layer images created: ${this.layers.size}`);
  }

  /**
   * Load collision data from simple JSON (not Tiled format)
   */
  loadCollisionData(data: CollisionData): void {
    this.collisionData = data;
    console.log(`🗺️ Collision data loaded`);
    console.log(`📐 Map size: ${data.mapWidth}x${data.mapHeight}px`);
    console.log(`📦 Collision objects: ${data.collision.length}`);
  }

  /**
   * Get collision objects
   */
  getCollisionObjects(): CollisionObject[] {
    if (!this.collisionData) {
      console.error("Collision data not loaded! Call loadCollisionData first.");
      return [];
    }
    return this.collisionData.collision;
  }

  /**
   * Get a layer image
   */
  getLayer(name: string): Phaser.GameObjects.Image | undefined {
    return this.layers.get(name);
  }

  /**
   * Get map size in pixels
   */
  getMapSize(): { width: number; height: number } {
    if (this.collisionData) {
      return {
        width: this.collisionData.mapWidth,
        height: this.collisionData.mapHeight,
      };
    }

    // Try to get from first layer image
    const firstLayer = this.layers.values().next().value;
    if (firstLayer) {
      return {
        width: firstLayer.width,
        height: firstLayer.height,
      };
    }

    return { width: 960, height: 1312 }; // Default fallback
  }

  /**
   * Destroy all layers
   */
  destroy(): void {
    this.layers.forEach((layer) => layer.destroy());
    this.layers.clear();
    this.collisionData = null;
  }
}
