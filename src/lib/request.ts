import type { NextRequest } from "next/server";
// Next pode normalizar nextUrl para localhost atrás do proxy; use o Host recebido.
export function publicOrigin(req: NextRequest) {
  const protocol =
    req.headers.get("x-forwarded-proto")?.split(",")[0] ||
    req.nextUrl.protocol.replace(":", "");
  return `${protocol}://${req.headers.get("host") || req.nextUrl.host}`;
}
export function sameOrigin(req: NextRequest) {
  return (
    req.headers.get("origin") === publicOrigin(req) &&
    req.headers.get("sec-fetch-site") !== "cross-site"
  );
}
