"use client";

import { useSyncExternalStore } from "react";
import { ToastContainer } from "react-toastify";

const compactWorkspaceQuery = "(max-width: 63.999rem)";

/** Subscribes toast placement to the same compact breakpoint used by mobile navigation. */
function subscribeToCompactWorkspace(onStoreChange: () => void) {
  const media = window.matchMedia(compactWorkspaceQuery);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

/** Reports whether bottom controls occupy the compact workspace viewport. */
function getCompactWorkspace() {
  return window.matchMedia(compactWorkspaceQuery).matches;
}

/**
 * Mounts the single application-wide toast region.
 * It accepts no input and renders transient, accessible notifications above mobile controls or at the desktop bottom right;
 * its UI side effect is displaying queued React Toastify messages above page content.
 */
export function ToastProvider() {
  const compact = useSyncExternalStore(subscribeToCompactWorkspace, getCompactWorkspace, () => false);
  return (
    <ToastContainer
      autoClose={4000}
      closeOnClick
      limit={3}
      newestOnTop
      position={compact ? "top-center" : "bottom-right"}
      role="status"
      style={compact
        ? { bottom: "auto", left: "50%", right: "auto", top: "calc(env(safe-area-inset-top) + 0.75rem)", transform: "translateX(-50%)", width: "min(24rem, calc(100vw - 1.5rem))" }
        : { bottom: "max(1rem, env(safe-area-inset-bottom))", left: "auto", right: "max(1rem, env(safe-area-inset-right))", top: "auto", transform: "none", width: "min(24rem, calc(100vw - 2rem))" }}
      theme="colored"
    />
  );
}
