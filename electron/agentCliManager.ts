import { app } from 'electron';
import { execFile } from 'node:child_process';
import { access, chmod, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { AgentCliConfig, AgentCliId, AgentCliInfo } from '../src/types/agent-cli';

const execFileAsync = promisify(execFile);
const CATALOG = {
  cursor: { name: 'Cursor CLI', description: '在终端中使用 Cursor Agent 完成编码任务', command: 'cursor-agent', installerUrl: 'https://cursor.com/install' },
  claude: { name: 'Claude Code', description: 'Anthropic 的命令行智能编码助手', command: 'claude', packageName: '@anthropic-ai/claude-code' },
  gemini: { name: 'Gemini CLI', description: 'Google Gemini 的开源命令行 Agent', command: 'gemini', packageName: '@google/gemini-cli' },
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

async function commandOutput(command: string, args: string[]) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { timeout: 15_000, env: process.env });
    return `${stdout || stderr}`.trim().split('\n')[0];
  } catch { return undefined; }
}

async function resolveCommand(id: AgentCliId): Promise<string> {
  const command = CATALOG[id].command;
  if (id !== 'cursor') return command;

  // GUI apps often do not inherit the user's shell PATH. Check Cursor's documented
  // install locations before falling back to PATH lookup.
  const candidates = [
    join(homedir(), '.local', 'bin', command),
    join(homedir(), '.cursor', 'bin', command),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch { /* Try the next known location. */ }
  }
  return command;
}

async function installCursorCli(): Promise<void> {
  const response = await fetch(CATALOG.cursor.installerUrl, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Cursor 安装器下载失败（HTTP ${response.status}）`);

  const scriptPath = join(tmpdir(), `cursor-agent-install-${process.pid}-${Date.now()}.sh`);
  try {
    await writeFile(scriptPath, await response.text(), { mode: 0o700 });
    await chmod(scriptPath, 0o700);
    await execFileAsync('bash', [scriptPath], { timeout: 10 * 60_000, env: process.env });
  } finally {
    await unlink(scriptPath).catch(() => undefined);
  }
}

export async function listAgentClis(): Promise<AgentCliInfo[]> {
  const configs = await loadConfigs();
  return Promise.all(ids.map(async (id) => {
    const item = CATALOG[id];
    const version = await commandOutput(await resolveCommand(id), ['--version']);
    const latestVersion = 'packageName' in item
      ? await commandOutput('npm', ['view', item.packageName, 'version'])
      : version ? '自动更新' : undefined;
    return { id, name: item.name, description: item.description, command: item.command, installed: Boolean(version), version, latestVersion, config: configs[id] };
  }));
}

export async function installAgentCli(id: AgentCliId): Promise<void> {
  const item = CATALOG[id];
  if (!item) throw new Error('不支持的 Agent CLI');
  if (id === 'cursor') {
    const command = await resolveCommand(id);
    const installed = Boolean(await commandOutput(command, ['--version']));
    if (installed) {
      await execFileAsync(command, ['update'], { timeout: 10 * 60_000, env: process.env });
    } else {
      await installCursorCli();
    }
    return;
  }
  if (!('packageName' in item)) throw new Error('该 Agent CLI 缺少安装配置');
  await execFileAsync('npm', ['install', '--global', item.packageName], { timeout: 10 * 60_000, env: process.env });
}

export async function saveAgentCliConfig(id: AgentCliId, input: AgentCliConfig): Promise<void> {
  if (!CATALOG[id]) throw new Error('不支持的 Agent CLI');
  const configs = await loadConfigs();
  configs[id] = { ...DEFAULT_CONFIG, ...input };
  await mkdir(dirname(settingsPath()), { recursive: true });
  await writeFile(settingsPath(), JSON.stringify(configs, null, 2), { mode: 0o600 });
}
