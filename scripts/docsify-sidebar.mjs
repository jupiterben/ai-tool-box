#!/usr/bin/env node
/**
 * 扫描 docs/ 下的 Markdown，生成 Docsify 的 _sidebar.md，并可选监听目录变更后重新生成。
 */

import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DOCS_ROOT = path.join(REPO_ROOT, "docs");
const SIDEBAR_FILE = path.join(DOCS_ROOT, "_sidebar.md");

const IGNORE_DIR_NAMES = new Set(["node_modules", ".git"]);
function prettyTitle(fileBase) {
  let s = fileBase.replace(/\.md$/i, "");
  s = s.replace(/-/g, " ").replace(/_/g, " ");
  return s.trim() || fileBase;
}

function linkTitle(fileName, { inSubfolder }) {
  if (fileName.toLowerCase() === "readme.md") {
    return inSubfolder ? "索引" : "手册索引";
  }
  return prettyTitle(fileName);
}

function folderLabel(dirName) {
  return prettyTitle(dirName);
}

/** 按文件名中的数字语义排序（01 < 02 < 10；02-00 < 02-01） */
function compareByNumericName(a, b) {
  return a.localeCompare(b, "en", { numeric: true });
}

function isReadmeFile(n) {
  return n.toLowerCase() === "readme.md";
}

/**
 * @param {string} subAbs
 * @param {string} dirName
 */
async function emitDirSection(subAbs, dirName) {
  /** @type {string[]} */
  const out = [];
  const subEntries = await fs.readdir(subAbs, { withFileTypes: true });
  const subMds = subEntries.filter(
    (x) => x.isFile() && x.name.endsWith(".md") && x.name !== "_sidebar.md",
  );
  subMds.sort((a, b) => {
    const ar = isReadmeFile(a.name);
    const br = isReadmeFile(b.name);
    if (ar !== br) return ar ? -1 : 1;
    return compareByNumericName(a.name, b.name);
  });

  if (subMds.length === 0) return out;

  if (subMds.length === 1 && isReadmeFile(subMds[0].name)) {
    out.push(`* [${folderLabel(dirName)}](${dirName}/README.md)`);
    return out;
  }

  out.push(`* ${folderLabel(dirName)}`);
  for (const f of subMds) {
    out.push(
        `  * [${linkTitle(f.name, { inSubfolder: true })}](${dirName}/${f.name})`,
    );
  }
  return out;
}

/** @param {string} dirAbs docs 根目录绝对路径 */
async function listMdTree(dirAbs) {
  const entries = await fs.readdir(dirAbs, { withFileTypes: true });
  const dirs = [];
  const mdFiles = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    if (e.isDirectory()) {
      if (IGNORE_DIR_NAMES.has(e.name)) continue;
      dirs.push(e);
    } else if (e.isFile() && e.name.endsWith(".md") && e.name !== "_sidebar.md") {
      mdFiles.push(e);
    }
  }

  /** @type {string[]} */
  const lines = [];

  const readmeFile = mdFiles.find((f) => isReadmeFile(f.name));
  const fileItems = mdFiles.filter((f) => !isReadmeFile(f.name));

  /** @type {{ kind: "file" | "dir"; entry: import("node:fs").Dirent; orderKey: string }[]} */
  const rootItems = [];
  for (const f of fileItems) {
    rootItems.push({
      kind: "file",
      entry: f,
      orderKey: f.name.replace(/\.md$/i, ""),
    });
  }
  for (const d of dirs) {
    rootItems.push({ kind: "dir", entry: d, orderKey: d.name });
  }
  rootItems.sort((x, y) => compareByNumericName(x.orderKey, y.orderKey));

  if (readmeFile) {
    lines.push(`* [${linkTitle(readmeFile.name, { inSubfolder: false })}](${readmeFile.name})`);
  }

  for (const item of rootItems) {
    if (item.kind === "file") {
      const f = item.entry;
      lines.push(`* [${linkTitle(f.name, { inSubfolder: false })}](${f.name})`);
      continue;
    }
    const d = item.entry;
    const subAbs = path.join(dirAbs, d.name);
    const subLines = await emitDirSection(subAbs, d.name);
    lines.push(...subLines);
  }

  return lines;
}

async function generate() {
  const lines = await listMdTree(DOCS_ROOT);
  const header = [
    "<!-- 本文件由 scripts/docsify-sidebar.mjs 生成，请勿手改；或改后勿覆盖 -->",
    "",
  ];
  const body = lines.join("\n") + "\n";
  const out = header.join("\n") + body;
  let prev = "";
  try {
    prev = await fs.readFile(SIDEBAR_FILE, "utf8");
  } catch {
    // ignore
  }
  if (prev === out) return false;
  await fs.writeFile(SIDEBAR_FILE, out, "utf8");
  return true;
}

async function main() {
  const watch = process.argv.includes("--watch") || process.argv.includes("-w");
  const changed = await generate();
  if (changed) console.log("已写入", path.relative(REPO_ROOT, SIDEBAR_FILE));
  else console.log("侧边栏已是最新，跳过写入");

  if (!watch) return;

  const debounceMs = 300;
  let timer = null;

  const run = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const c = await generate();
      if (c) console.log(`[watch] 已更新 ${path.relative(REPO_ROOT, SIDEBAR_FILE)}`);
    }, debounceMs);
  };

  fsSync.watch(
    DOCS_ROOT,
    { recursive: true, encoding: "utf8" },
    (event, filename) => {
      if (!filename) return;
      const norm = filename.replace(/\\/g, "/");
      if (norm.endsWith("_sidebar.md")) return;
      run();
    },
  );

  console.log(`[watch] 监听中: ${DOCS_ROOT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
