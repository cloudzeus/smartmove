import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "./config";

const COOKIE_NAME = "smartmove_locale";

async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(COOKIE_NAME)?.value;
  if (isLocale(cookieValue)) return cookieValue;

  const headerStore = await headers();
  const accept = headerStore.get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.split(";")[0]?.trim().toLowerCase().slice(0, 2);
    if (isLocale(code)) return code;
  }

  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (
    await import(`./messages/${LOCALES.includes(locale) ? locale : DEFAULT_LOCALE}.json`)
  ).default;

  return {
    locale,
    messages,
    timeZone: "Europe/Athens",
  };
});
