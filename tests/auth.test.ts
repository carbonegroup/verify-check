import { test } from "node:test";
import assert from "node:assert/strict";

// Set dummy env vars BEFORE importing auth (which imports env)
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";

import { isAdminRole } from "../src/lib/auth.ts";

test("isAdminRole lit le rôle uniquement dans app_metadata", () => {
  assert.ok(isAdminRole({ app_metadata: { role: "admin" } }));
  // user_metadata ne doit JAMAIS être pris en compte (usurpation possible côté client)
  assert.ok(!isAdminRole({ app_metadata: {} } as never));
  assert.ok(!isAdminRole({ app_metadata: null } as never));
  assert.ok(!isAdminRole({} as never));
});

test("isAdminRole rejette un rôle non admin dans app_metadata", () => {
  assert.ok(!isAdminRole({ app_metadata: { role: "teacher" } }));
  assert.ok(!isAdminRole({ app_metadata: { role: "" } }));
});
