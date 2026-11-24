import { test } from "node:test";
import assert from "node:assert/strict";
import { isDashboardViewEnabled, type DashboardView } from "../src/lib/dashboard-navigation.ts";

test("les sections financières sont désactivées", () => {
  assert.equal(isDashboardViewEnabled("scolarite"), false);
  assert.equal(isDashboardViewEnabled("comptabilite"), false);
});

test("les autres sections du dashboard restent accessibles", () => {
  const enabledViews: DashboardView[] = [
    "general",
    "absences",
    "classes",
    "cours",
    "eleves",
    "cartes",
  ];

  for (const view of enabledViews) {
    assert.equal(isDashboardViewEnabled(view), true, `${view} doit rester accessible`);
  }
});
