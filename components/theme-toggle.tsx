"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const themeOptions = [
  { value: "light", label: "Terang", icon: Sun },
  { value: "system", label: "Sistem", icon: Monitor },
  { value: "dark", label: "Gelap", icon: Moon },
] as const;

function subscribeToHydration() {
  return () => undefined;
}

export function ThemeToggle({ className }: { className?: string }) {
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const { theme, setTheme } = useTheme();

  function handleThemeChange(themeName: string) {
    setTheme(themeName);
  }

  return (
    <div
      aria-label="Pilih tema"
      className={cn(
        "inline-flex rounded-xl border bg-card p-1 shadow-sm",
        className,
      )}
      role="group"
    >
      {themeOptions.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          aria-label={`Tema ${label.toLowerCase()}`}
          aria-pressed={mounted && theme === value}
          className="size-10 sm:size-11"
          onClick={() => handleThemeChange(value)}
          size="icon"
          type="button"
          variant={mounted && theme === value ? "secondary" : "ghost"}
        >
          <Icon aria-hidden="true" />
        </Button>
      ))}
    </div>
  );
}
