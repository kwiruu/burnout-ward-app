/**
 * Fix Tileset Offset Script
 *
 * After trimming rows from the TOP of Interiors_32x32.png,
 * this script adjusts all tile IDs in the map JSON.
 */

const fs = require("fs");
const path = require("path");

// Configuration
const MAP_FILE = path.join(__dirname, "../src/resources/map01.json");
const OUTPUT_FILE = path.join(__dirname, "../src/resources/map01.json"); // Overwrite

// Original tileset info
const ORIGINAL_HEIGHT = 34048;
const NEW_HEIGHT = 5232;
const TILE_SIZE = 32;
const TILESET_WIDTH = 512;
const TILES_PER_ROW = TILESET_WIDTH / TILE_SIZE; // 16

// Calculate offset
const PIXELS_REMOVED = ORIGINAL_HEIGHT - NEW_HEIGHT; // 28816
const ROWS_REMOVED = Math.floor(PIXELS_REMOVED / TILE_SIZE); // 900
const TILE_OFFSET = ROWS_REMOVED * TILES_PER_ROW; // 14400

// Interiors tileset range (firstgid=1 in original)
const INTERIORS_FIRST_GID = 1;
const INTERIORS_ORIGINAL_TILE_COUNT =
  Math.floor(ORIGINAL_HEIGHT / TILE_SIZE) * TILES_PER_ROW; // 17024
const INTERIORS_NEW_TILE_COUNT =
  Math.floor(NEW_HEIGHT / TILE_SIZE) * TILES_PER_ROW;

// Room_Builder starts after Interiors
const ROOM_BUILDER_ORIGINAL_FIRST_GID = INTERIORS_ORIGINAL_TILE_COUNT + 1; // 17025

console.log("=== Tileset Offset Fixer ===");
console.log(`Rows removed from top: ${ROWS_REMOVED}`);
console.log(`Tile offset: ${TILE_OFFSET}`);
console.log(
  `Interiors tiles: ${INTERIORS_ORIGINAL_TILE_COUNT} → ${INTERIORS_NEW_TILE_COUNT}`
);
console.log(
  `Room_Builder original firstgid: ${ROOM_BUILDER_ORIGINAL_FIRST_GID}`
);
console.log("");

// Read the map
const mapData = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));

let tilesFixed = 0;
let tilesRemoved = 0;
let roomBuilderFixed = 0;

// Process each layer
mapData.layers.forEach((layer) => {
  if (layer.data && Array.isArray(layer.data)) {
    layer.data = layer.data.map((tileId) => {
      if (tileId === 0) return 0; // Empty tile

      // Check if it's a Room_Builder tile (needs firstgid adjustment)
      if (tileId >= ROOM_BUILDER_ORIGINAL_FIRST_GID) {
        // Adjust Room_Builder firstgid since Interiors is now smaller
        const newFirstGid = INTERIORS_NEW_TILE_COUNT + 1;
        const offset = tileId - ROOM_BUILDER_ORIGINAL_FIRST_GID;
        roomBuilderFixed++;
        return newFirstGid + offset;
      }

      // Check if it's an Interiors tile
      if (
        tileId >= INTERIORS_FIRST_GID &&
        tileId < ROOM_BUILDER_ORIGINAL_FIRST_GID
      ) {
        // Check if this tile was in the removed section
        if (tileId <= TILE_OFFSET) {
          // This tile no longer exists! Set to 0 (empty)
          tilesRemoved++;
          return 0;
        }

        // Adjust the tile ID
        tilesFixed++;
        return tileId - TILE_OFFSET;
      }

      return tileId;
    });
  }
});

// Update the tilesets array
mapData.tilesets.forEach((tileset) => {
  if (tileset.name === "Interiors_32x32") {
    tileset.imageheight = NEW_HEIGHT;
    tileset.tilecount = INTERIORS_NEW_TILE_COUNT;
    console.log(
      `Updated Interiors_32x32: tilecount=${INTERIORS_NEW_TILE_COUNT}, imageheight=${NEW_HEIGHT}`
    );
  }

  if (tileset.name === "Room_Builder_32x32") {
    const newFirstGid = INTERIORS_NEW_TILE_COUNT + 1;
    console.log(
      `Updated Room_Builder_32x32: firstgid ${tileset.firstgid} → ${newFirstGid}`
    );
    tileset.firstgid = newFirstGid;
  }
});

// Write the fixed map
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(mapData, null, 1));

console.log("");
console.log("=== Results ===");
console.log(`Interiors tiles adjusted: ${tilesFixed}`);
console.log(`Tiles removed (no longer exist): ${tilesRemoved}`);
console.log(`Room_Builder tiles adjusted: ${roomBuilderFixed}`);
console.log(`Saved to: ${OUTPUT_FILE}`);

if (tilesRemoved > 0) {
  console.log("");
  console.log(
    "⚠️  WARNING: Some tiles were removed because they no longer exist in the trimmed tileset!"
  );
  console.log("    You may need to repaint those areas in Tiled.");
}
