import { setLocale } from "@/lib/i18n/actions";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/t";

export async function LocaleSwitcher({ redirectTo }: { redirectTo: string }) {
  const locale = await getLocale();

  return (
    <form action={setLocale} className="flex items-center gap-2">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <label className="sr-only" htmlFor="locale">
        {t(locale, "locale.label")}
      </label>
      <select
        id="locale"
        name="locale"
        defaultValue={locale}
        className="rounded-md border bg-transparent px-2 py-1 text-sm"
      >
        <option value="pt-BR">{t(locale, "locale.ptBr")}</option>
        <option value="en">{t(locale, "locale.en")}</option>
      </select>
      <button className="rounded-md border px-2 py-1 text-sm" type="submit">
        {t(locale, "locale.apply")}
      </button>
    </form>
  );
}
