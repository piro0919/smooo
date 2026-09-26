import type { MetadataRoute } from "next";

// ホーム画面に追加したとき、ブラウザの枠なしで開く。iPhone で通知を受けるにはこの形が要る
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smooo",
    short_name: "Smooo",
    description: "やり取りは、AI が進めるチャット",
    start_url: "/",
    display: "standalone",
    background_color: "#3f0e40",
    theme_color: "#3f0e40",
    lang: "ja",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
