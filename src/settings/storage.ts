import {Plugin} from 'obsidian';

interface MemMasterPluginSettings {
	sourceMode: 'tag' | 'folder';
	tagName: string;
	folderName: string;
	isBlurFlashcardText: boolean;
	openInPreviewMode: boolean;
	testsEnabled: boolean;
	aiProvider: 'openai' | 'deepseek';
	openaiApiKey: string;
	openaiModel: string;
	deepseekApiKey: string;
	deepseekModel: string;
	testsFolderName: string;
	testClientPrompt: string;
}

const OPENAI_MODEL_OPTIONS = [
	'gpt-5-mini',
	'gpt-5.2',
	'gpt-5.1',
	'gpt-5',
	'gpt-5-nano',
	'gpt-4.1-mini',
];

const DEEPSEEK_MODEL_OPTIONS = [
	'deepseek-v4-flash',
	'deepseek-v4-pro',
];

const DEFAULT_TEST_CLIENT_PROMPT = [
	'Generate up to 3 tests for one source card.',
	'Each question must be exactly one sentence and no more than 120 characters.',
	'Prefer practical recall questions over vague or trick questions.',
	'Choose the output language from the card context. For vocabulary or language-learning cards, write the question and explanation in the translation/explanation language, not in the language being learned.',
	'Keep answer options short, clear, and mutually exclusive.',
	'Make distractors plausible but clearly incorrect.',
].join('\n');

const DEFAULT_SETTINGS: MemMasterPluginSettings = {
	sourceMode: 'tag',
	tagName: 'flashcard',
	folderName: 'Flashcards',
	isBlurFlashcardText: true,
	openInPreviewMode: true,
	testsEnabled: false,
	aiProvider: 'openai',
	openaiApiKey: '',
	openaiModel: OPENAI_MODEL_OPTIONS[0],
	deepseekApiKey: '',
	deepseekModel: DEEPSEEK_MODEL_OPTIONS[0],
	testsFolderName: 'memmaster_tests',
	testClientPrompt: DEFAULT_TEST_CLIENT_PROMPT,
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
		testsEnabled: data?.testsEnabled ?? DEFAULT_SETTINGS.testsEnabled,
		aiProvider: data?.aiProvider ?? DEFAULT_SETTINGS.aiProvider,
		openaiApiKey: data?.openaiApiKey ?? DEFAULT_SETTINGS.openaiApiKey,
		openaiModel: data?.openaiModel?.trim() ? data.openaiModel : DEFAULT_SETTINGS.openaiModel,
		deepseekApiKey: data?.deepseekApiKey ?? DEFAULT_SETTINGS.deepseekApiKey,
		deepseekModel: data?.deepseekModel?.trim() ? data.deepseekModel : DEFAULT_SETTINGS.deepseekModel,
		testsFolderName: data?.testsFolderName?.trim() ? data.testsFolderName : DEFAULT_SETTINGS.testsFolderName,
		testClientPrompt: data?.testClientPrompt ?? DEFAULT_SETTINGS.testClientPrompt,
	};
}

async function saveSettings(plugin: Plugin, settings: MemMasterPluginSettings): Promise<void> {
	await plugin.saveData(settings);
}

export type { MemMasterPluginSettings };
export {
	DEEPSEEK_MODEL_OPTIONS,
	DEFAULT_SETTINGS,
	DEFAULT_TEST_CLIENT_PROMPT,
	OPENAI_MODEL_OPTIONS,
	loadSettings,
	saveSettings
};
