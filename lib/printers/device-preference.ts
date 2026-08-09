const autoPrintKeyPrefix = "glutong:printer:auto-print:";
const autoPrintChangeEvent = "glutong:printer:auto-print-change";

/** Builds the browser-local auto-print key for one outlet. */
export function getAutoPrintStorageKey(outletId: string): string {
  return `${autoPrintKeyPrefix}${outletId}`;
}

/** Reads auto-print defensively; blocked storage always falls back to manual printing. */
export function getAutoPrintPreference(outletId: string): boolean {
  try {
    return window.localStorage.getItem(getAutoPrintStorageKey(outletId)) === "true";
  } catch {
    return false;
  }
}

/** Stores one device preference and reports whether browser storage accepted it. */
export function setAutoPrintPreference(outletId: string, enabled: boolean): boolean {
  try {
    window.localStorage.setItem(getAutoPrintStorageKey(outletId), String(enabled));
    window.dispatchEvent(new CustomEvent(autoPrintChangeEvent, { detail: outletId }));
    return true;
  } catch {
    return false;
  }
}

/** Subscribes React to same-tab and cross-tab preference changes for one outlet. */
export function subscribeAutoPrintPreference(outletId: string, onStoreChange: () => void): () => void {
  const storageKey = getAutoPrintStorageKey(outletId);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === storageKey) onStoreChange();
  };
  const handleLocalChange = (event: Event) => {
    if ((event as CustomEvent<string>).detail === outletId) onStoreChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(autoPrintChangeEvent, handleLocalChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(autoPrintChangeEvent, handleLocalChange);
  };
}
