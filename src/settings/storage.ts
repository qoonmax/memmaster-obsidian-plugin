import {Plugin} from 'obsidian';

interface MemMasterPluginSettings {
	sourceMode: 'tag' | 'folder';
	tagName: string;
	folderName: string;
	isBlurFlashcardText: boolean;
	openInPreviewMode: boolean;
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
	const data = await plugin.loadData() as Partial<MemMasterPluginSettings> | null;
	return Object.assign({}, DEFAULT_SETTINGS, data ?? {});
}

async function saveSettings(plugin: Plugin, settings: MemMasterPluginSettings): Promise<void> {
	await plugin.saveData(settings);
}

export type { MemMasterPluginSettings };
export { DEFAULT_SETTINGS, loadSettings, saveSettings };