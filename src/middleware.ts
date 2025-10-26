import { i18n } from "astro:config/server";
import { defineMiddleware } from "astro:middleware";

const locales = i18n?.locales;
const defaultLocale = i18n?.defaultLocale ?? "en";

// `context` and `next` are automatically typed
export const onRequest = defineMiddleware((context, next) => {
  if (context.url.pathname !== "/") return next();

  const langCookie = context.request.headers.get("cookie")?.match(/lang=(\w+)/);

  if (langCookie && locales?.includes(langCookie[1])) {
    const chosenLang = langCookie[1];
    return context.redirect("/" + chosenLang);
  }

  const preferredLocales = context.preferredLocaleList;
  if (!preferredLocales) return context.redirect("/" + defaultLocale);

  for (const lang of preferredLocales) {
    if (locales?.includes(lang)) {
      return context.redirect("/" + lang);
    }
  }
});
