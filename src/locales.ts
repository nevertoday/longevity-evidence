export const LOCALE_CODES = ['zh', 'en', 'es', 'fr', 'de', 'pt', 'ja', 'ar'] as const;
export type LocaleCode = (typeof LOCALE_CODES)[number];

export type Locale = {
  code: LocaleCode;
  htmlLang: string;
  label: string;
  dir: 'ltr' | 'rtl';
  enabled: boolean;
};

// To add a language: set `enabled: true` and add src/ui/<code>.json with the same keys as zh.json.
export const LOCALES: readonly Locale[] = [
  { code: 'zh', htmlLang: 'zh-CN', label: '简体中文', dir: 'ltr', enabled: true },
  { code: 'en', htmlLang: 'en', label: 'English', dir: 'ltr', enabled: true },
  { code: 'es', htmlLang: 'es', label: 'Español', dir: 'ltr', enabled: true },
  { code: 'fr', htmlLang: 'fr', label: 'Français', dir: 'ltr', enabled: true },
  { code: 'de', htmlLang: 'de', label: 'Deutsch', dir: 'ltr', enabled: true },
  { code: 'pt', htmlLang: 'pt', label: 'Português', dir: 'ltr', enabled: true },
  { code: 'ja', htmlLang: 'ja', label: '日本語', dir: 'ltr', enabled: true },
  { code: 'ar', htmlLang: 'ar', label: 'العربية', dir: 'rtl', enabled: true },
];

export const ENABLED_LOCALES: readonly Locale[] = LOCALES.filter((l) => l.enabled);

// The root page sends visitors here when none of their browser languages is enabled.
export const FALLBACK_LOCALE: LocaleCode = 'en';
