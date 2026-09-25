import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Supabase のログインの戻り先が 127.0.0.1 なので、開発サーバーもそこで開く
  allowedDevOrigins: ["127.0.0.1"],
  // 整形の指示文は実行時にファイルから読む。デプロイ先に含まれるよう明示する
  outputFileTracingIncludes: {
    "/**": ["./src/lib/ai/*.md"],
  },
};

export default nextConfig;
