import { ImageResponse } from "next/og";

// iPhone のホーム画面のアイコン。SVG を受け付けないので PNG で出す。icon.svg と同じ仮のもの
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4a154b",
          color: "#ffffff",
          fontSize: 110,
          fontWeight: 700,
        }}
      >
        S
      </div>
    ),
    size,
  );
}
