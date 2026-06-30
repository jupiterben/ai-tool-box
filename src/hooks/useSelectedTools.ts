import { useCallback, useEffect, useState } from 'react';

function loadSelectedToolIds(allToolIds: string[], storageKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return allToolIds;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return allToolIds;

    const validIds = new Set(allToolIds);
    const selected = parsed.filter(
      (id): id is string => typeof id === 'string' && validIds.has(id)
    );

    return selected.length > 0 ? selected : allToolIds;
  } catch {
    return allToolIds;
  }
}

export function useSelectedTools(allToolIds: string[], storageKey: string) {
  const [selectedToolIds, setSelectedToolIdsState] = useState<string[]>(() =>
    loadSelectedToolIds(allToolIds, storageKey)
  );

  const setSelectedToolIds = useCallback(
    (ids: string[]) => {
      const validIds = new Set(allToolIds);
      const filtered = ids.filter((id) => validIds.has(id));
      const result = filtered.length > 0 ? filtered : [allToolIds[0]];
      setSelectedToolIdsState(result);
    },
    [allToolIds]
  );

  useEffect(() => {
    setSelectedToolIdsState((prev) => {
      const validIds = new Set(allToolIds);
      const filtered = prev.filter((id) => validIds.has(id));
      return filtered.length > 0 ? filtered : [...allToolIds];
    });
  }, [allToolIds]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(selectedToolIds));
  }, [selectedToolIds, storageKey]);

  return { selectedToolIds, setSelectedToolIds };
}
