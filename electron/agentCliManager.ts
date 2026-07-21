import { app } from 'electron';
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, chmod, mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { AgentCliConfig, AgentCliId, AgentCliInfo } from '../src/types/agent-cli';

const execFileAsync = promisify(execFile);
const PATH_SEP = process.platform === 'win32' ? ';' : ':';
const CATALOG = {
  cursor: { name: 'Cursor CLI', description: '在终端中使用 Cursor Agent 完成编码任务', command: 'cursor-agent', installerUrl: 'https://cursor.com/install' },
  claude: { name: 'Claude Code', description: 'Anthropic 的命令行智能编码助手', command: 'claude', packageName: '@anthropic-ai/claude-code' },
  gemini: { name: 'Gemini CLI', description: 'Google Gemini 的开源命令行 Agent', command: 'gemini', packageName: '@google/gemini-cli' },
  openclaw: { name: 'OpenClaw', description: '可连接消息平台与本机工具的个人 AI 助手', command: 'openclaw', packageName: 'openclaw' },
  codex: { name: 'Codex CLI', description: 'OpenAI 的本地命令行编码 Agent', command: 'codex', packageName: '@openai/codex' },
  opencode: { name: 'OpenCode', description: '开源、模型无关的终端编码 Agent', command: 'opencode', packageName: 'opencode-ai' },
  hermes: { name: 'Hermes Agent', description: 'Nous Research 的持久记忆个人 Agent', command: 'hermes', installerUrl: 'https://hermes-agent.nousresearch.com/install.sh' },
} as const;

const DEFAULT_CONFIG: AgentCliConfig = { model: '', apiKey: '', baseUrl: '', defaultArgs: '', permissionMode: 'default', enabled: true };
const ids = Object.keys(CATALOG) as AgentCliId[];

function settingsPath() { return join(app.getPath('userData'), 'agent-cli-settings.json'); }

async function loadConfigs(): Promise<Record<AgentCliId, AgentCliConfig>> {
  const fallback = Object.fromEntries(ids.map((id) => [id, { ...DEFAULT_CONFIG }])) as Record<AgentCliId, AgentCliConfig>;
  try {
    const parsed = JSON.parse(await readFile(settingsPath(), 'utf8')) as Partial<Record<AgentCliId, Partial<AgentCliConfig>>>;
    ids.forEach((id) => { fallback[id] = { ...DEFAULT_CONFIG, ...parsed[id] }; });
  } catch { /* First launch. */ }
  return fallback;
}

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** GUI apps often miss shell PATH (nvm / Homebrew / ~/.local). Collect likely bin dirs. */
async function commonBinDirs(): Promise<string[]> {
  const home = homedir();
  const dirs: string[] = [
    join(home, '.local', 'bin'),
    join(home, '.cursor', 'bin'),
    join(home, '.bun', 'bin'),
    join(home, '.volta', 'bin'),
    join(home, '.fnm', 'current', 'bin'),
    join(home, 'Library', 'pnpm'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ];

  if (process.platform === 'win32') {
    dirs.push(join(home, 'AppData', 'Roaming', 'npm'), join(home, 'AppData', 'Local', 'npm'));
  }

  const nvmRoot = process.env.NVM_DIR || join(home, '.nvm');
  if (process.env.NVM_BIN) dirs.unshift(process.env.NVM_BIN);
  try {
    const versionsRoot = join(nvmRoot, 'versions', 'node');
    const versions = (await readdir(versionsRoot))
      .filter((name) => name.startsWith('v'))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) dirs.push(join(versionsRoot, version, 'bin'));
  } catch { /* nvm not installed. */ }

  return dirs;
}

async function execEnv(): Promise<NodeJS.ProcessEnv> {
  const extras = await commonBinDirs();
  const merged = [...extras, ...(process.env.PATH || '').split(PATH_SEP)].filter(Boolean);
  return { ...process.env, PATH: [...new Set(merged)].join(PATH_SEP) };
}

async function resolveExecutable(command: string, extraDirs: string[] = []): Promise<string> {
  const env = await execEnv();
  const searchDirs = [
    ...extraDirs,
    ...(env.PATH || '').split(PATH_SEP),
  ].filter(Boolean);

  for (const dir of searchDirs) {
    const candidate = join(dir, command);
    if (await isExecutable(candidate)) return candidate;
    if (process.platform === 'win32') {
      for (const ext of ['.cmd', '.exe', '.bat']) {
        const winCandidate = `${candidate}${ext}`;
        if (await isExecutable(winCandidate)) return winCandidate;
      }
    }
  }
  return command;
}

async function commandOutput(command: string, args: string[]) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { timeout: 15_000, env: await execEnv() });
    return `${stdout || stderr}`.trim().split('\n')[0];
  } catch { return undefined; }
}

async function resolveCommand(id: AgentCliId): Promise<string> {
  const command = CATALOG[id].command;
  const home = homedir();
  const preferred = id === 'cursor'
    ? [join(home, '.local', 'bin'), join(home, '.cursor', 'bin')]
    : [];
  return resolveExecutable(command, preferred);
}

async function resolveNpm(): Promise<string> {
  return resolveExecutable('npm');
}

async function installCursorCli(): Promise<void> {
  const response = await fetch(CATALOG.cursor.installerUrl, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Cursor 安装器下载失败（HTTP ${response.status}）`);

  const scriptPath = join(tmpdir(), `cursor-agent-install-${process.pid}-${Date.now()}.sh`);
  try {
    await writeFile(scriptPath, await response.text(), { mode: 0o700 });
    await chmod(scriptPath, 0o700);
    await execFileAsync('bash', [scriptPath], { timeout: 10 * 60_000, env: await execEnv() });
  } finally {
    await unlink(scriptPath).catch(() => undefined);
  }
}

async function installHermesCli(): Promise<void> {
  const env = await execEnv();
  if (process.platform === 'win32') {
    await execFileAsync('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      'iex (irm https://hermes-agent.nousresearch.com/install.ps1)',
    ], { timeout: 15 * 60_000, env });
    return;
  }
  const response = await fetch(CATALOG.hermes.installerUrl, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Hermes 安装器下载失败（HTTP ${response.status}）`);
  const scriptPath = join(tmpdir(), `hermes-install-${process.pid}-${Date.now()}.sh`);
  try {
    await writeFile(scriptPath, await response.text(), { mode: 0o700 });
    await chmod(scriptPath, 0o700);
    await execFileAsync('bash', [scriptPath], { timeout: 15 * 60_000, env });
  } finally {
    await unlink(scriptPath).catch(() => undefined);
  }
}

export async function listAgentClis(): Promise<AgentCliInfo[]> {
  const configs = await loadConfigs();
  const npm = await resolveNpm();
  return Promise.all(ids.map(async (id) => {
    const item = CATALOG[id];
    const version = await commandOutput(await resolveCommand(id), ['--version']);
    const latestVersion = 'packageName' in item
      ? await commandOutput(npm, ['view', item.packageName, 'version'])
      : id === 'cursor' && version ? '自动更新' : undefined;
    return { id, name: item.name, description: item.description, command: item.command, installed: Boolean(version), version, latestVersion, config: configs[id] };
  }));
}

export async function installAgentCli(id: AgentCliId): Promise<void> {
  const item = CATALOG[id];
  if (!item) throw new Error('不支持的 Agent CLI');
  const env = await execEnv();
  if (id === 'cursor') {
    const command = await resolveCommand(id);
    const installed = Boolean(await commandOutput(command, ['--version']));
    if (installed) {
      await execFileAsync(command, ['update'], { timeout: 10 * 60_000, env });
    } else {
      await installCursorCli();
    }
    return;
  }
  if (id === 'hermes') {
    await installHermesCli();
    return;
  }
  if (!('packageName' in item)) throw new Error('该 Agent CLI 缺少安装配置');
  await execFileAsync(await resolveNpm(), ['install', '--global', item.packageName], { timeout: 10 * 60_000, env });
}

export async function saveAgentCliConfig(id: AgentCliId, input: AgentCliConfig): Promise<void> {
  if (!CATALOG[id]) throw new Error('不支持的 Agent CLI');
  const configs = await loadConfigs();
  configs[id] = { ...DEFAULT_CONFIG, ...input };
  await mkdir(dirname(settingsPath()), { recursive: true });
  await writeFile(settingsPath(), JSON.stringify(configs, null, 2), { mode: 0o600 });
}
