import type { NextRequest } from "next/server";

// request.url は開発サーバーだと localhost に書き換わっている。Cookie は開いたホストに付くので、
// 127.0.0.1 で開いたなら 127.0.0.1 に戻さないとログインが外れる。実際に来たホストから組み立てる
export function originOf(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}
