import {Plugin} from 'obsidian';

interface MemMasterPluginSettings {
	sourceMode: 'tag' | 'folder';
	tagName: string;
	folderName: string;
	isBlurFlashcardText: boolean;
	openInPreviewMode: boolean;
	userKey?: string;
}

const DEFAULT_SETTINGS: MemMasterPluginSettings = {
	sourceMode: 'tag',
	tagName: 'flashcard',
	folderName: 'Flashcards',
	isBlurFlashcardText: true,
	openInPreviewMode: true,
};

// Exported functions for managing settings
async function loadSettings(plugin: Plugin): Promise<MemMasterPluginSettings> {
	const data = await plugin.loadData() as (Partial<MemMasterPluginSettings> & { accessToken?: string }) | null;
	const settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});

	delete settings.accessToken;

	return settings;
}

async function saveSettings(plugin: Plugin, settings: MemMasterPluginSettings): Promise<void> {
	await plugin.saveData(settings);
}

export type { MemMasterPluginSettings };
export { DEFAULT_SETTINGS, loadSettings, saveSettings };
