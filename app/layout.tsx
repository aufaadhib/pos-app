import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import {
  Atkinson_Hyperlegible_Next,
  Bricolage_Grotesque,
  IBM_Plex_Mono,
} from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast-provider";

import "./globals.css";

const bodyFont = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
  display: "swap",
  fallback: ["Arial"],
  adjustFontFallback: false,
});

const headingFont = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Glutong POS",
    template: "%s · Glutong POS",
  },
  description: "Workspace pelayanan kafe dan restoran Glutong POS.",
  applicationName: "Glutong POS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Glutong POS",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F5F2" },
    { media: "(prefers-color-scheme: dark)", color: "#111411" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="id"
      className={`${bodyFont.variable} ${headingFont.variable} ${monoFont.variable}`}
      suppressHydrationWarning
    >
      <body>
        <a className="fixed top-3 left-3 z-[100] -translate-y-20 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0" href="#main-content">
          Lewati ke konten utama
        </a>
        <ThemeProvider>
          {children}
          <ToastProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
