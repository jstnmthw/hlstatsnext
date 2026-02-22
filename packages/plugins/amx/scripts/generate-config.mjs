#!/usr/bin/env node

/**
 * Auto-generates configs/hlstatsnext.cfg from create_cvar() calls in plugin source.
 * Run via: node scripts/generate-config.mjs
 * Wired into the build: pnpm run compile
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const SRC_DIR = join(import.meta.dirname, "..", "src");
const OUT_FILE = join(import.meta.dirname, "..", "configs", "hlstatsnext.cfg");

mkdirSync(dirname(OUT_FILE), { recursive: true });

// Collect all source files (.sma + .inc)
function collectSourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (entry.name.endsWith(".sma") || entry.name.endsWith(".inc")) {
      files.push(full);
    }
  }
  return files;
}

// Parse create_cvar() calls from source text
// Handles multi-line calls by first collapsing them
function parseCvars(source) {
  const cvars = [];

  // Collapse multi-line create_cvar calls into single lines
  // Match from create_cvar( to the closing );
  const pattern = /create_cvar\s*\(([\s\S]*?)\);/g;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    const argsRaw = match[1].replace(/\s+/g, " ").trim();
    const args = parseArgs(argsRaw);
    if (args.length < 2) continue;

    const name = unquote(args[0]);
    const defaultVal = unquote(args[1]);
    const flags = args[2] || "FCVAR_NONE";
    const description = args[3] ? unquote(args[3]) : "";
    const hasMin = args[4] === "true";
    const minVal = args[5] || "";
    const hasMax = args[6] === "true";
    const maxVal = args[7] || "";

    cvars.push({ name, defaultVal, flags, description, hasMin, minVal, hasMax, maxVal });
  }

  return cvars;
}

// Parse comma-separated arguments respecting quotes and nested parens
function parseArgs(str) {
  const args = [];
  let current = "";
  let depth = 0;
  let inString = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"' && str[i - 1] !== "\\") {
      inString = !inString;
      current += ch;
    } else if (!inString && ch === "(") {
      depth++;
      current += ch;
    } else if (!inString && ch === ")") {
      depth--;
      current += ch;
    } else if (!inString && depth === 0 && ch === ",") {
      args.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function unquote(s) {
  s = s.trim();
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  return s;
}

// Group cvars by section based on flags/name patterns
function categorize(cvar) {
  if (cvar.flags.includes("FCVAR_PROTECTED")) return "Authentication";
  if (cvar.name.startsWith("hlmsg_")) return "HUD Settings";
  return "Core Settings";
}

// Generate the .cfg file content
function generate(cvars) {
  const lines = [
    "// HLStatsNext Plugin Configuration",
    "// Auto-generated from plugin source — do not edit by hand.",
    "//",
    "// This file mirrors what AutoExecConfig generates at:",
    "//   addons/amxmodx/configs/plugins/hlstatsnext.cfg",
    "//",
    "// Copy this file to your server's configs/plugins/ folder,",
    "// or paste these values into server.cfg or amxx.cfg.",
    "",
  ];

  // Group by section
  const sections = new Map();
  for (const cvar of cvars) {
    const section = categorize(cvar);
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section).push(cvar);
  }

  // Desired section order
  const order = ["Authentication", "Core Settings", "HUD Settings"];
  for (const section of order) {
    const entries = sections.get(section);
    if (!entries) continue;

    lines.push(`// --- ${section} ---`);
    lines.push("");

    for (const cvar of entries) {
      if (cvar.description) {
        lines.push(`// ${cvar.description}`);
      }

      let meta = `// Default: "${cvar.defaultVal}"`;
      if (cvar.hasMin) meta += `   Min: "${cvar.minVal}"`;
      if (cvar.hasMax) meta += `   Max: "${cvar.maxVal}"`;
      lines.push(meta);

      lines.push(`${cvar.name} "${cvar.defaultVal}"`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

// Main
const files = collectSourceFiles(SRC_DIR);
let allCvars = [];

for (const file of files) {
  const source = readFileSync(file, "utf-8");
  allCvars.push(...parseCvars(source));
}

if (allCvars.length === 0) {
  console.error("No create_cvar() calls found in source files");
  process.exit(1);
}

const output = generate(allCvars);
writeFileSync(OUT_FILE, output);
console.log(`Generated ${OUT_FILE} with ${allCvars.length} cvars`);
