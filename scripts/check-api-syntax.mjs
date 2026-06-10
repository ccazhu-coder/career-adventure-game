import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const roots = ["api", "lib"];
const files = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    if (entry.isFile() && full.endsWith(".js")) files.push(full);
  }
}

roots.forEach(walk);

for (const file of files) {
  await import(pathToFileURL(path.resolve(file)).href);
}

console.log(`API syntax ok: ${files.length} files`);

