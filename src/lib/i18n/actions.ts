"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_LOCALE, isSupportedLocale, LOCALE_COOKIE } from "./locale";

const setLocaleSchema = z.object({
  locale: z.string().optional(),
  redirectTo: z.string().optional()
});

export async function setLocale(formData: FormData) {
  const parsed = setLocaleSchema.safeParse({
    locale: formData.get("locale") ? String(formData.get("locale")) : undefined,
    redirectTo: formData.get("redirectTo")
      ? String(formData.get("redirectTo"))
      : undefined
  });

  const locale =
    parsed.success && isSupportedLocale(parsed.data.locale)
      ? parsed.data.locale
      : DEFAULT_LOCALE;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });

  const redirectTo = parsed.success ? parsed.data.redirectTo : undefined;
  redirect(redirectTo && redirectTo.startsWith("/") ? redirectTo : "/");
}
