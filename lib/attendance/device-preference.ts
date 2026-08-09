import { attendanceSharedDeviceKey } from "@/lib/attendance/constants";

const preferenceEvent = "glutong:attendance:shared-device-change";

/** Reads shared-device mode and defaults safely to false when browser storage is unavailable. */
export function getSharedDevicePreference() {
  try {
    return window.localStorage.getItem(attendanceSharedDeviceKey) === "1";
  } catch {
    return false;
  }
}

/** Persists shared-device mode locally and reports failure so the UI can remain manual. */
export function setSharedDevicePreference(enabled: boolean) {
  try {
    if (enabled) window.localStorage.setItem(attendanceSharedDeviceKey, "1");
    else window.localStorage.removeItem(attendanceSharedDeviceKey);
    window.dispatchEvent(new Event(preferenceEvent));
    return true;
  } catch {
    return false;
  }
}

/** Subscribes React to same-tab and cross-tab shared-device preference changes. */
export function subscribeSharedDevicePreference(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === attendanceSharedDeviceKey) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(preferenceEvent, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(preferenceEvent, onChange);
  };
}
