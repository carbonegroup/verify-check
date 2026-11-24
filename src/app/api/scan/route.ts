import { NextResponse, type NextRequest } from "next/server";
import {
  REFRESH_COOKIE,
  requestAccessToken,
  createServerSupabase,
  requireAdmin,
  setSessionCookies,
} from "@/lib/auth";
import { isCourseActive, schoolInstant } from "@/lib/time";
import { selectCourse } from "@/lib/scan";
import { applyRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/scan — Sprint 2 : flux scan → cours actif → écriture attendance.
 * Corps : { code_qr: string, salle?: string }
 *
 * Règles métier (vérifiées côté serveur, l'anti-doublon est garanti par l'index
 * unique d'expression en base : 1 présence par élève, par cours, par jour
 * scolaire Africa/Conakry) :
 * - qr_invalide : code QR inconnu (404) ;
 * - pas_de_cours : aucun cours de la classe active à l'heure Conakry (404) ;
 * - salle_invalide : cours actif mais salle différente de celle du portique (409) ;
 * - doublon : présence déjà enregistrée aujourd'hui pour ce cours (409).
 * Le scanner utilise la session admin du poste tablette (aucun rôle anon).
 * Rate limited : 60 requêtes/minute par IP (protection basique).
 */

type CourseRow = {
  id: string;
  nom: string;
  salle: string | null;
  jour_semaine: number;
  heure_debut: string;
  heure_fin: string;
};

export async function POST(request: NextRequest) {
  const accessToken = requestAccessToken(request);
  const auth = await requireAdmin(accessToken, request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "role_admin_requis" ? 403 : auth.status }
    );
  }

  // Use the rotated access token immediately when requireAdmin refreshes a session.
  const effectiveAccessToken = auth.session?.access_token ?? accessToken!;
  const supabase = createServerSupabase(effectiveAccessToken);
  const respondJson = (body: unknown, init?: ResponseInit) => {
    const response = NextResponse.json(body, init);
    if (auth.session) setSessionCookies(response, auth.session);
    return response;
  };

  // Rate limiting : 60 req/min par IP (scans légitimes)
  const rl = applyRateLimit(request, { max: 60, windowMs: 60_000, keyPrefix: "api:scan" });
  if (!rl.allowed) {
    return respondJson(
      { error: "trop_de_requetes", retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return respondJson({ error: "corps_invalide" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return respondJson({ error: "corps_invalide" }, { status: 400 });
  }

  const body = payload as { code_qr?: unknown; salle?: unknown; cours?: unknown };
  if (typeof body.code_qr !== "string" || !body.code_qr.trim()) {
    return respondJson({ error: "code_qr_requis" }, { status: 400 });
  }
  if (
    body.code_qr.trim().length > 64 ||
    (body.salle !== undefined && body.salle !== null && typeof body.salle !== "string") ||
    (body.cours !== undefined && body.cours !== null && typeof body.cours !== "string") ||
    (typeof body.salle === "string" && body.salle.trim().length > 128) ||
    (typeof body.cours === "string" && body.cours.trim().length > 64)
  ) {
    return respondJson({ error: "corps_invalide" }, { status: 400 });
  }

  const codeQr = body.code_qr.trim();
  const salle = typeof body.salle === "string" ? body.salle.trim() || undefined : undefined;
  const cours = typeof body.cours === "string" ? body.cours.trim() || undefined : undefined;

  const now = schoolInstant();

  // 1) Élève par code QR
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, nom, classe_id")
    .eq("code_qr", codeQr)
    .single();
  if (studentError) {
    // PGRST116 = 0 ligne (QR inconnu) ; toute autre erreur est une panne base :
    // il ne faut PAS la présenter comme un QR invalide, sinon le scanner
    // écarte le pointage comme rejet définitif (perte de présence).
    if (studentError.code === "PGRST116") {
      return respondJson({ error: "qr_invalide" }, { status: 404 });
    }
    return respondJson({ error: "erreur_base" }, { status: 500 });
  }
  if (!student) {
    return respondJson({ error: "qr_invalide" }, { status: 404 });
  }

  // Nom de classe affiché sur la fiche après lecture du QR.
  const { data: studentClass, error: classError } = await supabase
    .from("classes")
    .select("nom")
    .eq("id", student.classe_id)
    .single();
  if (classError || !studentClass) {
    return respondJson({ error: "erreur_base" }, { status: 500 });
  }

  // 2) Cours actifs de la classe au moment du scan (heure locale Conakry)
  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("id, nom, salle, jour_semaine, heure_debut, heure_fin")
    .eq("classe_id", student.classe_id)
    .eq("jour_semaine", now.jourSemaine);
  if (coursesError) {
    return respondJson({ error: "erreur_base" }, { status: 500 });
  }
  const slotCourses = (courses as CourseRow[] | null ?? []).filter((course) =>
    isCourseActive(course.heure_debut, course.heure_fin, now)
  );
  if (slotCourses.length === 0) {
    return respondJson({
      error: "pas_de_cours",
      jour: now.jour,
      heure: now.heure,
      eleve: student.nom,
      classe: studentClass.nom,
    }, { status: 404 });
  }

  // 3) Désambiguïsation : salle du portique ou cours explicite. JAMAIS de choix arbitraire.
  const selection = selectCourse(slotCourses, { salle, cours });
  if (!selection.ok) {
    if (selection.error === "cours_ambigu") {
      return respondJson(
        {
          error: selection.error,
          eleve: student.nom,
          classe: studentClass.nom,
          candidates: selection.candidates.map((c) => ({
            id: c.id,
            nom: c.nom,
            salle: c.salle,
            heure_debut: c.heure_debut,
            heure_fin: c.heure_fin,
          })),
        },
        { status: 409 }
      );
    }
    return respondJson(
      {
        error: selection.error,
        salle: (selection as { salle?: string }).salle,
        cours: (selection as { cours?: string }).cours,
        eleve: student.nom,
        classe: studentClass.nom,
      },
      { status: 409 }
    );
  }
  const course = selection.course;

  // 4) Écriture — la politique RLS et l'index unique garantissent les droits
  // admin et un seul pointage par élève/cours/journée scolaire.
  const { data: presence, error: insertError } = await supabase
    .from("attendance")
    .insert({ student_id: student.id, course_id: course.id })
    .select("id, scanned_at")
    .single();
  if (insertError) {
    if (insertError.code === "23505") {
      return respondJson(
        {
          error: "doublon",
          course: course.nom,
          cours: course.nom,
          cours_id: course.id,
          eleve: student.nom,
          classe: studentClass.nom,
          jour: now.jour,
        },
        { status: 409 }
      );
    }
    return respondJson({ error: "erreur_base" }, { status: 500 });
  }

  const response = NextResponse.json(
    {
      ok: true,
      eleve: student.nom,
      classe: studentClass.nom,
      cours: course.nom,
      cours_id: course.id,
      presence,
      jour_local: now.jour,
    },
    { status: 201 }
  );
  // Ne réécrire les cookies que si requireAdmin a effectivement renouvelé
  // la session web. Les appels Bearer de l'app mobile ne posent pas de cookies.
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}