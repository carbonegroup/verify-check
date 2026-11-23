/** Design system mobile VerifyCheck — Enterprise Light. */
export const theme = {
  paper: "#F3F6FA",
  card: "#FFFFFF",
  white: "#FFFFFF",
  ink: "#172B45",
  inkSoft: "#64748B",
  muted: "#8291A4",
  navy: "#17365D",
  navySoft: "#EDF3F9",
  blue: "#315B86",
  accent: "#17365D",
  accentInk: "#102B4B",
  success: "#16835D",
  warn: "#A86F12",
  danger: "#BD4545",
  line: "#E2E8F0",
  scanBg: "#EAF0F5",
  radius: 12,
  radiusSm: 8,
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  type: { body: 15, small: 13, title: 22, big: 30 },
} as const;

export const statutCouleur: Record<string, string> = {
  present: theme.success,
  "non-pointe": theme.warn,
  absent: theme.danger,
};
