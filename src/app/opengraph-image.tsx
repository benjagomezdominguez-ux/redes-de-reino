import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { site } from "@/lib/site-config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const logoData = readFileSync(join(process.cwd(), "public", "logo.png"));
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          backgroundColor: "#12172a",
          backgroundImage:
            "radial-gradient(circle at 75% 20%, #303a5e 0%, transparent 55%)",
        }}
      >
        <img
          src={logoSrc}
          width={180}
          height={180}
          style={{ borderRadius: "50%" }}
          alt=""
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 22,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "#d6bb78",
              fontFamily: "Georgia, serif",
            }}
          >
            {site.location}
          </div>
          <div
            style={{
              fontSize: 76,
              color: "#ffffff",
              fontFamily: "Georgia, serif",
            }}
          >
            {site.name}
          </div>
          <div style={{ fontSize: 28, color: "#c8cbe0" }}>
            Fe, comunidad y propósito
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
