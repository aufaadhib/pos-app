import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Generates the branded iOS home-screen icon at build time. */
export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ alignItems: "center", background: "#2C1D2B", display: "flex", height: "100%", justifyContent: "center", width: "100%" }}>
      <svg aria-hidden="true" height="132" viewBox="0 0 64 64" width="132">
        <path d="M18 17h28v8H26v14h12v-6h8v14H18V17Z" fill="#E8AC2E" />
      </svg>
    </div>,
    { ...size },
  );
}
