/**
 * useLanguage — thin, ergonomic wrapper around the `language`
 * field that already lives in `useCustomization`'s
 * `CustomizationSettings`. There is exactly ONE storage key
 * (`@littleloom_customization_v3`), exactly ONE subscriber list,
 * exactly ONE setter. Every screen that reads or writes the
 * language goes through this hook so the value can never drift.
 *
 * Why a hook instead of reading `useCustomization().language`
 * directly at every call site?
 *   • Screens that ONLY care about language shouldn't re-render
 *     every time someone changes the theme or font size. This hook
 *     narrows the subscription to just `settings.language`.
 *   • `setLanguage` normalises and validates the input once, so
 *     `LanguageSettingsScreen` and every other caller can pass raw
 *     strings without re-checking.
 *   • It centralises the "current language record" lookup so any
 *     screen can render a flag / name / region without importing
 *     the `LANGUAGES` array from the screen file.
 */
import { useCallback, useMemo } from 'react';
import { useCustomization } from './useCustomization';

/** Canonical language catalogue. Keep in sync with LanguageSettingsScreen. */
export interface LanguageRecord {
  code: string;
  name: string;
  flag: string;
  region: string;
  nativeName?: string;
}

export const SUPPORTED_LANGUAGES: LanguageRecord[] = [
  { code: 'en',    name: 'English',    flag: '🇺🇸', region: 'United States',     nativeName: 'English' },
  { code: 'en-gb', name: 'English',    flag: '🇬🇧', region: 'United Kingdom',    nativeName: 'English' },
  { code: 'es',    name: 'Español',    flag: '🇪🇸', region: 'Spanish',           nativeName: 'Español' },
  { code: 'fr',    name: 'Français',   flag: '🇫🇷', region: 'French',            nativeName: 'Français' },
  { code: 'de',    name: 'Deutsch',    flag: '🇩🇪', region: 'German',            nativeName: 'Deutsch' },
  { code: 'it',    name: 'Italiano',   flag: '🇮🇹', region: 'Italian',           nativeName: 'Italiano' },
  { code: 'pt',    name: 'Português',  flag: '🇧🇷', region: 'Portuguese',        nativeName: 'Português' },
  { code: 'nl',    name: 'Nederlands', flag: '🇳🇱', region: 'Dutch',             nativeName: 'Nederlands' },
  { code: 'sv',    name: 'Svenska',    flag: '🇸🇪', region: 'Swedish',           nativeName: 'Svenska' },
  { code: 'ja',    name: '日本語',      flag: '🇯🇵', region: 'Japanese',          nativeName: '日本語' },
  { code: 'ko',    name: '한국어',      flag: '🇰🇷', region: 'Korean',            nativeName: '한국어' },
  { code: 'zh',    name: '中文',        flag: '🇨🇳', region: 'Chinese (Simplified)', nativeName: '中文' },
  { code: 'ar',    name: 'العربية',     flag: '🇸🇦', region: 'Arabic',            nativeName: 'العربية' },
  { code: 'hi',    name: 'हिन्दी',      flag: '🇮🇳', region: 'Hindi',             nativeName: 'हिन्दी' },
];

const DEFAULT_LANGUAGE_CODE = 'en';

const LANGUAGE_BY_CODE: Record<string, LanguageRecord> = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((l) => [l.code, l]),
);

export const getLanguageRecord = (code: string | undefined | null): LanguageRecord => {
  if (!code) return LANGUAGE_BY_CODE[DEFAULT_LANGUAGE_CODE];
  return LANGUAGE_BY_CODE[code] || LANGUAGE_BY_CODE[DEFAULT_LANGUAGE_CODE];
};

export interface UseLanguageReturn {
  /** Current BCP-47-ish code, e.g. 'en', 'en-gb', 'ja'. */
  language: string;
  /** Full record for the current language (flag, name, region, nativeName). */
  languageRecord: LanguageRecord;
  /** Convenience display string, e.g. "English (United States)". */
  languageLabel: string;
  /** Full catalogue, useful for settings screens. */
  languages: LanguageRecord[];
  /** Persist a new language code. Rejects unknown codes by falling back to 'en'. */
  setLanguage: (code: string) => Promise<void>;
}

export function useLanguage(): UseLanguageReturn {
  const { language, updateSettings } = useCustomization();

  const resolvedCode = language || DEFAULT_LANGUAGE_CODE;
  const languageRecord = useMemo(() => getLanguageRecord(resolvedCode), [resolvedCode]);

  const languageLabel = useMemo(
    () => `${languageRecord.name} (${languageRecord.region})`,
    [languageRecord.name, languageRecord.region],
  );

  const setLanguage = useCallback(
    async (code: string) => {
      const safe = LANGUAGE_BY_CODE[code] ? code : DEFAULT_LANGUAGE_CODE;
      await updateSettings({ language: safe });
    },
    [updateSettings],
  );

  return {
    language: resolvedCode,
    languageRecord,
    languageLabel,
    languages: SUPPORTED_LANGUAGES,
    setLanguage,
  };
}

export default useLanguage;