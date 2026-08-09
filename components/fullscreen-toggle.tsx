"use client";

import { useState, useSyncExternalStore } from "react";
import { CheckCircle2, Maximize2, Minimize2, Share, Smartphone } from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type FullscreenState = "unsupported" | "installable" | "standalone" | "inactive" | "active";

/** Subscribes the toggle to fullscreen changes, including exits triggered with Escape. */
function subscribeToFullscreen(onStoreChange: () => void) {
  document.addEventListener("fullscreenchange", onStoreChange);
  return () => document.removeEventListener("fullscreenchange", onStoreChange);
}

/** Detects Apple mobile devices that need a Home Screen launch instead of the Fullscreen API. */
function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Detects an installed home-screen launch across standards-based and legacy iOS browsers. */
function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Returns the browser's current fullscreen capability and state. */
function getFullscreenState(): FullscreenState {
  if (isStandaloneDisplay()) return "standalone";
  if (!document.fullscreenEnabled) return isIosDevice() ? "installable" : "unsupported";
  return document.fullscreenElement ? "active" : "inactive";
}

/** Toggles browser fullscreen while keeping its label and icon synchronized. */
export function FullscreenToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const state = useSyncExternalStore(subscribeToFullscreen, getFullscreenState, () => "unsupported");
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const active = state === "active";
  const label = state === "unsupported"
    ? "Fullscreen tidak didukung"
    : state === "installable"
      ? "Pasang mode aplikasi"
      : state === "standalone"
        ? "Mode aplikasi aktif"
        : active ? "Keluar fullscreen" : "Fullscreen";

  /** Enters or exits fullscreen from the user's direct button action. */
  async function handleFullscreenToggle() {
    if (state === "installable") {
      setInstallHelpOpen(true);
      return;
    }
    if (state === "unsupported" || state === "standalone") return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast.error("Mode fullscreen tidak dapat diaktifkan di browser ini.");
    }
  }

  return (
    <>
      <Button
        aria-label={label}
        aria-pressed={state === "active" ? true : state === "inactive" ? false : undefined}
        className={cn(!compact && "gap-2", className)}
        disabled={state === "unsupported" || state === "standalone"}
        onClick={handleFullscreenToggle}
        size={compact ? "icon" : "default"}
        title={label}
        type="button"
        variant="outline"
      >
        {state === "installable" ? <Smartphone aria-hidden="true" /> : state === "standalone" ? <CheckCircle2 aria-hidden="true" /> : active ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
        {!compact && <span className="workspace-sidebar-label">{label}</span>}
      </Button>

      <Dialog onOpenChange={setInstallHelpOpen} open={installHelpOpen}>
        <DialogContent className="sm:w-[min(28rem,calc(100vw-3rem))]">
          <DialogHeader>
            <div aria-hidden="true" className="mb-2 grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground"><Smartphone className="size-5" /></div>
            <DialogTitle>Gunakan seperti aplikasi di iPhone</DialogTitle>
            <DialogDescription>Pasang Glutong POS ke Layar Utama agar terbuka tanpa bilah alamat Safari.</DialogDescription>
          </DialogHeader>
          <ol className="grid gap-3">
            {["Buka halaman ini menggunakan Safari.", "Ketuk tombol Bagikan di toolbar Safari.", "Pilih Tambahkan ke Layar Utama, lalu ketuk Tambah.", "Buka Glutong POS dari ikon di Layar Utama."].map((step, index) => (
              <li className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-3 rounded-xl border bg-muted/35 p-3 text-sm leading-6" key={step}>
                <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-background font-mono text-xs font-semibold ring-1 ring-foreground/10">{index + 1}</span>
                <span>{step}{index === 1 && <Share aria-hidden="true" className="ml-2 inline size-4 text-primary" />}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs leading-5 text-muted-foreground">iPhone tidak mengizinkan halaman web menyalakan fullscreen langsung. Mode aplikasi aktif saat POS dibuka dari ikon Layar Utama.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
