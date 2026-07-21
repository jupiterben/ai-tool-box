import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_API_BASE = "http://127.0.0.1:3920";
const DEFAULT_TOOL_ID = "gemini-image";
const DEFAULT_TIMEOUT_MS = 180000;

function authHeaders(token) {
  if (!token) return {};
  return {
    "X-Api-Token": token,
    Authorization: `Bearer ${token}`,
  };
}

export async function checkHealth({ apiBase = DEFAULT_API_BASE, apiToken, logger = console } = {}) {
  const res = await fetch(`${apiBase}/api/health`, {
    headers: { ...authHeaders(apiToken) },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`health check HTTP ${res.status} ${await res.text().catch(() => "")}`);
  }
  return res.json();
}

export async function generateOne({
  apiBase = DEFAULT_API_BASE,
  apiToken,
  prompt,
  toolId = DEFAULT_TOOL_ID,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  count = 1,
  referenceImage,
  referenceImageBase64,
  referenceImageMimeType,
  referenceImageName,
  fetchImpl = fetch,
}) {
  const body = { toolId, prompt, timeoutMs, count };
  if (referenceImage) body.referenceImage = referenceImage;
  if (referenceImageBase64) {
    body.referenceImageBase64 = referenceImageBase64;
    if (referenceImageMimeType) body.referenceImageMimeType = referenceImageMimeType;
    if (referenceImageName) body.referenceImageName = referenceImageName;
  }

  const res = await fetchImpl(`${apiBase}/api/gen_image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(apiToken),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs + 10000),
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { success: false, error: `Non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}` };
  }

  if (!res.ok || data.success === false) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data;
}

function extFromMime(mime) {
  if (!mime) return ".png";
  const map = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  return map[mime.toLowerCase().split(";")[0].trim()] || ".png";
}

export async function saveImages(images, outputDir, slug, ts, options = {}) {
  await mkdir(outputDir, { recursive: true });
  const { suffix } = options;
  const saved = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!img || !img.base64) continue;
    const ext = extFromMime(img.mimeType);
    const counter = typeof suffix === "number" ? `${suffix}-${i + 1}` : `${i + 1}`;
    const fname = `${slug}-${ts}-${counter}${ext}`;
    const fpath = path.join(outputDir, fname);
    await writeFile(fpath, Buffer.from(img.base64, "base64"));
    saved.push(fpath);
  }
  return saved;
}