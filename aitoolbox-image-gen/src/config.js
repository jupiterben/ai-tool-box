import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CONFIG = {
  apiBase: "http://127.0.0.1:3920",
  apiToken: "",
  toolId: "gemini-image",
  outputDir: "./images",
  timeoutMs: 180000,
};

export async function loadConfig(overrides = {}) {
  const configPath = path.join(__dirname, "..", "config.json");
  let fileCfg = {};
  try {
    const raw = await readFile(configPath, "utf8");
    fileCfg = JSON.parse(raw);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  const cleanedOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );

  const cfg = { ...DEFAULT_CONFIG, ...fileCfg, ...cleanedOverrides };

  cfg.outputDir = path.resolve(cfg.outputDir);

  if (!/^https?:\/\//.test(cfg.apiBase)) {
    throw new Error(`Invalid apiBase: ${cfg.apiBase}`);
  }

  return cfg;
}

export function configPath() {
  return path.join(__dirname, "..", "config.json");
}