import { TFile } from 'obsidian';
import MemMasterPlugin from '../main';
import { CardMetadata, extractMetadata, isCardDueForReview } from './finder';
import { isFileInFolder } from './utils';

export interface TestOption {
	id: string;
	text: string;
}

export interface MemMasterTestData {
	question: string;
	options: TestOption[];
	correctOptionId: string;
	explanation: string;
}

export interface TestMetadata extends CardMetadata {
	test: MemMasterTestData;
	sourcePath: string;
}

export const TEST_CODE_BLOCK_LANGUAGE = 'memmaster-test';

function getStringValue(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

export function getTestSourcePath(content: string): string {
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		return '';
	}

	const sourceLine = frontmatterMatch[1]
		.split('\n')
		.find((line) => line.trim().startsWith('memmaster-source-card:'));

	if (!sourceLine) {
		return '';
	}

	return sourceLine.substring(sourceLine.indexOf(':') + 1).trim().replace(/^["']|["']$/g, '');
}

export interface SourceTestFile {
	file: TFile;
	content: string;
}

function extractQuestionFromMarkdown(content: string): string {
	const body = content.replace(/^---\n[\s\S]*?\n---/, '').trim();
	const heading = body
		.split('\n')
		.find((line) => line.trim().startsWith('# '));

	return heading ? heading.replace(/^#\s+/, '').trim() : '';
}

export function parseTestData(content: string): MemMasterTestData | null {
	const blockRegex = new RegExp('```' + TEST_CODE_BLOCK_LANGUAGE + '\\s*\\n([\\s\\S]*?)\\n```');
	const match = content.match(blockRegex);

	if (!match) {
		return null;
	}

	try {
		const parsed = JSON.parse(match[1]) as Record<string, unknown>;
		const question = extractQuestionFromMarkdown(content) || getStringValue(parsed.question);
		const correctOptionId = getStringValue(parsed.correctOptionId);
		const explanation = getStringValue(parsed.explanation);
		const rawOptions = Array.isArray(parsed.options) ? parsed.options : [];
		const options = rawOptions
			.map((option): TestOption => {
				const optionRecord = option as Record<string, unknown>;
				return {
					id: getStringValue(optionRecord.id).toUpperCase(),
					text: getStringValue(optionRecord.text),
				};
			})
			.filter((option) => option.id && option.text);

		if (!question || options.length < 2 || options.length > 4) {
			return null;
		}

		if (!options.some((option) => option.id === correctOptionId)) {
			return null;
		}

		return {
			question,
			options,
			correctOptionId,
			explanation,
		};
	} catch {
		return null;
	}
}

export function buildTestContent(
	test: MemMasterTestData,
	sourceFile: TFile,
	provider: string,
	now: Date = new Date()
): string {
	const date = now.toISOString();
	const testJson = JSON.stringify({
		options: test.options,
		correctOptionId: test.correctOptionId,
		explanation: test.explanation,
	}, null, 2);

	return [
		'---',
		'memmaster-type: test',
		`memmaster-next-review: ${date}`,
		'memmaster-fsrs-state: New',
		'memmaster-fsrs-stability: 0',
		'memmaster-fsrs-difficulty: 0',
		'memmaster-fsrs-scheduled-days: 0',
		'memmaster-fsrs-reps: 0',
		'memmaster-fsrs-lapses: 0',
		'memmaster-fsrs-learning-steps: 0',
		`memmaster-source-card: "${sourceFile.path}"`,
		`memmaster-provider: ${provider}`,
		'---',
		`# ${test.question}`,
		'',
		'```' + TEST_CODE_BLOCK_LANGUAGE,
		testJson,
		'```',
		'',
	].join('\n');
}

export async function isFileTest(plugin: MemMasterPlugin, file: TFile): Promise<boolean> {
	if (!plugin.settings.testsEnabled) {
		return false;
	}

	const folderPath = plugin.settings.testsFolderName.trim().replace(/^\/+|\/+$/g, '');
	if (!folderPath) {
		return false;
	}

	if (!isFileInFolder(file.path, folderPath)) {
		return false;
	}

	const content = await plugin.app.vault.cachedRead(file);
	return parseTestData(content) !== null;
}

export async function getTestFilesForSourceCard(plugin: MemMasterPlugin, sourceFile: TFile): Promise<SourceTestFile[]> {
	if (!plugin.settings.testsEnabled) {
		return [];
	}

	const folderPath = plugin.settings.testsFolderName.trim().replace(/^\/+|\/+$/g, '');
	if (!folderPath) {
		return [];
	}

	const tests: SourceTestFile[] = [];

	for (const file of plugin.app.vault.getMarkdownFiles()) {
		if (!isFileInFolder(file.path, folderPath)) {
			continue;
		}

		const content = await plugin.app.vault.cachedRead(file);
		if (getTestSourcePath(content) === sourceFile.path) {
			tests.push({ file, content });
		}
	}

	return tests;
}

export async function countTestsForSourceCard(plugin: MemMasterPlugin, sourceFile: TFile): Promise<number> {
	return (await getTestFilesForSourceCard(plugin, sourceFile)).length;
}

export async function getTestsForReview(plugin: MemMasterPlugin): Promise<TestMetadata[]> {
	if (!plugin.settings.testsEnabled) {
		return [];
	}

	const tests: TestMetadata[] = [];

	for (const file of plugin.app.vault.getMarkdownFiles()) {
		if (!(await isFileTest(plugin, file))) {
			continue;
		}

		const content = await plugin.app.vault.cachedRead(file);
		const test = parseTestData(content);
		if (!test) {
			continue;
		}

		const extracted = extractMetadata(content, file);

		const metadata = extracted ?? {
			nextReview: '',
			file,
			content,
			legacyCompleted: false,
		};

		if (isCardDueForReview(metadata)) {
			tests.push({
				...metadata,
				test,
				sourcePath: getTestSourcePath(content),
			});
		}
	}

	return tests.sort((a, b) => {
		if (!a.nextReview) return -1;
		if (!b.nextReview) return 1;
		return new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime();
	});
}
