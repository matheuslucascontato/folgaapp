import { it, expect } from "vitest";
import { NextRequest } from "next/server";
import { sameOrigin, publicOrigin } from "../src/lib/request";
it("aceita Host público mesmo com URL interna normalizada e rejeita outra origem", () => {
  const headers = {
    host: "127.0.0.1:3001",
    origin: "http://127.0.0.1:3001",
    "x-forwarded-proto": "http",
  };
  const r = new NextRequest("http://localhost:3001/api/auth", { headers });
  expect(publicOrigin(r)).toBe("http://127.0.0.1:3001");
  expect(sameOrigin(r)).toBe(true);
  expect(
    sameOrigin(
      new NextRequest("http://localhost:3001/api/auth", {
        headers: { ...headers, origin: "https://outra-origem.example" },
      }),
    ),
  ).toBe(false);
  expect(
    sameOrigin(
      new NextRequest("http://localhost:3001/api/auth", {
        headers: { ...headers, "sec-fetch-site": "cross-site" },
      }),
    ),
  ).toBe(false);
});
