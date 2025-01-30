import { moment } from 'obsidian';

// Import translation files
import en from './en.json';
import ru from './ru.json';

export type Locale = 'en' | 'ru';

interface Translations {
	[key: string]: any;
}

const translations: Record<Locale, Translations> = {
	en,
	ru,
};

export class I18n {
	private locale: Locale;
	private translations: Translations;

	constructor(locale?: Locale) {
		// Get locale from Obsidian or use default
		this.locale = this.getObsidianLocale(locale);
		this.translations = translations[this.locale] || translations.en;
	}

	/**
	 * Get Obsidian locale or fallback to provided locale or 'en'
	 */
	private getObsidianLocale(fallbackLocale?: Locale): Locale {
		// moment.locale() returns the current locale set by Obsidian
		const obsidianLocale = moment.locale();
		
		// Map Obsidian locales to our supported locales
		if (obsidianLocale.startsWith('ru')) {
			return 'ru';
		}
		
		// If we have a fallback locale and it's supported, use it
		if (fallbackLocale && fallbackLocale in translations) {
			return fallbackLocale;
		}
		
		// Default to English
		return 'en';
	}

	/**
	 * Get translation by key path (e.g., 'settings.cardSource.name')
	 * Supports variable interpolation using {{variable}} syntax
	 */
	t(keyPath: string, variables?: Record<string, string | number>): string {
		const keys = keyPath.split('.');
		let value: any = this.translations;

		// Navigate through the translation object
		for (const key of keys) {
			if (value && typeof value === 'object' && key in value) {
				value = value[key];
			} else {
				// If key not found, return the key itself as fallback
				console.warn(`Translation key not found: ${keyPath}`);
				return keyPath;
			}
		}

		// If final value is not a string, return the key path
		if (typeof value !== 'string') {
			console.warn(`Translation value is not a string: ${keyPath}`);
			return keyPath;
		}

		// Replace variables if provided
		if (variables) {
			return this.interpolate(value, variables);
		}

		return value;
	}

	/**
	 * Replace {{variable}} placeholders with actual values
	 */
	private interpolate(template: string, variables: Record<string, string | number>): string {
		return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
			return key in variables ? String(variables[key]) : match;
		});
	}

	/**
	 * Get current locale
	 */
	getLocale(): Locale {
		return this.locale;
	}

	/**
	 * Change locale
	 */
	setLocale(locale: Locale): void {
		if (locale in translations) {
			this.locale = locale;
			this.translations = translations[locale];
		} else {
			console.warn(`Locale not supported: ${locale}, falling back to 'en'`);
			this.locale = 'en';
			this.translations = translations.en;
		}
	}
}

