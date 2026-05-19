/**
 * i18n configuration for SmartMove.
 *
 * For now we ship a single default locale (Greek) with the next-intl
 * infrastructure fully in place. Adding English (or any other locale) means:
 *   1. Add the locale code to `LOCALES`
 *   2. Drop a matching `messages/<locale>.json`
 *   3. (Optional) Add a [locale] route segment if/when we want URL-prefixed
 *      switching. For now the locale is picked up from the user's cookie /
 *      `Accept-Language` header.
 */

export const LOCALES = ["el", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "el";

export const LOCALE_LABELS: Record<Locale, string> = {
  el: "Ελληνικά",
  en: "English",
};

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
