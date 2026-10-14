import {
  getApiDefaultWorkerCount,
  getApiToolWorkerCount,
} from './imageGenApiConfig.js';

interface ApiWorker {
  id: string;
  toolId: string;
  busy: boolean;
}

interface Waiter {
  resolve: (worker: ApiWorker) => void;
}

interface ToolWorkerStatus {
  toolId: string;
  configured: number;
  total: number;
  busy: number;
  queued: number;
  workers: Array<{ id: string; busy: boolean }>;
}

const workersByTool = new Map<string, ApiWorker[]>();
const waitersByTool = new Map<string, Waiter[]>();

function normalizeToolId(toolId: string): string {
  return toolId.trim();
}

function buildThreadId(toolId: string, index: number): string {
  const safeToolId = toolId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${safeToolId || 'api'}-worker-${index}`;
}

function getWorkers(toolId: string): ApiWorker[] {
  const normalizedToolId = normalizeToolId(toolId);
  const existing = workersByTool.get(normalizedToolId);
  if (existing) {
    return existing;
  }

  const workers: ApiWorker[] = [];
  workersByTool.set(normalizedToolId, workers);
  return workers;
}

function getWaiters(toolId: string): Waiter[] {
  const normalizedToolId = normalizeToolId(toolId);
  const existing = waitersByTool.get(normalizedToolId);
  if (existing) {
    return existing;
  }

  const waiters: Waiter[] = [];
  waitersByTool.set(normalizedToolId, waiters);
  return waiters;
}

function syncWorkers(toolId: string): void {
  const normalizedToolId = normalizeToolId(toolId);
  const targetCount = getApiToolWorkerCount(normalizedToolId);
  const workers = getWorkers(normalizedToolId);

  while (workers.length < targetCount) {
    workers.push({
      id: buildThreadId(normalizedToolId, workers.length + 1),
      toolId: normalizedToolId,
      busy: false,
    });
  }

  while (workers.length > targetCount) {
    const last = workers[workers.length - 1];
    if (last?.busy) {
      break;
    }
    workers.pop();
  }
}

function takeIdleWorker(toolId: string): ApiWorker | null {
  const normalizedToolId = normalizeToolId(toolId);
  syncWorkers(normalizedToolId);

  const worker = getWorkers(normalizedToolId).find((item) => !item.busy);
  if (!worker) {
    return null;
  }

  worker.busy = true;
  return worker;
}

function acquireWorker(toolId: string): Promise<ApiWorker> {
  const normalizedToolId = normalizeToolId(toolId);
  const worker = takeIdleWorker(normalizedToolId);
  if (worker) {
    return Promise.resolve(worker);
  }

  return new Promise((resolve) => {
    getWaiters(normalizedToolId).push({ resolve });
  });
}

function releaseWorker(worker: ApiWorker): void {
  syncWorkers(worker.toolId);

  const waiter = getWaiters(worker.toolId).shift();
  if (waiter) {
    worker.busy = true;
    waiter.resolve(worker);
    return;
  }

  worker.busy = false;
}

function getToolWorkerStatus(toolId: string): ToolWorkerStatus {
  const normalizedToolId = normalizeToolId(toolId);
  syncWorkers(normalizedToolId);

  const workers = getWorkers(normalizedToolId);
  const waiters = getWaiters(normalizedToolId);

  return {
    toolId: normalizedToolId,
    configured: getApiToolWorkerCount(normalizedToolId),
    total: workers.length,
    busy: workers.filter((item) => item.busy).length,
    queued: waiters.length,
    workers: workers.map((item) => ({ id: item.id, busy: item.busy })),
  };
}

export function getApiWorkerStatus(toolId?: string): {
  defaultPerTool: number;
  total: number;
  busy: number;
  queued: number;
  tools: ToolWorkerStatus[];
  workers: Array<{ id: string; toolId: string; busy: boolean }>;
} {
  const toolIds = new Set<string>([
    ...workersByTool.keys(),
    ...waitersByTool.keys(),
  ]);

  if (toolId?.trim()) {
    toolIds.add(normalizeToolId(toolId));
  }

  const tools = Array.from(toolIds).map((id) => getToolWorkerStatus(id));
  return {
    defaultPerTool: getApiDefaultWorkerCount(),
    total: tools.reduce((sum, item) => sum + item.total, 0),
    busy: tools.reduce((sum, item) => sum + item.busy, 0),
    queued: tools.reduce((sum, item) => sum + item.queued, 0),
    tools,
    workers: tools.flatMap((item) =>
      item.workers.map((worker) => ({
        ...worker,
        toolId: item.toolId,
      }))
    ),
  };
}

export async function runWithApiWorker<T>(
  toolId: string,
  task: (threadId: string) => Promise<T>
): Promise<T> {
  const worker = await acquireWorker(toolId);
  try {
    return await task(worker.id);
  } finally {
    releaseWorker(worker);
  }
}
