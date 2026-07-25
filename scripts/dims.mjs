import sharp from "sharp";
import { readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const base = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "images");

async function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      await walk(p);
      continue;
    }
    if (f.endsWith(".webp")) {
      const m = await sharp(p).metadata();
      console.log(relative(base, p).replace(/\\/g, "/"), `${m.width}x${m.height}`);
    }
  }
}
await walk(base);
