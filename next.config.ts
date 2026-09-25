import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Supabase のログインの戻り先が 127.0.0.1 なので、開発サーバーもそこで開く
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
