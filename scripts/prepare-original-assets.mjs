import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "client/src/game/assets");
const publicDir = path.join(root, "client/public/assets");
const originalDir = path.join(publicDir, "original");

const assets = [
  ["fond_nurserie_nocturne.ts", "fond-nurserie-nocturne.webp"],
  ["logo_bebe_reigns.ts", "logo-bebe-reigns.webp"],
  ["cacapocalypse_nocturne.ts", "cacapocalypse-nocturne.webp"],
  ["rituel_du_doudou.ts", "rituel-du-doudou.webp"],
  ["veilleuse_fait_son_show.ts", "veilleuse-fait-son-show.webp"],
  ["concert_des_soupirs.ts", "concert-des-soupirs.webp"],
  ["reveil_trop_tot.ts", "reveil-trop-tot.webp"],
];

await mkdir(originalDir, { recursive: true });

for (const [sourceName, outputName] of assets) {
  const source = await readFile(path.join(sourceDir, sourceName), "utf8");
  const match = source.match(/data:image\/webp;base64,([^\"]+)/);
  if (!match) throw new Error(`No WebP data URL found in ${sourceName}`);
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length < 1000) throw new Error(`Decoded asset is unexpectedly small: ${sourceName}`);
  await writeFile(path.join(originalDir, outputName), bytes);
  console.log(`restored ${outputName} (${bytes.length} bytes)`);
}

function svgImage(relativeWebp, mode = "meet") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1000 1000" preserveAspectRatio="none"><image href="${relativeWebp}" x="0" y="0" width="1000" height="1000" preserveAspectRatio="xMidYMid ${mode}"/></svg>\n`;
}

// Keep the stable URLs already used by StageController while serving the original artwork.
await writeFile(path.join(publicDir, "nursery-night.svg"), svgImage("original/fond-nurserie-nocturne.webp", "slice"));
await writeFile(path.join(publicDir, "logo.svg"), svgImage("original/logo-bebe-reigns.webp", "meet"));
await writeFile(path.join(publicDir, "event-diaper.svg"), svgImage("original/cacapocalypse-nocturne.webp", "meet"));
await writeFile(path.join(publicDir, "event-plush.svg"), svgImage("original/rituel-du-doudou.webp", "meet"));
await writeFile(path.join(publicDir, "event-veilleuse.svg"), svgImage("original/veilleuse-fait-son-show.webp", "meet"));
await writeFile(path.join(publicDir, "event-concert.svg"), svgImage("original/concert-des-soupirs.webp", "meet"));
await writeFile(path.join(publicDir, "event-reveil.svg"), svgImage("original/reveil-trop-tot.webp", "meet"));

// The current game has more events than the original prototype. Restore artwork only where an original valid image exists.
const stagePath = path.join(root, "client/src/game/StageController.ts");
let stage = await readFile(stagePath, "utf8");
const mapping = `const EVENT_IMAGE_BY_ID: Record<string, string> = {\n  cacapocalypse: \`${"${ASSET_BASE}"}event-diaper.svg\`,\n  doudou: \`${"${ASSET_BASE}"}event-plush.svg\`,\n  veilleuse: \`${"${ASSET_BASE}"}event-veilleuse.svg\`,\n  "berceuse-en-boucle": \`${"${ASSET_BASE}"}event-concert.svg\`,\n  "reveil-parent": \`${"${ASSET_BASE}"}event-reveil.svg\`,\n};`;
const replaced = stage.replace(/const EVENT_IMAGE_BY_ID: Record<string, string> = \{[\s\S]*?\};/, mapping);
if (replaced === stage) throw new Error("Could not update EVENT_IMAGE_BY_ID mapping in StageController.ts");
await writeFile(stagePath, replaced);
console.log("restored original artwork mapping for 5 game events");
