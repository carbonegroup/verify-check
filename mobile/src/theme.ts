/**
 * Thème mobile VerifyCheck — direction « Enterprise Light ».
 *
 * Tokens réutilisés par tous les écrans. Aucune couleur magique en dur dans les
 * composants : tout passe par ce thème.
 *
 * - fond général   : bleu-gris très clair (#F3F6FA)
 * - surfaces       : blanc (#FFFFFF)
 * - primaire       : bleu marine (#17365D)  boutons, états actifs
 * - secondaire     : bleu (#315B86)
 * - succès         : vert (#16835D)  présences confirmées
 * - attention      : orange (#A86F12)  états en attente / doublons
 * - danger         : rouge (#BD4545)  absences et erreurs
 * - bordures       : léger (#E2E8F0)
 * - zone caméra    : sombre uniquement pour le contraste de lecture QR
 */

export const theme = {
  paper: "#F3F6FA",
  card: "#FFFFFF",
  ink: "#162536",
  inkSoft: "#5B6B7C",
  accent: "#17365D",
  accentInk: "#0F2A4A",
  secondary: "#315B86",
  success: "#16835D",
  successInk: "#0B4B37",
  warn: "#A86F12",
  warnInk: "#7A4E0D",
  danger: "#BD4545",
  dangerInk: "#8B2E2E",
  line: "#E2E8F0",
  scanBg: "#12181F",
  white: "#FFFFFF",
  radius: 8,
  radiusSm: 4,
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  type: { body: 15, small: 13, title: 20, big: 28 },
} as const;

export const statutCouleur: Record<string, string> = {
  present: theme.success,
  "non-pointe": theme.warn,
  absent: theme.danger,
};
