import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getDashboardFilters,
  isDashboardViewEnabled,
  isDeveloperView,
  type DashboardView,
} from "../src/lib/dashboard-navigation.ts";

test("les sections financières restent désactivées", () => {
  assert.equal(isDashboardViewEnabled("scolarite"), false);
  assert.equal(isDashboardViewEnabled("comptabilite"), false);
});

test("les vues académiques communes restent accessibles", () => {
  const enabledViews: DashboardView[] = [
    "general",
    "absences",
    "classes",
    "cours",
    "eleves",
    "cartes",
    "gestion-eleves",
    "gestion-cours",
    "presences",
  ];

  for (const view of enabledViews) {
    assert.equal(isDashboardViewEnabled(view), true, `${view} doit rester accessible`);
  }
});

test("les filtres globaux sont limités aux vues qui les utilisent", () => {
  assert.deepEqual(getDashboardFilters("general"), ["date", "classe", "cours"]);
  assert.deepEqual(getDashboardFilters("absences"), ["date", "classe", "cours"]);
  assert.deepEqual(getDashboardFilters("classes"), ["date", "classe"]);
  assert.deepEqual(getDashboardFilters("cours"), ["date", "classe", "cours"]);
  assert.deepEqual(getDashboardFilters("eleves"), ["date", "classe", "cours"]);
  assert.deepEqual(getDashboardFilters("cartes"), ["classe"]);
  assert.deepEqual(getDashboardFilters("utilisateurs"), []);
  assert.deepEqual(getDashboardFilters("journal"), []);
  assert.deepEqual(getDashboardFilters("securite"), []);
  assert.deepEqual(getDashboardFilters("developpeur"), []);
});

test("les écrans développeur ne sont pas des écrans ADMIN", () => {
  assert.equal(isDeveloperView("developpeur"), true);
  assert.equal(isDeveloperView("utilisateurs"), true);
  assert.equal(isDeveloperView("journal"), true);
  assert.equal(isDeveloperView("general"), false);
  assert.equal(isDeveloperView("securite"), false);
});
