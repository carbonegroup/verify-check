import { test } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config.mjs";

test("the same-origin scanner can use camera while microphone and geolocation stay disabled", async () => {
  const rules = await nextConfig.headers?.();
  const globalRule = rules?.find((rule) => rule.source === "/:path*");
  const policy = globalRule?.headers.find((header) => header.key === "Permissions-Policy")?.value;

  assert.equal(policy, "camera=(self), microphone=(), geolocation=()");
});
