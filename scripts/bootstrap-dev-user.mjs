import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.BOOTSTRAP_DEV_EMAIL ?? "").trim().toLowerCase();
const confirmation = (process.env.CONFIRM_BOOTSTRAP_DEV_EMAIL ?? "").trim().toLowerCase();
const fullName = (process.env.BOOTSTRAP_DEV_NAME ?? "Développeur VerifyCheck").trim();
const redirectTo = process.env.AUTH_ACCOUNT_REDIRECT_URL;

if (!url || !url.startsWith("https://") || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
}
if (!redirectTo || !redirectTo.startsWith("https://") || !redirectTo.endsWith("/auth/complete")) {
  throw new Error("AUTH_ACCOUNT_REDIRECT_URL doit être une URL HTTPS qui se termine par /auth/complete.");
}
if (!email || email !== confirmation || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("Définir BOOTSTRAP_DEV_EMAIL et CONFIRM_BOOTSTRAP_DEV_EMAIL avec exactement la même adresse vérifiée.");
}
if (fullName.length < 2 || fullName.length > 100) {
  throw new Error("BOOTSTRAP_DEV_NAME doit contenir entre 2 et 100 caractères.");
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(targetEmail) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Impossible de consulter Supabase Auth: ${error.message}`);
    const found = data.users.find((user) => user.email?.toLowerCase() === targetEmail);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  throw new Error("Pagination Auth dépassée: impossible de confirmer l'unicité du compte.");
}

let user = await findUserByEmail(email);
let invited = false;
if (!user) {
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });
  if (error || !data.user) {
    throw new Error(`Invitation impossible. Vérifier l'adresse et la configuration SMTP. ${error?.message ?? ""}`);
  }
  user = data.user;
  invited = true;
}

const previousMetadata = user.app_metadata ?? {};
const { data: updated, error: metadataError } = await supabase.auth.admin.updateUserById(user.id, {
  app_metadata: { ...previousMetadata, role: "dev" },
});
if (metadataError || !updated.user) {
  throw new Error(`Le rôle Auth n'a pas pu être mis à jour: ${metadataError?.message ?? "utilisateur absent"}`);
}

const { error: registryError } = await supabase.from("app_user_roles").upsert({
  user_id: user.id,
  role: "dev",
  is_active: true,
  updated_at: new Date().toISOString(),
});
if (registryError) {
  await supabase.auth.admin.updateUserById(user.id, { app_metadata: previousMetadata });
  throw new Error(`Le registre app_user_roles n'est pas disponible. Métadonnées Auth restaurées: ${registryError.message}`);
}

console.log(JSON.stringify({
  success: true,
  action: invited ? "invitation_envoyee" : "compte_existant_promu",
  userId: updated.user.id,
  email: updated.user.email,
  role: updated.user.app_metadata?.role,
  nextStep: invited ? "Ouvrir l'e-mail d'invitation, terminer l'inscription puis se connecter." : "Se déconnecter puis se reconnecter pour renouveler le JWT.",
}, null, 2));
