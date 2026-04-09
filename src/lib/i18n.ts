import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Legacy single-file locales (kept for backward compat)
import enLegacy from "@/locales/en.json";
import esLegacy from "@/locales/es.json";
import frLegacy from "@/locales/fr.json";
import deLegacy from "@/locales/de.json";

// New namespace-based locales
import enCommon from "@/i18n/locales/en/common.json";
import enNavigation from "@/i18n/locales/en/navigation.json";
import enForms from "@/i18n/locales/en/forms.json";
import enErrors from "@/i18n/locales/en/errors.json";
import enMessages from "@/i18n/locales/en/messages.json";

import esCommon from "@/i18n/locales/es/common.json";
import esNavigation from "@/i18n/locales/es/navigation.json";
import esForms from "@/i18n/locales/es/forms.json";
import esErrors from "@/i18n/locales/es/errors.json";
import esMessages from "@/i18n/locales/es/messages.json";

import frCommon from "@/i18n/locales/fr/common.json";
import frNavigation from "@/i18n/locales/fr/navigation.json";
import frForms from "@/i18n/locales/fr/forms.json";
import frErrors from "@/i18n/locales/fr/errors.json";
import frMessages from "@/i18n/locales/fr/messages.json";

import deCommon from "@/i18n/locales/de/common.json";
import deNavigation from "@/i18n/locales/de/navigation.json";
import deForms from "@/i18n/locales/de/forms.json";
import deErrors from "@/i18n/locales/de/errors.json";
import deMessages from "@/i18n/locales/de/messages.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enLegacy,
        common: enCommon,
        navigation: enNavigation,
        forms: enForms,
        errors: enErrors,
        messages: enMessages,
      },
      es: {
        translation: esLegacy,
        common: esCommon,
        navigation: esNavigation,
        forms: esForms,
        errors: esErrors,
        messages: esMessages,
      },
      fr: {
        translation: frLegacy,
        common: frCommon,
        navigation: frNavigation,
        forms: frForms,
        errors: frErrors,
        messages: frMessages,
      },
      de: {
        translation: deLegacy,
        common: deCommon,
        navigation: deNavigation,
        forms: deForms,
        errors: deErrors,
        messages: deMessages,
      },
    },
    fallbackLng: "en",
    defaultNS: "common",
    ns: ["translation", "common", "navigation", "forms", "errors", "messages"],
    supportedLngs: ["en", "es", "fr", "de"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "fitcheck_language",
      caches: ["localStorage"],
    },
  });

export default i18n;
