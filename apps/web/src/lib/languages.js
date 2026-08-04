// Vollständige Sprachliste für die freie Sprachwahl (Einzelrichtung).
// Deutscher Name, Eigenbezeichnung (nativ) und Sprachcode (BCP-47) für Spracherkennung/-ausgabe.
export const LANGUAGES = [
	{ code: 'de-DE', name: 'German', native: 'Deutsch' },
	{ code: 'en-US', name: 'English', native: 'English' },
	{ code: 'vi-VN', name: 'Vietnamese', native: 'Tiếng Việt' },
	{ code: 'fr-FR', name: 'French', native: 'Français' },
	{ code: 'es-ES', name: 'Spanish', native: 'Español' },
	{ code: 'it-IT', name: 'Italian', native: 'Italiano' },
	{ code: 'pt-PT', name: 'Portuguese', native: 'Português' },
	{ code: 'nl-NL', name: 'Dutch', native: 'Nederlands' },
	{ code: 'pl-PL', name: 'Polish', native: 'Polski' },
	{ code: 'tr-TR', name: 'Turkish', native: 'Türkçe' },
	{ code: 'ar-SA', name: 'Arabic', native: 'العربية' },
	{ code: 'ru-RU', name: 'Russian', native: 'Русский' },
	{ code: 'uk-UA', name: 'Ukrainian', native: 'Українська' },
	{ code: 'zh-CN', name: 'Chinese', native: '中文' },
	{ code: 'ja-JP', name: 'Japanese', native: '日本語' },
	{ code: 'ko-KR', name: 'Korean', native: '한국어' },
	{ code: 'th-TH', name: 'Thai', native: 'ไทย' },
	{ code: 'id-ID', name: 'Indonesian', native: 'Bahasa Indonesia' },
	{ code: 'hi-IN', name: 'Hindi', native: 'हिन्दी' },
	{ code: 'sv-SE', name: 'Swedish', native: 'Svenska' },
	{ code: 'da-DK', name: 'Danish', native: 'Dansk' },
	{ code: 'nb-NO', name: 'Norwegian', native: 'Norsk' },
	{ code: 'fi-FI', name: 'Finnish', native: 'Suomi' },
	{ code: 'el-GR', name: 'Greek', native: 'Ελληνικά' },
	{ code: 'cs-CZ', name: 'Czech', native: 'Čeština' },
	{ code: 'sk-SK', name: 'Slovak', native: 'Slovenčina' },
	{ code: 'hu-HU', name: 'Hungarian', native: 'Magyar' },
	{ code: 'ro-RO', name: 'Romanian', native: 'Română' },
	{ code: 'bg-BG', name: 'Bulgarian', native: 'Български' },
	{ code: 'hr-HR', name: 'Croatian', native: 'Hrvatski' },
	{ code: 'sr-RS', name: 'Serbian', native: 'Српски' },
	{ code: 'sl-SI', name: 'Slovenian', native: 'Slovenščina' },
	{ code: 'lt-LT', name: 'Lithuanian', native: 'Lietuvių' },
	{ code: 'lv-LV', name: 'Latvian', native: 'Latviešu' },
	{ code: 'et-EE', name: 'Estonian', native: 'Eesti' },
	{ code: 'he-IL', name: 'Hebrew', native: 'עברית' },
	{ code: 'fa-IR', name: 'Persian', native: 'فارسی' },
	{ code: 'ur-PK', name: 'Urdu', native: 'اردو' },
	{ code: 'bn-BD', name: 'Bengali', native: 'বাংলা' },
	{ code: 'ta-IN', name: 'Tamil', native: 'தமிழ்' },
	{ code: 'te-IN', name: 'Telugu', native: 'తెలుగు' },
	{ code: 'mr-IN', name: 'Marathi', native: 'मराठी' },
	{ code: 'gu-IN', name: 'Gujarati', native: 'ગુજરાતી' },
	{ code: 'pa-IN', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
	{ code: 'ml-IN', name: 'Malayalam', native: 'മലയാളം' },
	{ code: 'kn-IN', name: 'Kannada', native: 'ಕನ್ನಡ' },
	{ code: 'si-LK', name: 'Sinhala', native: 'සිංහල' },
	{ code: 'ms-MY', name: 'Malay', native: 'Bahasa Melayu' },
	{ code: 'fil-PH', name: 'Filipino', native: 'Filipino' },
	{ code: 'km-KH', name: 'Khmer', native: 'ខ្មែរ' },
	{ code: 'lo-LA', name: 'Lao', native: 'ລາວ' },
	{ code: 'my-MM', name: 'Burmese', native: 'မြန်မာ' },
	{ code: 'mn-MN', name: 'Mongolian', native: 'Монгол' },
	{ code: 'ka-GE', name: 'Georgian', native: 'ქართული' },
	{ code: 'hy-AM', name: 'Armenian', native: 'Հայերեն' },
	{ code: 'az-AZ', name: 'Azerbaijani', native: 'Azərbaycan' },
	{ code: 'kk-KZ', name: 'Kazakh', native: 'Қазақ' },
	{ code: 'uz-UZ', name: 'Uzbek', native: 'Oʻzbek' },
	{ code: 'sw-KE', name: 'Swahili', native: 'Kiswahili' },
	{ code: 'am-ET', name: 'Amharic', native: 'አማርኛ' },
	{ code: 'af-ZA', name: 'Afrikaans', native: 'Afrikaans' },
	{ code: 'zu-ZA', name: 'Zulu', native: 'isiZulu' },
	{ code: 'is-IS', name: 'Icelandic', native: 'Íslenska' },
	{ code: 'ga-IE', name: 'Irish', native: 'Gaeilge' },
	{ code: 'ca-ES', name: 'Catalan', native: 'Català' },
	{ code: 'eu-ES', name: 'Basque', native: 'Euskara' },
	{ code: 'gl-ES', name: 'Galician', native: 'Galego' },
	{ code: 'sq-AL', name: 'Albanian', native: 'Shqip' },
	{ code: 'mk-MK', name: 'Macedonian', native: 'Македонски' },
	{ code: 'bs-BA', name: 'Bosnian', native: 'Bosanski' },
	{ code: 'ne-NP', name: 'Nepali', native: 'नेपाली' },
	{ code: 'zh-TW', name: 'Chinese (Traditional)', native: '中文（繁體）' },
];

// Feste, vorgegebene Sprachauswahl für den Dialogmodus – bewusst begrenzt und
// stets identisch, damit beide Gesprächspartner verlässlich daraus wählen.
export const DIALOG_LANGUAGES = [
	{ code: 'de-DE', name: 'German', native: 'Deutsch' },
	{ code: 'en-US', name: 'English', native: 'English' },
	{ code: 'vi-VN', name: 'Vietnamese', native: 'Tiếng Việt' },
	{ code: 'fr-FR', name: 'French', native: 'Français' },
	{ code: 'es-ES', name: 'Spanish', native: 'Español' },
	{ code: 'it-IT', name: 'Italian', native: 'Italiano' },
	{ code: 'pt-PT', name: 'Portuguese', native: 'Português' },
	{ code: 'nl-NL', name: 'Dutch', native: 'Nederlands' },
	{ code: 'pl-PL', name: 'Polish', native: 'Polski' },
	{ code: 'tr-TR', name: 'Turkish', native: 'Türkçe' },
	{ code: 'ar-SA', name: 'Arabic', native: 'العربية' },
	{ code: 'ru-RU', name: 'Russian', native: 'Русский' },
	{ code: 'uk-UA', name: 'Ukrainian', native: 'Українська' },
	{ code: 'zh-CN', name: 'Chinese', native: '中文' },
	{ code: 'ja-JP', name: 'Japanese', native: '日本語' },
	{ code: 'ko-KR', name: 'Korean', native: '한국어' },
	{ code: 'th-TH', name: 'Thai', native: 'ไทย' },
	{ code: 'id-ID', name: 'Indonesian', native: 'Bahasa Indonesia' },
	{ code: 'hi-IN', name: 'Hindi', native: 'हिन्दी' },
];

// Häufig verwendete Sprachen als Schnellwahl (freie Sprachwahl).
export const QUICK_CODES = ['de-DE', 'en-US', 'tr-TR', 'ar-SA', 'vi-VN', 'ru-RU'];

// Schnellwahl innerhalb des Dialogmodus (Teilmenge der vorgegebenen Sprachen).
export const DIALOG_QUICK_CODES = ['de-DE', 'en-US', 'tr-TR', 'ar-SA', 'vi-VN', 'ru-RU'];

export function getLanguageByCode(code) {
	return (
		LANGUAGES.find((l) => l.code === code) ||
		DIALOG_LANGUAGES.find((l) => l.code === code) ||
		null
	);
}

export function isDialogLanguageCode(code) {
	return DIALOG_LANGUAGES.some((l) => l.code === code);
}
