export type DashboardView =
  | "general"
  | "absences"
  | "classes"
  | "cours"
  | "eleves"
  | "cartes"
  | "scolarite"
  | "comptabilite";

const DISABLED_DASHBOARD_VIEWS: ReadonlySet<DashboardView> = new Set([
  "scolarite",
  "comptabilite",
]);

export function isDashboardViewEnabled(view: DashboardView): boolean {
  return !DISABLED_DASHBOARD_VIEWS.has(view);
}
