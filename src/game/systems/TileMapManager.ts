/**
 * Tile Map Manager
 *
 * Renders the ER map based on configuration.
 * Easy to swap out for a Tiled JSON tilemap later.
 */

import {
  ROOMS,
  WALLS,
  DOOR_POSITIONS,
  FURNITURE,
  MAP_COLORS,
  RoomDefinition,
  FurnitureItem,
} from "../config/ERMapConfig";

export class TileMapManager {
  private scene: Phaser.Scene;
  private floorLayer!: Phaser.GameObjects.Graphics;
  private wallLayer!: Phaser.GameObjects.Graphics;
  private decorLayer!: Phaser.GameObjects.Container;
  private labelsContainer!: Phaser.GameObjects.Container;

  // Store references for potential future updates
  private roomGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private furnitureSprites: Map<
    string,
    Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle
  > = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Create the entire map
   */
  create(): void {
    // Create layers in order (back to front)
    this.createFloorLayer();
    this.createRooms();
    this.createWalls();
    this.createDoors();
    this.createFurniture();
    this.createRoomLabels();
  }

  /**
   * Create base floor
   */
  private createFloorLayer(): void {
    this.floorLayer = this.scene.add.graphics();
    this.floorLayer.setDepth(0);

    // Fill entire playable area with default floor
    this.floorLayer.fillStyle(MAP_COLORS.FLOOR_DEFAULT, 1);
    this.floorLayer.fillRect(50, 50, 924, 404);
  }

  /**
   * Create room floors with highlights
   */
  private createRooms(): void {
    ROOMS.forEach((room) => {
      const graphics = this.scene.add.graphics();
      graphics.setDepth(1);

      const { x, y, width, height } = room.bounds;

      // Room floor
      graphics.fillStyle(room.floorColor, 1);
      graphics.fillRect(x, y, width, height);

      // Room highlight overlay
      graphics.fillStyle(room.highlightColor, room.highlightAlpha);
      graphics.fillRect(x, y, width, height);

      // Room border
      graphics.lineStyle(2, room.highlightColor, 0.5);
      graphics.strokeRect(x, y, width, height);

      this.roomGraphics.set(room.id, graphics);
    });
  }

  /**
   * Create walls (visual only - collision handled separately)
   */
  private createWalls(): void {
    this.wallLayer = this.scene.add.graphics();
    this.wallLayer.setDepth(5);

    // Draw walls with a subtle 3D effect
    WALLS.forEach((wall) => {
      // Wall shadow
      this.wallLayer.fillStyle(0x0a0a0a, 0.5);
      this.wallLayer.fillRect(wall.x + 2, wall.y + 2, wall.width, wall.height);

      // Wall main
      this.wallLayer.fillStyle(MAP_COLORS.WALL_PRIMARY, 1);
      this.wallLayer.fillRect(wall.x, wall.y, wall.width, wall.height);
    });
  }

  /**
   * Create door visuals
   */
  private createDoors(): void {
    DOOR_POSITIONS.forEach((door) => {
      const doorGraphics = this.scene.add.graphics();
      doorGraphics.setDepth(6);

      // Door frame
      doorGraphics.fillStyle(0x4a4a6a, 1);
      doorGraphics.fillRect(door.x, door.y, door.width, door.height);

      // Door gap (shows floor beneath)
      doorGraphics.fillStyle(MAP_COLORS.FLOOR_DEFAULT, 1);
      const inset = 1;
      doorGraphics.fillRect(
        door.x + inset,
        door.y + inset,
        door.width - inset * 2,
        door.height - inset * 2
      );
    });
  }

  /**
   * Create furniture sprites
   */
  private createFurniture(): void {
    this.decorLayer = this.scene.add.container(0, 0);
    this.decorLayer.setDepth(10);

    FURNITURE.forEach((item) => {
      const furniture = this.createFurnitureItem(item);
      this.decorLayer.add(furniture);
      this.furnitureSprites.set(item.id, furniture);
    });
  }

  /**
   * Create individual furniture item
   */
  private createFurnitureItem(
    item: FurnitureItem
  ): Phaser.GameObjects.Rectangle {
    const colors: Record<FurnitureItem["type"], number> = {
      desk: 0x8b4513,
      chair: 0x696969,
      table: 0xa0522d,
      vending: 0x2f4f4f,
      plant: 0x228b22,
      monitor: 0x1a1a2e,
    };

    const rect = this.scene.add.rectangle(
      item.x,
      item.y,
      item.width,
      item.height,
      colors[item.type],
      0.8
    );

    rect.setStrokeStyle(1, 0x000000, 0.5);
    rect.setData("furnitureId", item.id);
    rect.setData("furnitureType", item.type);
    rect.setData("isInteractable", item.isInteractable);

    return rect;
  }

  /**
   * Create room labels
   */
  private createRoomLabels(): void {
    this.labelsContainer = this.scene.add.container(0, 0);
    this.labelsContainer.setDepth(15);

    const labelStyle = {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#888888",
    };

    ROOMS.forEach((room) => {
      const { x, y, width } = room.bounds;
      const centerX = x + width / 2;

      const label = this.scene.add.text(
        centerX,
        y + 10,
        `${room.emoji} ${room.name}`,
        labelStyle
      );
      label.setOrigin(0.5, 0);
      label.setData("roomId", room.id);

      this.labelsContainer.add(label);
    });
  }

  /**
   * Get room definition at a position
   */
  getRoomAt(x: number, y: number): RoomDefinition | undefined {
    return ROOMS.find((room) => {
      const b = room.bounds;
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
    });
  }

  /**
   * Highlight a room (for visual feedback)
   */
  highlightRoom(roomId: string, highlight: boolean = true): void {
    const room = ROOMS.find((r) => r.id === roomId);
    const graphics = this.roomGraphics.get(roomId);

    if (!room || !graphics) return;

    graphics.clear();
    const { x, y, width, height } = room.bounds;

    // Redraw room
    graphics.fillStyle(room.floorColor, 1);
    graphics.fillRect(x, y, width, height);

    // Highlight overlay (stronger when highlighted)
    const alpha = highlight ? 0.3 : room.highlightAlpha;
    graphics.fillStyle(room.highlightColor, alpha);
    graphics.fillRect(x, y, width, height);

    // Border
    const borderAlpha = highlight ? 1 : 0.5;
    graphics.lineStyle(highlight ? 3 : 2, room.highlightColor, borderAlpha);
    graphics.strokeRect(x, y, width, height);
  }

  /**
   * Get furniture item at position
   */
  getFurnitureAt(x: number, y: number): FurnitureItem | undefined {
    return FURNITURE.find((item) => {
      const halfW = item.width / 2;
      const halfH = item.height / 2;
      return (
        x >= item.x - halfW &&
        x <= item.x + halfW &&
        y >= item.y - halfH &&
        y <= item.y + halfH
      );
    });
  }

  /**
   * Destroy all map elements
   */
  destroy(): void {
    this.floorLayer?.destroy();
    this.wallLayer?.destroy();
    this.decorLayer?.destroy();
    this.labelsContainer?.destroy();
    this.roomGraphics.forEach((g) => g.destroy());
    this.roomGraphics.clear();
    this.furnitureSprites.clear();
  }
}
