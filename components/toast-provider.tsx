"use client";

import { ToastContainer } from "react-toastify";

/**
 * Mounts the single application-wide toast region.
 * It accepts no input and renders transient, accessible notifications at the bottom right;
 * its UI side effect is displaying queued React Toastify messages above page content.
 */
export function ToastProvider() {
  return (
    <ToastContainer
      autoClose={4000}
      closeOnClick
      limit={3}
      newestOnTop
      position="bottom-right"
      role="status"
      style={{
        bottom: "max(1rem, env(safe-area-inset-bottom))",
        left: "auto",
        right: "max(1rem, env(safe-area-inset-right))",
        top: "auto",
        transform: "none",
        width: "min(24rem, calc(100vw - 2rem))",
      }}
      theme="colored"
    />
  );
}
