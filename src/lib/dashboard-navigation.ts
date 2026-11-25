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
  | "developpeur"
  | "utilisateurs"
  | "journal"
  | "securite"
  | "scolarite"
  | "comptabilite";

export type DashboardFilter = "date" | "classe" | "cours";

const DISABLED_DASHBOARD_VIEWS: ReadonlySet<DashboardView> = new Set([
  "scolarite",
  "comptabilite",
]);

const DASHBOARD_VIEW_FILTERS: Partial<Record<DashboardView, readonly DashboardFilter[]>> = {
  general: ["date", "classe", "cours"],
  absences: ["date", "classe", "cours"],
  classes: ["date", "classe"],
  cours: ["date", "classe", "cours"],
  eleves: ["date", "classe", "cours"],
  cartes: ["classe"],
};

export function isDashboardViewEnabled(view: DashboardView): boolean {
  return !DISABLED_DASHBOARD_VIEWS.has(view);
}

export function getDashboardFilters(view: DashboardView): readonly DashboardFilter[] {
  return DASHBOARD_VIEW_FILTERS[view] ?? [];
}

export function isDeveloperView(view: DashboardView): boolean {
  return view === "developpeur" || view === "utilisateurs" || view === "journal";
}
