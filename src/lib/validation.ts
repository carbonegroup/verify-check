/**
 * Lightweight bounded email-shape validation.
 * Deliberately avoids a backtracking regex on user-controlled input.
 */
export function isValidEmailAddress(value: string): boolean {
  if (value.length < 5 || value.length > 254) return false;

  let atIndex = -1;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (character.trim() === "" || codePoint < 32 || codePoint === 127) return false;
    if (character === "@") {
      if (atIndex !== -1) return false;
      atIndex = value.indexOf("@", atIndex + 1);
    }
  }

  if (atIndex <= 0 || atIndex === value.length - 1) return false;
  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);
  if (local.length > 64 || domain.length > 253) return false;

  const labels = domain.split(".");
  if (labels.length < 2) return false;
  return labels.every((label) =>
    label.length > 0 &&
    label.length <= 63 &&
    !label.startsWith("-") &&
    !label.endsWith("-")
  );
}
