import { useCallback, useEffect, useState } from 'react';

const SELECTED_TOOLS_STORAGE_KEY = 'ai-tool-box-selected-tools';

function loadSelectedToolIds(allToolIds: string[]): string[] {
  try {
    const raw = localStorage.getItem(SELECTED_TOOLS_STORAGE_KEY);
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

export function useSelectedTools(allToolIds: string[]) {
  const [selectedToolIds, setSelectedToolIdsState] = useState<string[]>(() =>
    loadSelectedToolIds(allToolIds)
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
    localStorage.setItem(SELECTED_TOOLS_STORAGE_KEY, JSON.stringify(selectedToolIds));
  }, [selectedToolIds]);

  return { selectedToolIds, setSelectedToolIds };
}
