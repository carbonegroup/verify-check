import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAbsences, isCourseFinished, statutEleve, formatPresenceAt, STATUT_LABEL } from "../src/lib/absences.ts";

// Vendredi 2026-11-13.
const date = "2026-11-13";

const classes = [
  { id: "cl-1", nom: "10e A" },
  { id: "cl-2", nom: "11e B" },
];
const cours = [
  { id: "co-math", nom: "Mathématiques", classe_id: "cl-1", salle: "B12", heure_debut: "08:00", heure_fin: "09:00" },
  { id: "co-phys", nom: "Physique", classe_id: "cl-2", salle: null, heure_debut: "08:00", heure_fin: "09:00" },
];
const eleves = [
  { id: "st-1", nom: "Alpha Barry", classe_id: "cl-1", presences: [] as Array<{ course_id: string }> },
  { id: "st-2", nom: "Fatou Camara", classe_id: "cl-1", presences: [{ course_id: "co-math" }] },
  { id: "st-3", nom: "Ibrahima Diallo", classe_id: "cl-2", presences: [] },
];

const minutes = (h: number, m = 0) => h * 60 + m;

test("isCourseFinished : sans instant courant, un cours est terminé", () => {
  assert.ok(isCourseFinished(date, "09:00"));
  assert.ok(isCourseFinished(date, undefined));
});

test("isCourseFinished : journée passée terminée, journée future non terminée", () => {
  assert.ok(isCourseFinished(date, "09:00", { jour: "2026-11-14", minutes: 0 }));
  assert.ok(!isCourseFinished(date, "09:00", { jour: "2026-11-12", minutes: 0 }));
});

test("isCourseFinished : le jour même, terminé seulement après l'heure de fin", () => {
  assert.ok(!isCourseFinished(date, "09:00", { jour: date, minutes: minutes(8, 59) }));
  assert.ok(isCourseFinished(date, "09:00", { jour: date, minutes: minutes(9, 0) }));
  assert.ok(isCourseFinished(date, "09:00", { jour: date, minutes: minutes(10, 30) }));
});

test("isCourseFinished : heure de fin inconnue → on ne déclare pas terminé", () => {
  assert.ok(!isCourseFinished(date, null, { jour: date, minutes: minutes(10, 30) }));
});

test("buildAbsences : une ligne par élève × cours terminé sans scan", () => {
  const rows = buildAbsences({ classes, cours, eleves }, { date });
  assert.deepEqual(
    rows.map((r) => r.eleve),
    ["Alpha Barry", "Ibrahima Diallo"]
  );
  const alpha = rows[0];
  assert.equal(alpha.classe, "10e A");
  assert.equal(alpha.cours, "Mathématiques");
  assert.equal(alpha.heure_debut, "08:00");
  assert.equal(alpha.heure_fin, "09:00");
  assert.equal(alpha.salle, "B12");
});

test("buildAbsences : un élève scanné n'est pas absent", () => {
  const rows = buildAbsences({ classes, cours, eleves }, { date });
  assert.ok(!rows.some((r) => r.eleve === "Fatou Camara"));
});

test("buildAbsences : le jour même, un cours non terminé n'est pas une absence", () => {
  const rows = buildAbsences(
    { classes, cours, eleves },
    { date, now: { jour: date, minutes: minutes(8, 30) } }
  );
  assert.deepEqual(rows, []);
});

test("buildAbsences : le jour même, un cours terminé déclare l'absence", () => {
  const rows = buildAbsences(
    { classes, cours, eleves },
    { date, now: { jour: date, minutes: minutes(9, 0) } }
  );
  assert.equal(rows.length, 2);
});

test("buildAbsences : journée future → aucune absence", () => {
  const rows = buildAbsences(
    { classes, cours, eleves },
    { date, now: { jour: "2026-11-12", minutes: 0 } }
  );
  assert.deepEqual(rows, []);
});

test("buildAbsences : ne considère que les élèves fournis (filtres en amont)", () => {
  const rows = buildAbsences(
    { classes, cours, eleves: eleves.filter((e) => e.classe_id === "cl-2") },
    { date }
  );
  assert.deepEqual(
    rows.map((r) => r.eleve),
    ["Ibrahima Diallo"]
  );
});

test("buildAbsences : trié par classe, puis horaire, puis élève", () => {
  const deux = [
    { id: "co-a", nom: "Anglais", classe_id: "cl-1", salle: null, heure_debut: "10:00", heure_fin: "11:00" },
    { id: "co-math", nom: "Mathématiques", classe_id: "cl-1", salle: "B12", heure_debut: "08:00", heure_fin: "09:00" },
  ];
  const rows = buildAbsences(
    {
      classes,
      cours: deux,
      eleves: [
        { id: "st-b", nom: "Zoé Bangoura", classe_id: "cl-1", presences: [] },
        { id: "st-a", nom: "Alpha Barry", classe_id: "cl-1", presences: [] },
      ],
    },
    { date }
  );
  assert.deepEqual(
    rows.map((r) => `${r.classe}|${r.heure_debut}|${r.eleve}`),
    [
      "10e A|08:00|Alpha Barry",
      "10e A|08:00|Zoé Bangoura",
      "10e A|10:00|Alpha Barry",
      "10e A|10:00|Zoé Bangoura",
    ]
  );
});

test("statutEleve : present si scan existant", () => {
  const eleve = { presences: [{ course_id: "co-math" }] };
  const cours = { id: "co-math", heure_fin: "09:00" };
  assert.equal(statutEleve(eleve, cours, date, { jour: date, minutes: 480 }), "present");
});

test("statutEleve : absent si cours terminé sans scan", () => {
  const eleve = { presences: [] };
  const cours = { id: "co-math", heure_fin: "09:00" };
  assert.equal(statutEleve(eleve, cours, date, { jour: date, minutes: 540 }), "absent");
});

test("statutEleve : non-pointe si cours non terminé sans scan", () => {
  const eleve = { presences: [] };
  const cours = { id: "co-math", heure_fin: "09:00" };
  assert.equal(statutEleve(eleve, cours, date, { jour: date, minutes: 480 }), "non-pointe");
});

test("statutEleve : present l'emporte sur terme", () => {
  const eleve = { presences: [{ course_id: "co-math" }] };
  const cours = { id: "co-math", heure_fin: "09:00" };
  // Même après l'heure de fin, si scanné → present
  assert.equal(statutEleve(eleve, cours, date, { jour: date, minutes: 1000 }), "present");
});

test("formatPresenceAt formate ISO en jj/mm hh:mm (Conakry)", () => {
  const result = formatPresenceAt("2026-11-13T08:05:00Z");
  assert.ok(result.includes("13/11") || result.includes("11/13")); // format français
  assert.ok(result.includes("08:05") || result.includes("08:05")); // heure
});

test("formatPresenceAt retourne — si date invalide", () => {
  assert.equal(formatPresenceAt("invalide"), "—");
});

test("STATUT_LABEL contient les 3 statuts", () => {
  assert.equal(STATUT_LABEL.present, "PRÉSENT");
  assert.equal(STATUT_LABEL["non-pointe"], "NON POINTÉ");
  assert.equal(STATUT_LABEL.absent, "ABSENT");
});
