"use client";

import { useSyncExternalStore } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FullscreenState = "unsupported" | "inactive" | "active";

/** Subscribes the toggle to fullscreen changes, including exits triggered with Escape. */
function subscribeToFullscreen(onStoreChange: () => void) {
  document.addEventListener("fullscreenchange", onStoreChange);
  return () => document.removeEventListener("fullscreenchange", onStoreChange);
}

/** Returns the browser's current fullscreen capability and state. */
function getFullscreenState(): FullscreenState {
  if (!document.fullscreenEnabled) return "unsupported";
  return document.fullscreenElement ? "active" : "inactive";
}

/** Toggles browser fullscreen while keeping its label and icon synchronized. */
export function FullscreenToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const state = useSyncExternalStore(subscribeToFullscreen, getFullscreenState, () => "unsupported");
  const active = state === "active";
  const label = state === "unsupported" ? "Fullscreen tidak didukung" : active ? "Keluar fullscreen" : "Fullscreen";

  /** Enters or exits fullscreen from the user's direct button action. */
  async function handleFullscreenToggle() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast.error("Mode fullscreen tidak dapat diaktifkan di browser ini.");
    }
  }

  return (
    <Button
      aria-label={label}
      aria-pressed={active}
      className={cn(!compact && "gap-2", className)}
      disabled={state === "unsupported"}
      onClick={handleFullscreenToggle}
      size={compact ? "icon" : "default"}
      title={label}
      type="button"
      variant="outline"
    >
      {active ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
      {!compact && <span className="workspace-sidebar-label">{active ? "Keluar fullscreen" : "Fullscreen"}</span>}
    </Button>
  );
}
