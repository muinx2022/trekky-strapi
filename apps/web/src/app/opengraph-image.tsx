import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

export const alt = SITE_NAME;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          background:
            "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #38bdf8 100%)",
          color: "white",
          padding: "56px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: "32px",
            padding: "40px",
            background: "rgba(15, 23, 42, 0.18)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "84px",
                height: "84px",
                borderRadius: "9999px",
                background: "rgba(255,255,255,0.16)",
                fontSize: "40px",
                fontWeight: 800,
              }}
            >
              T
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ fontSize: "28px", opacity: 0.9 }}>{SITE_URL.replace("https://", "")}</div>
              <div style={{ fontSize: "64px", fontWeight: 800, letterSpacing: "-0.04em" }}>{SITE_NAME}</div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              maxWidth: "860px",
            }}
          >
            <div style={{ fontSize: "44px", lineHeight: 1.1, fontWeight: 700 }}>
              Mạng xã hội chia sẻ trải nghiệm và kết nối cộng đồng.
            </div>
            <div style={{ fontSize: "28px", lineHeight: 1.35, opacity: 0.92 }}>{SITE_DESCRIPTION}</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
