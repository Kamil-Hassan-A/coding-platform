import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const frontendDist = resolve("frontend", "dist");
const rootDist = resolve("dist");

if (!existsSync(frontendDist)) {
  console.error("frontend/dist was not found. Ensure frontend build completed successfully.");
  process.exit(1);
}

rmSync(rootDist, { recursive: true, force: true });
mkdirSync(rootDist, { recursive: true });
cpSync(frontendDist, rootDist, { recursive: true });

console.log("Prepared dist/ from frontend/dist for Cloudflare Pages deployment.");
