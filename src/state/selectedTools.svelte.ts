import { untrack } from 'svelte';

function loadSelectedToolIds(
  allToolIds: string[],
  storageKey: string,
): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return allToolIds;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return allToolIds;

    const validIds = new Set(allToolIds);
    const selected = parsed.filter(
      (id): id is string => typeof id === 'string' && validIds.has(id),
    );

    return selected.length > 0 ? selected : allToolIds;
  } catch {
    return allToolIds;
  }
}
export function createSelectedTools(
  getAllToolIds: () => string[],
  getStorageKey: () => string,
) {
  let allToolIds = $derived(getAllToolIds());
  let storageKey = $derived(getStorageKey());
  let selectedToolIds: string[] = $state.raw(
    (() => loadSelectedToolIds(allToolIds, storageKey))(),
  );
  function setSelectedToolIdsState(
    next:
      | typeof selectedToolIds
      | ((previous: typeof selectedToolIds) => typeof selectedToolIds),
  ) {
    selectedToolIds =
      typeof next === 'function' ? untrack(() => next(selectedToolIds)) : next;
  }
  const setSelectedToolIds = (ids: string[]) => {
    const filtered = ids.filter((id) => allToolIds.includes(id));
    const result = filtered.length > 0 ? filtered : allToolIds.slice(0, 1);
    setSelectedToolIdsState(result);
  };
  $effect(() => {
    void allToolIds;
    return untrack(() => {
      setSelectedToolIdsState((prev) => {
        const filtered = prev.filter((id) => allToolIds.includes(id));
        return filtered.length > 0 ? filtered : [...allToolIds];
      });
    });
  });
  $effect(() => {
    void selectedToolIds;
    void storageKey;
    return untrack(() => {
      localStorage.setItem(storageKey, JSON.stringify(selectedToolIds));
    });
  });
  return {
    get selectedToolIds() {
      return selectedToolIds;
    },
    get setSelectedToolIds() {
      return setSelectedToolIds;
    },
  };
}
