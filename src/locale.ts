import type { Locale } from "@iden-q/scanner-lib";

const VALID_LOCALES: Locale[] = ["en", "es"];

/** Validates and narrows the raw --lang value; defaults to "en" since
 * q-scanner's output (and this CLI's own help text) is English-first. */
export function resolveLocale(lang: string | undefined): Locale {
  if (!lang) return "en";
  if (!VALID_LOCALES.includes(lang as Locale)) {
    throw new Error(`--lang must be one of: ${VALID_LOCALES.join(", ")}`);
  }
  return lang as Locale;
}
