"use client";

const sidebarCookieName = "glutong_sidebar_collapsed";

/** Persists the uncontrolled desktop sidebar checkbox owned by the shared workspace layout. */
export function WorkspaceSidebarPreference({ defaultChecked }: { defaultChecked: boolean }) {
  return (
    <input
      className="peer/workspace-sidebar sr-only"
      defaultChecked={defaultChecked}
      id="workspace-sidebar-toggle"
      onChange={(event) => {
        document.cookie = `${sidebarCookieName}=${event.currentTarget.checked ? "1" : "0"}; Max-Age=31536000; Path=/; SameSite=Lax`;
      }}
      type="checkbox"
    />
  );
}
