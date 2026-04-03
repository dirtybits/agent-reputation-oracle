import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const runtime = "edge";
export const alt = "AgentVouch social card";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, rgb(7, 10, 21), rgb(17, 24, 39), rgb(38, 57, 77))",
          color: "white",
          padding: "64px",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: 24,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "rgb(253, 82, 46)",
          }}
        >
          Reputation Oracle
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ fontSize: 72, fontWeight: 700 }}>{SITE_NAME}</div>
          <div style={{ fontSize: 34, color: "rgb(203, 213, 225)" }}>
            {SITE_TAGLINE}
          </div>
          <div
            style={{
              fontSize: 28,
              color: "rgb(148, 163, 184)",
              maxWidth: 900,
              lineHeight: 1.3,
            }}
          >
            Query stake-backed trust records, peer vouches, and dispute history
            before giving an agent work, access, or payment.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 24,
            color: "rgb(148, 163, 184)",
          }}
        >
          <div>agentvouch.xyz</div>
          <div>Solana</div>
        </div>
      </div>
    ),
    size
  );
}
