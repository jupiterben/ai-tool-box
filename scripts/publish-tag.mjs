#!/usr/bin/env node
/**
 * 自增版本、提交、打 tag 并推送（触发 GitHub / Gitea Release CI）
 *
 * 用法:
 *   pnpm run release:tag                    # patch +1，交互确认后发布
 *   pnpm run release:tag -- minor           # minor +1
 *   pnpm run release:tag -- major           # major +1
 *   pnpm run release:tag -- --no-bump       # 不自增，用当前 version 打 tag
 *   pnpm run release:tag -- --dry-run       # 仅预览
 *   pnpm run release:tag -- -y              # 跳过确认
 *   pnpm run release:tag -- --no-push       # 仅本地 commit + tag
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pkgPath = join(root, 'package.json');

const BUMP_LEVELS = new Set(['patch', 'minor', 'major']);

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('-')));
const positional = args.filter((a) => !a.startsWith('-'));

const dryRun = flags.has('--dry-run');
const skipConfirm = flags.has('-y') || flags.has('--yes');
const noPush = flags.has('--no-push');
const noBump = flags.has('--no-bump');

let bumpLevel = noBump ? null : 'patch';
let remote = 'origin';

for (const arg of positional) {
  if (BUMP_LEVELS.has(arg)) {
    bumpLevel = arg;
  } else {
    remote = arg;
  }
}

/** 直接调用 git，避免 Windows shell 解析 @{upstream} 等问题 */
function runGit(gitArgs, { allowFailure = false } = {}) {
  const result = spawnSync('git', gitArgs, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();

  if (result.status !== 0) {
    if (allowFailure) return null;
    if (output) process.stderr.write(`${output}\n`);
    throw new Error(`git ${gitArgs.join(' ')} 失败 (exit ${result.status})`);
  }

  return (result.stdout ?? '').trim();
}

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(message);
}

function readPackage() {
  return JSON.parse(readFileSync(pkgPath, 'utf8'));
}

function readVersion() {
  const pkg = readPackage();
  if (!pkg.version || typeof pkg.version !== 'string') {
    fail('无法读取 package.json 中的 version');
  }
  return pkg.version;
}

function bumpVersion(version, level) {
  const core = version.split('-')[0].split('+')[0];
  const parts = core.split('.');
  const major = Number(parts[0] ?? 0);
  const minor = Number(parts[1] ?? 0);
  const patch = Number(parts[2] ?? 0);

  switch (level) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      fail(`未知版本递增粒度: ${level}`);
  }
}

function writeVersion(version) {
  const pkg = readPackage();
  pkg.version = version;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

function assertGitRepo() {
  if (!runGit(['rev-parse', '--git-dir'], { allowFailure: true })) {
    fail('当前目录不是 git 仓库');
  }
}

function assertCleanWorkingTree() {
  const status = runGit(['status', '--porcelain']);
  if (status) {
    info('\n以下文件尚未提交：');
    info(status);
    fail('请先 commit 或 stash 所有本地变更后再发布');
  }
}

function getBranch() {
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch === 'HEAD') {
    fail('当前处于 detached HEAD，请先切换到分支');
  }
  return branch;
}

function assertBranchPushed(branch) {
  const upstream = runGit(['rev-parse', '--abbrev-ref', `${branch}@{upstream}`], {
    allowFailure: true,
  });
  if (!upstream) {
    info(`\n⚠️  分支 ${branch} 未设置 upstream，跳过远程同步检查`);
    return null;
  }

  if (!runGit(['rev-parse', '--verify', upstream], { allowFailure: true })) {
    info(`\n⚠️  本地缺少 ${upstream}，尝试 fetch...`);
    runGit(['fetch', remote, branch]);
  }

  const ahead = runGit(['rev-list', '--count', `${upstream}..HEAD`], { allowFailure: true });
  if (ahead == null) {
    info(`\n⚠️  无法比较 ${upstream}..HEAD，跳过 ahead 检查`);
    return upstream;
  }

  if (Number(ahead) > 0) {
    fail(`本地 ${branch} 比 ${upstream} 超前 ${ahead} 个 commit，请先 push 代码再发布`);
  }
  return upstream;
}

function tagExists(tag) {
  return Boolean(runGit(['rev-parse', '--verify', `refs/tags/${tag}`], { allowFailure: true }));
}

function remoteTagExists(tag) {
  const out = runGit(['ls-remote', '--tags', remote, `refs/tags/${tag}`], { allowFailure: true });
  return Boolean(out);
}

function resolveTargetVersion(oldVersion) {
  let version = bumpLevel ? bumpVersion(oldVersion, bumpLevel) : oldVersion;
  const skipped = [];

  while (tagExists(`v${version}`) || remoteTagExists(`v${version}`)) {
    skipped.push(`v${version}`);
    if (!bumpLevel) {
      fail(
        `tag v${version} 已存在（本地或远程 ${remote}）。` +
          '请更新 package.json 版本，或使用 --no-bump 前先删除旧 tag',
      );
    }
    version = bumpVersion(version, 'patch');
  }

  return { version, skipped };
}

async function confirm(message) {
  if (skipConfirm) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${message} [y/N] `);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

function planRelease() {
  assertGitRepo();
  assertCleanWorkingTree();

  const branch = getBranch();
  assertBranchPushed(branch);

  const oldVersion = readVersion();
  const { version, skipped } = resolveTargetVersion(oldVersion);
  const tag = `v${version}`;
  const commit = runGit(['rev-parse', '--short', 'HEAD']);

  info('\n📋 发布预览');
  if (bumpLevel) {
    info(`   版本:     ${oldVersion} → ${version} (${bumpLevel})`);
  } else {
    info(`   版本:     ${version}（不自增）`);
  }
  if (skipped.length > 0) {
    info(`   跳过:     ${skipped.join(', ')} 已占用，自动继续递增`);
  }
  info(`   Tag:      ${tag}`);
  info(`   分支:     ${branch}`);
  info(`   Commit:   ${commit}`);
  info(`   远程:     ${remote}`);
  info(`   提交版本: ${bumpLevel ? '是' : '否'}`);
  info(`   推送:     ${noPush ? '否（仅本地）' : '分支 + tag'}`);

  if (dryRun) {
    info('\n(dry-run) 未执行任何 git 操作');
    return null;
  }

  return { oldVersion, version, tag, branch };
}

async function main() {
  const meta = planRelease();
  if (!meta) return;

  const { oldVersion, version, tag, branch } = meta;

  const ok = await confirm('\n确认自增版本并发布 tag？');
  if (!ok) {
    info('已取消');
    process.exit(0);
  }

  if (bumpLevel) {
    info(`\n📦 更新版本 ${oldVersion} → ${version}...`);
    writeVersion(version);
    runGit(['add', 'package.json']);
    runGit(['commit', '-m', `chore: bump version ${oldVersion} → ${version}`]);
  }

  info(`\n🏷️  创建 tag ${tag}...`);
  runGit(['tag', '-a', tag, '-m', `Release ${tag}`]);

  if (noPush) {
    info(`\n✅ 已完成本地发布准备 ${tag}`);
    info(`   推送分支: git push ${remote} ${branch}`);
    info(`   推送 tag:  git push ${remote} ${tag}`);
    return;
  }

  info(`\n🚀 推送分支与 tag → ${remote}...`);
  runGit(['push', remote, branch]);
  runGit(['push', remote, tag]);

  info(`\n✅ 已发布 ${tag}，CI 将自动构建多平台安装包`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
