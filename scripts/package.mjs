import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, createWriteStream } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import { createGzip } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const distDir = join(root, "dist");
const outDir = join(root, "releases");

// Read current version
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf-8"));

// Optional: bump version via argument (patch, minor, major)
const bump = process.argv[2];
if (bump && ["patch", "minor", "major"].includes(bump)) {
  const parts = pkg.version.split(".").map(Number);
  if (bump === "patch") parts[2]++;
  if (bump === "minor") { parts[1]++; parts[2] = 0; }
  if (bump === "major") { parts[0]++; parts[1] = 0; parts[2] = 0; }
  const newVersion = parts.join(".");

  // Update package.json
  pkg.version = newVersion;
  writeFileSync(join(root, "package.json"), JSON.stringify(pkg, null, 2) + "\n");

  // Update manifest.json
  manifest.version = newVersion;
  writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  console.log(`Version bumped: ${bump} -> ${newVersion}`);
} else if (bump) {
  console.error(`Invalid bump type: "${bump}". Use: patch, minor, or major`);
  process.exit(1);
}

const version = pkg.version;
console.log(`\nBuilding SF Dev Toolkit v${version}...\n`);

// Build
execSync("npm run build", { cwd: root, stdio: "inherit" });

// Create ZIP using PowerShell (cross-platform on Windows)
mkdirSync(outDir, { recursive: true });
const zipName = `SF-Dev-Toolkit-v${version}.zip`;
const zipPath = join(outDir, zipName);

// Collect all files from dist (excluding .vite folder)
function getFiles(dir, base) {
  let files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(base, full);
    if (entry === ".vite") continue;
    if (statSync(full).isDirectory()) {
      files = files.concat(getFiles(full, base));
    } else {
      files.push(rel);
    }
  }
  return files;
}

// Use PowerShell to create ZIP
const psCommand = `powershell -Command "if (Test-Path '${zipPath.replace(/\\/g, "\\\\")}') { Remove-Item '${zipPath.replace(/\\/g, "\\\\")}' }; Compress-Archive -Path (Get-ChildItem '${distDir.replace(/\\/g, "\\\\")}' -Exclude '.vite') -DestinationPath '${zipPath.replace(/\\/g, "\\\\")}'"`;
execSync(psCommand, { stdio: "inherit" });

const files = getFiles(distDir, distDir);
console.log(`\n✓ Built ${files.length} files`);
console.log(`✓ Packaged: releases/${zipName}`);
console.log(`\nReady to upload to Chrome Web Store!`);
