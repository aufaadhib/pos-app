import type { MetadataRoute } from "next";

/** Describes the installable standalone shell used by mobile home-screen launches. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Glutong POS",
    short_name: "Glutong",
    description: "Workspace kasir dan operasional Glutong POS.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F4F5F2",
    theme_color: "#2C1D2B",
    lang: "id-ID",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
