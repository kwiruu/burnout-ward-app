/**
 * Tiled Map Loader
 * Loads and manages Tiled TMX maps
 */

export class TiledMapLoader {
  private scene: Phaser.Scene;
  private map: Phaser.Tilemaps.Tilemap | null = null;
  private layers: Map<string, Phaser.Tilemaps.TilemapLayer> = new Map();
  private tilesets: Phaser.Tilemaps.Tileset[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Load a Tiled map with multiple tilesets
   * @param mapKey - The key used when loading the tilemap JSON
   * @param tilesetConfigs - Array of {name, imageKey} for each tileset
   */
  loadMap(
    mapKey: string,
    tilesetConfigs: Array<{ name: string; imageKey: string }>
  ): void {
    // Create the tilemap from Tiled JSON
    this.map = this.scene.make.tilemap({ key: mapKey });

    console.log(`🗺️ Map created: ${mapKey}`);
    console.log(`📐 Map size: ${this.map.width}x${this.map.height} tiles`);
    console.log(`📏 Tile size: ${this.map.tileWidth}x${this.map.tileHeight}px`);
    console.log(`📑 Layers found: ${this.map.layers.length}`);
    console.log(
      `🎨 Tilesets in map: ${this.map.tilesets.map((t) => t.name).join(", ")}`
    );

    // Add all tilesets
    this.tilesets = [];
    for (const config of tilesetConfigs) {
      const tileset = this.map.addTilesetImage(config.name, config.imageKey);
      if (tileset) {
        this.tilesets.push(tileset);
        console.log(`✅ Added tileset: ${config.name}`);
      } else {
        console.error(
          `❌ Failed to load tileset: ${config.name} with imageKey: ${config.imageKey}`
        );
      }
    }

    if (this.tilesets.length === 0) {
      console.error("No tilesets loaded!");
      return;
    }

    // Create all tile layers with proper depth
    let layerIndex = 0;
    this.map.layers.forEach((layerData) => {
      console.log(
        `🔍 Processing layer: ${layerData.name} (type: ${
          layerData.tilemapLayer ? "tile" : "other"
        })`
      );

      // Pass all tilesets to createLayer
      const layer = this.map!.createLayer(layerData.name, this.tilesets);
      if (layer) {
        // Set depth based on layer order
        // Bottom layers (floor, walls) = 0-50
        // Player will be at 100
        // Top layers (furniture, roofs) = 150+
        const depth = layerIndex * 50;
        layer.setDepth(depth);

        this.layers.set(layerData.name, layer);
        console.log(`✅ Created layer: ${layerData.name} (depth: ${depth})`);
        layerIndex++;
      } else {
        console.error(`❌ Failed to create layer: ${layerData.name}`);
      }
    });

    console.log(`📊 Total layers created: ${this.layers.size}`);
  }

  /**
   * Get collision objects from object layer
   */
  getCollisionObjects(
    layerName: string = "colission"
  ): Phaser.Types.Tilemaps.TiledObject[] {
    if (!this.map) {
      console.error("Map not loaded!");
      return [];
    }

    const objectLayer = this.map.getObjectLayer(layerName);
    if (!objectLayer) {
      console.error(`Object layer "${layerName}" not found!`);
      return [];
    }

    return objectLayer.objects;
  }

  /**
   * Get all objects from a specific object layer
   */
  getObjects(layerName: string): Phaser.Types.Tilemaps.TiledObject[] {
    if (!this.map) return [];
    const objectLayer = this.map.getObjectLayer(layerName);
    return objectLayer ? objectLayer.objects : [];
  }

  /**
   * Get a specific layer
   */
  getLayer(layerName: string): Phaser.Tilemaps.TilemapLayer | undefined {
    return this.layers.get(layerName);
  }

  /**
   * Get the tilemap instance
   */
  getMap(): Phaser.Tilemaps.Tilemap | null {
    return this.map;
  }

  /**
   * Get map dimensions
   */
  getMapSize(): {
    width: number;
    height: number;
    tileWidth: number;
    tileHeight: number;
  } {
    if (!this.map) {
      return { width: 0, height: 0, tileWidth: 32, tileHeight: 32 };
    }

    return {
      width: this.map.width,
      height: this.map.height,
      tileWidth: this.map.tileWidth,
      tileHeight: this.map.tileHeight,
    };
  }

  /**
   * Destroy the map
   */
  destroy(): void {
    this.layers.clear();
    this.map?.destroy();
    this.map = null;
  }
}
