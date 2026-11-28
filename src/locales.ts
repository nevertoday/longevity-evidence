export const LOCALE_CODES = ['zh', 'en', 'es', 'fr', 'de', 'pt', 'ja', 'ar'] as const;
export type LocaleCode = (typeof LOCALE_CODES)[number];

export type Locale = {
  code: LocaleCode;
  htmlLang: string;
  label: string;
  dir: 'ltr' | 'rtl';
  // Open Graph locale. Portuguese is pt_BR because src/ui/pt.json is written in Brazilian Portuguese.
  ogLocale: string;
  enabled: boolean;
};

// To add a language: set `enabled: true` and add src/ui/<code>.json with the same keys as zh.json.
export const LOCALES: readonly Locale[] = [
  { code: 'zh', htmlLang: 'zh-CN', label: '简体中文', dir: 'ltr', ogLocale: 'zh_CN', enabled: true },
  { code: 'en', htmlLang: 'en', label: 'English', dir: 'ltr', ogLocale: 'en_US', enabled: true },
  { code: 'es', htmlLang: 'es', label: 'Español', dir: 'ltr', ogLocale: 'es_ES', enabled: true },
  { code: 'fr', htmlLang: 'fr', label: 'Français', dir: 'ltr', ogLocale: 'fr_FR', enabled: true },
  { code: 'de', htmlLang: 'de', label: 'Deutsch', dir: 'ltr', ogLocale: 'de_DE', enabled: true },
  { code: 'pt', htmlLang: 'pt', label: 'Português', dir: 'ltr', ogLocale: 'pt_BR', enabled: true },
  { code: 'ja', htmlLang: 'ja', label: '日本語', dir: 'ltr', ogLocale: 'ja_JP', enabled: true },
  { code: 'ar', htmlLang: 'ar', label: 'العربية', dir: 'rtl', ogLocale: 'ar_AR', enabled: true },
];

export const ENABLED_LOCALES: readonly Locale[] = LOCALES.filter((l) => l.enabled);

// The root page sends visitors here when none of their browser languages is enabled.
export const FALLBACK_LOCALE: LocaleCode = 'en';
