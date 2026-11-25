import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidEmailAddress } from "../src/lib/validation.ts";

test("isValidEmailAddress accepte les adresses usuelles", () => {
  assert.equal(isValidEmailAddress("marco@ucao.edu"), true);
  assert.equal(isValidEmailAddress("prenom.nom+tag@sub.domain.gn"), true);
});

test("isValidEmailAddress rejette les structures invalides", () => {
  for (const value of [
    "",
    "plain-address",
    "@domain.com",
    "name@",
    "name@domain",
    "name@@domain.com",
    "name@.domain.com",
    "name@domain..com",
    "name@-domain.com",
    "name@domain-.com",
    "name @domain.com",
    "name@domain .com",
  ]) {
    assert.equal(isValidEmailAddress(value), false, value);
  }
});

test("isValidEmailAddress borne immédiatement les entrées démesurées", () => {
  assert.equal(isValidEmailAddress("a".repeat(100_000) + "@example.com"), false);
  assert.equal(isValidEmailAddress("a".repeat(65) + "@example.com"), false);
});
