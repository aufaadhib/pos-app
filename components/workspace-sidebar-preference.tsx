"use client";

import { useEffect, useRef } from "react";

const sidebarCookieName = "glutong_sidebar_collapsed";

/** Persists the uncontrolled desktop sidebar checkbox and restores it after cached navigation. */
export function WorkspaceSidebarPreference({ defaultChecked }: { defaultChecked: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedValue = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${sidebarCookieName}=`))
      ?.split("=")[1];
    if (inputRef.current && (storedValue === "1" || storedValue === "0")) {
      inputRef.current.checked = storedValue === "1";
    }
  }, []);

  return (
    <input
      className="peer/workspace-sidebar sr-only"
      defaultChecked={defaultChecked}
      id="workspace-sidebar-toggle"
      onChange={(event) => {
        document.cookie = `${sidebarCookieName}=${event.currentTarget.checked ? "1" : "0"}; Max-Age=31536000; Path=/; SameSite=Lax`;
      }}
      ref={inputRef}
      type="checkbox"
    />
  );
}
