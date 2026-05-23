import { useCallback, useMemo, useState } from "react";

/**
 * Generic multi-select state for any list view.
 * - selectionMode: true once the user explicitly entered bulk mode
 *   (long-press, "Select" button, or first toggle).
 * - selected: ordered Set of ids.
 */
export function useBulkSelection() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const toggle = useCallback((id: string) => {
    setSelectionMode(true);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const enter = useCallback((id?: string) => {
    setSelectionMode(true);
    if (id) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
  }, []);

  const toggleAll = useCallback((ids: string[]) => {
    setSelectionMode(true);
    setSelected((prev) => {
      const allOn = ids.length > 0 && ids.every((i) => prev.has(i));
      if (allOn) return new Set();
      return new Set(ids);
    });
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
    setSelectionMode(false);
  }, []);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const ids = useMemo(() => Array.from(selected), [selected]);

  return {
    selected,
    ids,
    count: selected.size,
    selectionMode,
    toggle,
    toggleAll,
    enter,
    clear,
    isSelected,
    setSelectionMode,
  };
}

/**
 * Mouse/touch long-press handler that fires `onLongPress` after `ms`
 * without movement. Returns props to spread on any element.
 */
export function useLongPress(onLongPress: () => void, ms = 450) {
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    const t = setTimeout(() => {
      onLongPress();
      setTimer(null);
    }, ms);
    setTimer(t);
  };
  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }
  };

  return {
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel,
    onTouchCancel: cancel,
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
  };
}
