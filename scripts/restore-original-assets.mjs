import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "client", "assets-source");
const publicDir = path.join(root, "client", "public");
const expectedSha256 = "5eb75c8be8252bd0c16b1d2f716efae1bea4d2075b50d45f949cc8255b4cca16";

const chunks = fs.readdirSync(sourceDir)
  .filter((name) => name.startsWith("original-web.b64."))
  .sort();

if (chunks.length !== 12) {
  throw new Error(`Expected 12 original visual chunks, found ${chunks.length}.`);
}

const archive = Buffer.from(chunks.map((name) => fs.readFileSync(path.join(sourceDir, name), "utf8").trim()).join(""), "base64");
const actualSha256 = crypto.createHash("sha256").update(archive).digest("hex");
if (actualSha256 !== expectedSha256) {
  throw new Error(`Original visual bundle checksum mismatch: ${actualSha256}`);
}

const tar = gunzipSync(archive);
const targetRoot = path.join(publicDir, "assets", "original");
fs.rmSync(targetRoot, { recursive: true, force: true });

let offset = 0;
let restored = 0;
while (offset + 512 <= tar.length) {
  const header = tar.subarray(offset, offset + 512);
  if (header.every((byte) => byte === 0)) break;

  const readString = (start, end) => header.subarray(start, end).toString("utf8").replace(/\0.*$/s, "");
  const name = readString(0, 100);
  const prefix = readString(345, 500);
  const archivePath = prefix ? `${prefix}/${name}` : name;
  const size = Number.parseInt(readString(124, 136).trim() || "0", 8);
  const type = String.fromCharCode(header[156] || 48);
  offset += 512;

  const normalized = archivePath.replace(/^\.\//, "").replace(/^\/+/, "");
  if (!normalized.startsWith("assets/original")) {
    throw new Error(`Unexpected path in visual bundle: ${archivePath}`);
  }

  const target = path.resolve(publicDir, normalized);
  if (!target.startsWith(path.resolve(publicDir) + path.sep)) {
    throw new Error(`Unsafe path in visual bundle: ${archivePath}`);
  }

  if (type === "5") {
    fs.mkdirSync(target, { recursive: true });
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, tar.subarray(offset, offset + size));
    restored += 1;
  }
  offset += Math.ceil(size / 512) * 512;
}

if (restored !== 7) throw new Error(`Expected 7 restored visuals, got ${restored}.`);

const stagePath = path.join(root, "client", "src", "game", "StageController.ts");
const generatedStagePath = path.join(root, "client", "src", "game", "StageController.generated.ts");
const stage = fs.readFileSync(stagePath, "utf8");
const oldAssets = `const ASSET_BASE = \`\${import.meta.env.BASE_URL}assets/\`;\nconst BACKGROUND_URL = \`\${ASSET_BASE}nursery-night.svg\`;\nconst LOGO_URL = \`\${ASSET_BASE}logo.svg\`;\nconst EVENT_IMAGE_BY_ID: Record<string, string> = {\n  cacapocalypse: \`\${ASSET_BASE}event-diaper.svg\`,\n  doudou: \`\${ASSET_BASE}event-plush.svg\`,\n};`;
const newAssets = `const ASSET_BASE = \`\${import.meta.env.BASE_URL}assets/original/\`;\nconst BACKGROUND_URL = \`\${ASSET_BASE}fond-nurserie-nocturne.webp\`;\nconst LOGO_URL = \`\${ASSET_BASE}logo-bebe-reigns.webp\`;\nconst EVENT_IMAGE_BY_ID: Record<string, string> = {\n  cacapocalypse: \`\${ASSET_BASE}cacapocalypse-nocturne.webp\`,\n  doudou: \`\${ASSET_BASE}rituel-du-doudou.webp\`,\n  veilleuse: \`\${ASSET_BASE}veilleuse-fait-son-show.webp\`,\n  \"berceuse-en-boucle\": \`\${ASSET_BASE}concert-des-soupirs.webp\`,\n  \"reveil-parent\": \`\${ASSET_BASE}reveil-trop-tot.webp\`,\n};`;

if (!stage.includes(oldAssets)) {
  throw new Error("StageController asset block changed; update the original-asset generator.");
}
fs.writeFileSync(generatedStagePath, stage.replace(oldAssets, newAssets));
console.log(`Restored ${restored} original Baby Reigns visuals.`);
