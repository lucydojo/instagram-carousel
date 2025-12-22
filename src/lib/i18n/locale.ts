import type { SupportedLocale } from "@/lib/i18n/messages";

export const DEFAULT_LOCALE: SupportedLocale = "pt-BR";
export const LOCALE_COOKIE = "dojogram_locale";

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return value === "pt-BR" || value === "en";
}

export async function getLocale(): Promise<SupportedLocale> {
  return DEFAULT_LOCALE;
}

export function getHtmlLang(locale: SupportedLocale): string {
  return locale === "pt-BR" ? "pt-BR" : "en";
}
