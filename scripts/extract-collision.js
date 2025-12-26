/**
 * Extract Collision Data Script
 *
 * Extracts only collision objects from Tiled JSON into a simple format.
 */

const fs = require("fs");
const path = require("path");

const INPUT_FILE = path.join(__dirname, "../src/resources/map01.json");
const OUTPUT_FILE = path.join(__dirname, "../src/resources/collision.json");

console.log("=== Extracting Collision Data ===");

// Read the map
const mapData = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));

// Find the collision object layer
const collisionLayer = mapData.layers.find(
  (layer) => layer.type === "objectgroup" && layer.name === "colission"
);

if (!collisionLayer) {
  console.error('❌ No "colission" object layer found!');
  console.log(
    "Available layers:",
    mapData.layers.map((l) => `${l.name} (${l.type})`).join(", ")
  );
  process.exit(1);
}

// Extract collision objects
const collisionObjects = collisionLayer.objects.map((obj) => ({
  id: obj.id,
  name: obj.name || "",
  x: obj.x,
  y: obj.y,
  width: obj.width,
  height: obj.height,
  rotation: obj.rotation || 0,
  type: obj.type || "rectangle",
}));

// Create output
const output = {
  mapWidth: mapData.width * mapData.tilewidth,
  mapHeight: mapData.height * mapData.tileheight,
  tileWidth: mapData.tilewidth,
  tileHeight: mapData.tileheight,
  collision: collisionObjects,
};

// Write the clean collision JSON
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

console.log(`✅ Extracted ${collisionObjects.length} collision objects`);
console.log(`📐 Map size: ${output.mapWidth}x${output.mapHeight}px`);
console.log(`💾 Saved to: ${OUTPUT_FILE}`);
