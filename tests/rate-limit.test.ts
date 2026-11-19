import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit, applyRateLimit, getClientIp } from "../src/lib/rate-limit.ts";

// Mock request object for testing
const mockRequest = (ip: string) => ({
  headers: {
    get: (name: string) => {
      if (name === "x-forwarded-for") return ip;
      if (name === "x-real-ip") return ip;
      return null;
    },
  },
});

test("rateLimit autorise jusqu'au max", () => {
  const key = "test:rate:limit:1";
  // Utiliser la même clé pour tester la limite
  for (let i = 0; i < 5; i++) {
    const result = rateLimit(key, { max: 5, windowMs: 60_000 });
    assert.ok(result.allowed);
    assert.equal(result.remaining, 5 - i - 1);
  }
});

test("rateLimit bloque après max atteint", () => {
  const key = "test:block:1";
  // Utiliser la même clé pour tester le blocage
  for (let i = 0; i < 3; i++) {
    const result = rateLimit(key, { max: 3, windowMs: 60_000 });
    assert.ok(result.allowed);
  }
  const blocked = rateLimit(key, { max: 3, windowMs: 60_000 });
  assert.ok(!blocked.allowed);
  assert.equal(blocked.remaining, 0);
});

test("getClientIp extrait l'IP depuis x-forwarded-for", () => {
  assert.equal(getClientIp(mockRequest("192.168.1.1")), "192.168.1.1");
  assert.equal(getClientIp(mockRequest("10.0.0.1, 10.0.0.2")), "10.0.0.1");
});

test("getClientIp utilise x-real-ip en fallback", () => {
  const req = {
    headers: {
      get: (name: string) => (name === "x-real-ip" ? "1.2.3.4" : null),
    },
  };
  assert.equal(getClientIp(req), "1.2.3.4");
});

test("getClientIp retourne unknown si pas d'IP", () => {
  const req = { headers: { get: () => null } };
  assert.equal(getClientIp(req), "unknown");
});

test("applyRateLimit retourne le bon format", () => {
  const result = applyRateLimit(mockRequest("5.5.5.5"), { max: 10, keyPrefix: "test" });
  assert.ok(result.allowed);
  assert.equal(result.ip, "5.5.5.5");
  assert.ok(result.resetAt > Date.now());
});