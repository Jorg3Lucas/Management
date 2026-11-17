import { setLocaleAction } from "@/lib/i18n/actions";
import { getT } from "@/lib/i18n";
import { LOCALE_LABELS, LOCALE_SHORT, LOCALES } from "@/lib/i18n/locales";

export async function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, t } = await getT();

  return (
    <form action={setLocaleAction} className={`lang-switch${className ? ` ${className}` : ""}`}>
      <span className="lang-label">{t("common.language")}</span>
      <div className="lang-options" role="group" aria-label={t("common.language")}>
        {LOCALES.map((option) => (
          <button
            key={option}
            type="submit"
            name="locale"
            value={option}
            className={`lang-option${option === locale ? " active" : ""}`}
            aria-pressed={option === locale}
            title={LOCALE_LABELS[option]}
          >
            {LOCALE_SHORT[option]}
          </button>
        ))}
      </div>
    </form>
  );
}
