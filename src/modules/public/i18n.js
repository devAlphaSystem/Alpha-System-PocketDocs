/**
 * @module public/i18n
 * @description Browser language negotiation and translation of public UI messages.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const translations = require("./translations.json");

export function createPublicTranslator(locale = "en") {
  const messages = translations[locale];
  const pluralRules = new Intl.PluralRules(locale);

  return (source, parameters = {}) => {
    let message = Object.hasOwn(messages, source) ? messages[source] : Object.hasOwn(translations.en, source) ? translations.en[source] : source;
    if (typeof message === "object") {
      message = message[pluralRules.select(parameters.count)] || message.other;
    }
    return message.replace(/\{(\w+)\}/g, (placeholder, name) => (Object.hasOwn(parameters, name) ? String(parameters[name]) : placeholder));
  };
}

function detectPublicLocale(req) {
  for (const preference of req.acceptsLanguages()) {
    const [language, ...subtags] = preference.toLowerCase().split("-");
    if (language === "*") return "en";
    if (language === "pt") return subtags.includes("pt") ? "pt-PT" : "pt-BR";
    if (language === "zh") {
      if (subtags.includes("hans")) return "zh-CN";
      return subtags.some((tag) => ["hant", "tw", "hk", "mo"].includes(tag)) ? "zh-TW" : "zh-CN";
    }
    if (Object.hasOwn(translations, language)) return language;
  }
  return "en";
}

export function publicLocaleMiddleware(req, res, next) {
  if (/^\/(admin|auth|setup)(\/|$)/i.test(req.path)) {
    return next();
  }

  const locale = detectPublicLocale(req);
  res.locals.publicLocale = locale;
  res.locals.publicDirection = locale === "ar" ? "rtl" : "ltr";
  res.locals.t = createPublicTranslator(locale);
  res.vary("Accept-Language");
  res.set("Content-Language", locale);
  next();
}
