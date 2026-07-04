import { getApiWorkerCount } from './imageGenApiConfig.js';

interface ApiWorker {
  id: string;
  busy: boolean;
}

interface Waiter {
  resolve: (worker: ApiWorker) => void;
}

const workers: ApiWorker[] = [];
const waiters: Waiter[] = [];

function syncWorkers(): void {
  const targetCount = getApiWorkerCount();

  while (workers.length < targetCount) {
    workers.push({
      id: `api-worker-${workers.length + 1}`,
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

function takeIdleWorker(): ApiWorker | null {
  syncWorkers();
  const worker = workers.find((item) => !item.busy);
  if (!worker) {
    return null;
  }
  worker.busy = true;
  return worker;
}

function acquireWorker(): Promise<ApiWorker> {
  const worker = takeIdleWorker();
  if (worker) {
    return Promise.resolve(worker);
  }

  return new Promise((resolve) => {
    waiters.push({ resolve });
  });
}

function releaseWorker(worker: ApiWorker): void {
  syncWorkers();

  const waiter = waiters.shift();
  if (waiter) {
    worker.busy = true;
    waiter.resolve(worker);
    return;
  }

  worker.busy = false;
}

export function getApiWorkerStatus(): {
  total: number;
  busy: number;
  queued: number;
  workers: Array<{ id: string; busy: boolean }>;
} {
  syncWorkers();
  return {
    total: workers.length,
    busy: workers.filter((item) => item.busy).length,
    queued: waiters.length,
    workers: workers.map((item) => ({ id: item.id, busy: item.busy })),
  };
}

export async function runWithApiWorker<T>(
  task: (threadId: string) => Promise<T>
): Promise<T> {
  const worker = await acquireWorker();
  try {
    return await task(worker.id);
  } finally {
    releaseWorker(worker);
  }
}
