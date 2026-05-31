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

	return {
		sourceMode: data?.sourceMode ?? DEFAULT_SETTINGS.sourceMode,
		tagName: data?.tagName ?? DEFAULT_SETTINGS.tagName,
		folderName: data?.folderName ?? DEFAULT_SETTINGS.folderName,
		isBlurFlashcardText: data?.isBlurFlashcardText ?? DEFAULT_SETTINGS.isBlurFlashcardText,
		openInPreviewMode: data?.openInPreviewMode ?? DEFAULT_SETTINGS.openInPreviewMode,
	};
}

async function saveSettings(plugin: Plugin, settings: MemMasterPluginSettings): Promise<void> {
	await plugin.saveData(settings);
}

export type { MemMasterPluginSettings };
export { DEFAULT_SETTINGS, loadSettings, saveSettings };
