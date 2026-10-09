import { loadConfig, configPath } from "./config.js";
import { checkHealth, generateOne, saveImages } from "./api.js";
import { KNOWN_TOOLS, TOOL_IDS, resolveTools, listToolsText } from "./constants.js";

function printHelp() {
  console.log(`aitoolbox-img — AI Tool Box 生图 (via POST /api/gen_image on :3920)

Usage:
  aitoolbox-img "your prompt here" [options]

Options:
  --count N            Run the prompt N times per source (default: 1).
  --output DIR         Override outputDir from config.json.
  --tool-id ID[,ID..]  Comma-separated tool IDs (default: gemini-image).
                       Examples: gemini-image  /  gemini-image,jimeng,wanxiang
                       Run --list-tools to see all 15 supported sources.
  --timeout-ms MS      Per-request timeout in ms (default: 180000).
  --api-base URL       Override apiBase from config.json.
  --ref PATH           Reference image (file path) — sent as base64.
  --verbose            Print extra debug logs to stderr.
  --health             Call /api/health and print the response, then exit.
  --list-tools         Print all supported tool IDs and exit.
  --show-config        Print the resolved config path and exit.
  -h, --help           Show this help.

Multi-source example:
  aitoolbox-img "Studio shot of a boxer brief" --tool-id gemini-image,jimeng,wanxiang --count 2
    → 6 images total (2 per source)

Config file: ${configPath()}
`);
}

function parseArgs(argv) {
  const opts = {
    count: 1,
    output: null,
    toolId: null,
    timeoutMs: null,
    apiBase: null,
    ref: null,
    verbose: false,
    prompt: null,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
      case "--count":
      case "-n":
        opts.count = parseInt(argv[++i], 10);
        if (!Number.isFinite(opts.count) || opts.count < 1) {
          throw new Error("--count must be a positive integer");
        }
        break;
      case "--output":
      case "-o":
        opts.output = argv[++i];
        break;
      case "--tool-id":
        opts.toolId = argv[++i];
        break;
      case "--timeout-ms":
        opts.timeoutMs = parseInt(argv[++i], 10);
        break;
      case "--api-base":
        opts.apiBase = argv[++i];
        break;
      case "--ref":
        opts.ref = argv[++i];
        break;
      case "--verbose":
        opts.verbose = true;
        break;
      case "--health":
        opts.health = true;
        break;
      case "--show-config":
        console.log(configPath());
        process.exit(0);
      case "--list-tools":
        console.log("Supported AI Tool Box image sources:");
        console.log(listToolsText());
        process.exit(0);
      default:
        if (a.startsWith("-")) {
          throw new Error(`Unknown option: ${a}`);
        }
        positional.push(a);
    }
  }
  opts.prompt = positional.join(" ").trim();
  return opts;
}

function makeLogger(verbose) {
  const log = (...args) => console.log(...args);
  const warn = (...args) => console.warn(...args);
  const debug = verbose ? (...args) => console.error("[debug]", ...args) : () => {};
  return { log, warn, debug };
}

function slugify(s, max = 50) {
  return (
    String(s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max) || "image"
  );
}

async function loadReferenceImage(refPath) {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const buf = await fs.readFile(refPath);
  const ext = path.extname(refPath).slice(1).toLowerCase() || "png";
  const mimeMap = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
  return {
    referenceImageBase64: buf.toString("base64"),
    referenceImageMimeType: mimeMap[ext] || "image/png",
    referenceImageName: path.basename(refPath),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.health) {
    const cfg = await loadConfig();
    const data = await checkHealth({ apiBase: opts.apiBase || cfg.apiBase, apiToken: cfg.apiToken });
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  }

  if (!opts.prompt) {
    printHelp();
    process.exit(1);
  }

  const cfg = await loadConfig({
    apiBase: opts.apiBase,
    outputDir: opts.output,
  });
  const logger = makeLogger(opts.verbose);

  const requestedTools = resolveTools(opts.toolId || cfg.toolId);
  if (requestedTools.length === 0) {
    throw new Error("No toolId resolved. Pass --tool-id or set toolId in config.json.");
  }
  const unknown = requestedTools.filter((t) => !TOOL_IDS.has(t));
  if (unknown.length > 0) {
    logger.warn(
      `[cli] unknown tool id(s): ${unknown.join(", ")} — run --list-tools for the full list. Continuing anyway.`,
    );
  }

  logger.log(`[cli] api:        ${cfg.apiBase}`);
  logger.log(`[cli] outputDir:  ${cfg.outputDir}`);
  logger.log(`[cli] tools:      ${requestedTools.join(", ")}`);
  logger.log(`[cli] count:      ${opts.count} per source (API handles variations in one call)`);

  try {
    const health = await checkHealth({ apiBase: cfg.apiBase, apiToken: cfg.apiToken, logger });
    logger.log(`[cli] health OK (${health.toolId || "image-gen"} on ${health.host || cfg.apiBase})`);
  } catch (err) {
    throw new Error(
      `AI Tool Box API not reachable at ${cfg.apiBase}: ${err.message}\n` +
        `Start AI Tool Box (pnpm dev or the installed app) and make sure it's listening on ${cfg.apiBase}.`,
    );
  }

  const refData = opts.ref ? await loadReferenceImage(opts.ref) : null;
  const slug = slugify(opts.prompt);
  const allPaths = [];
  let lastError = null;

  for (const toolId of requestedTools) {
    const label = `${toolId}`;
    const baseTimeout = opts.timeoutMs || cfg.timeoutMs;
    const perCallTimeout = baseTimeout * Math.max(1, Math.ceil(opts.count / 2));
    let attempt = 0;
    const maxAttempts = 3;
    let saved = [];
    while (attempt < maxAttempts && saved.length < opts.count) {
      attempt++;
      const tag = `[${label}]${attempt > 1 ? ` retry ${attempt}/${maxAttempts}` : ""}`;
      try {
        logger.log(`${tag} requesting ${opts.count} image(s) (timeout ${perCallTimeout}ms)...`);
        const data = await generateOne({
          apiBase: cfg.apiBase,
          apiToken: cfg.apiToken,
          prompt: opts.prompt,
          toolId,
          count: opts.count,
          timeoutMs: perCallTimeout,
          ...(refData || {}),
        });
        const images = data.images || [];
        if (images.length === 0) {
          logger.warn(`${tag} no images in response`);
          break;
        }
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        saved = await saveImages(images, cfg.outputDir, `${slug}-${toolId}`, ts);
        for (const p of saved) {
          console.log(p);
          logger.log(`${tag} saved ${p}`);
        }
        if (saved.length < opts.count) {
          logger.warn(`${tag} API returned ${saved.length}/${opts.count} images`);
        }
      } catch (err) {
        lastError = err;
        const cause = err.cause ? ` (${err.cause.code || err.cause.message || ""})` : "";
        logger.warn(`${tag} attempt ${attempt}/${maxAttempts} failed: ${err.message}${cause}`);
        if (attempt < maxAttempts) {
          const waitMs = 5000 * attempt;
          logger.warn(`${tag} waiting ${waitMs / 1000}s before retry`);
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }
    }
    allPaths.push(...saved);
    const isLast = requestedTools.indexOf(toolId) === requestedTools.length - 1;
    if (!isLast) {
      const coolMs = 3000;
      logger.log(`cooling ${coolMs / 1000}s before next source`);
      await new Promise((r) => setTimeout(r, coolMs));
    }
  }

  if (allPaths.length === 0) {
    logger.warn(`[cli] no images produced`);
    if (lastError && lastError.payload) {
      logger.warn(`[cli] last error payload: ${JSON.stringify(lastError.payload)}`);
    }
    process.exit(2);
  }

  logger.log(`[cli] done. ${allPaths.length} image(s) saved.`);
}

main().catch((err) => {
  console.error(`[cli] fatal: ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});