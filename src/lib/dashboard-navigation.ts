export type DashboardView =
  | "general"
  | "absences"
  | "classes"
  | "cours"
  | "eleves"
  | "cartes"
  | "gestion-eleves"
  | "gestion-cours"
  | "presences"
  | "utilisateurs"
  | "journal"
  | "securite"
  | "scolarite"
  | "comptabilite";

const DISABLED_DASHBOARD_VIEWS: ReadonlySet<DashboardView> = new Set([
  "scolarite",
  "comptabilite",
]);

export function isDashboardViewEnabled(view: DashboardView): boolean {
  return !DISABLED_DASHBOARD_VIEWS.has(view);
}

export function isDeveloperView(view: DashboardView): boolean {
  return view === "utilisateurs" || view === "journal";
}
