import { TFile, MarkdownView, setIcon } from 'obsidian';
import MemMasterPlugin from '../main';
import { resetCardReview, updateCardMetadata } from '../core/scheduler';
import { extractMetadata, isCardCompleted, isCardDueForReview, isFileFlashcard } from '../core/finder';
import { sleep } from '../core/utils';
import { generateTestsFromCard } from '../core/test-generator';
import { countTestsForSourceCard } from '../core/tests';

const MAX_REVIEW_NOTE_LENGTH = 4096;

function getReviewNoteLength(content: string): number {
	// Frontmatter contains MemMaster metadata, so it should not count as card content.
	return content.replace(/^---\n[\s\S]*?\n---/, '').trim().length;
}

function updateNoteLengthWarning(container: HTMLElement, contentLength: number, plugin: MemMasterPlugin): void {
	const shouldShowWarning = contentLength > MAX_REVIEW_NOTE_LENGTH;
	const existingWarning = container.querySelector('.mm-card-length-warning');

	// Avoid touching the DOM when nothing changed; MutationObserver would otherwise sync again.
	if (
		container.dataset.mmReviewNoteLength === contentLength.toString()
		&& shouldShowWarning === Boolean(existingWarning)
	) {
		return;
	}

	container.dataset.mmReviewNoteLength = contentLength.toString();
	existingWarning?.remove();

	if (shouldShowWarning) {
		const warning = createDiv({
			cls: 'mm-card-length-warning',
		});
		const warningIcon = warning.createSpan({
			cls: 'mm-card-length-warning-icon',
		});
		setIcon(warningIcon, 'alert-triangle');
		warning.createSpan({
			cls: 'mm-card-length-warning-text',
			text: plugin.i18n.t('reviewFlashcard.lengthWarning', {
				count: contentLength,
				limit: MAX_REVIEW_NOTE_LENGTH,
			}),
		});
		container.prepend(warning);
	}
}

function addInteractiveBorderEffect(container: HTMLElement): void {
	container.addEventListener('mousemove', (e) => {
		const rect = container.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * 100;
		const y = ((e.clientY - rect.top) / rect.height) * 100;
		container.style.setProperty('--mouse-x', `${x}%`);
		container.style.setProperty('--mouse-y', `${y}%`);
	});
}

function getGenerateTestLinkText(plugin: MemMasterPlugin, existingTestCount: number): string {
	const status = existingTestCount === 0
		? plugin.i18n.t('reviewFlashcard.generateTestNoTestsStatus')
		: plugin.i18n.t('reviewFlashcard.generateTestExistingStatus', { count: existingTestCount });

	return `${plugin.i18n.t('reviewFlashcard.generateTest')} (${status})`;
}

export function createButtonContainer(file: TFile, plugin: MemMasterPlugin, contentLength: number): HTMLElement {
	const buttonContainer = createDiv({
		cls: 'mm-estimation-card-buttons-container',
	});

	const textButtonContainer = createEl('p', {
		cls: 'mm-estimation-card-text',
		text: plugin.i18n.t('reviewFlashcard.difficultyQuestion'),
	});

	const buttonGroup = createDiv({
		cls: 'mm-estimation-card-buttons-block',
	});

	const easyButton = createEl('button', {
		cls: 'mm-estimation-card-button mm-easy-button',
		text: plugin.i18n.t('reviewFlashcard.easy'),
	});
	easyButton.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation(); // Prevent event bubbling
		void updateCardMetadata(plugin, file, 'easy');
	});

	const mediumButton = createEl('button', {
		cls: 'mm-estimation-card-button mm-medium-button',
		text: plugin.i18n.t('reviewFlashcard.medium'),
	});
	mediumButton.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();
		void updateCardMetadata(plugin, file, 'medium');
	});

	const hardButton = createEl('button', {
		cls: 'mm-estimation-card-button mm-hard-button',
		text: plugin.i18n.t('reviewFlashcard.hard'),
	});
	hardButton.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();
		void updateCardMetadata(plugin, file, 'hard');
	});

	buttonGroup.appendChild(easyButton);
	buttonGroup.appendChild(mediumButton);
	buttonGroup.appendChild(hardButton);

	buttonContainer.appendChild(textButtonContainer);
	buttonContainer.appendChild(buttonGroup);

	if (plugin.settings.testsEnabled) {
		const testActionRow = createDiv({
			cls: 'mm-generate-test-row',
		});
		const generateTestLink = createEl('a', {
			cls: 'mm-generate-test-button',
			attr: {
				href: '#',
			},
		});
		const generateTestIcon = generateTestLink.createSpan({
			cls: 'mm-generate-test-icon',
		});
		setIcon(generateTestIcon, 'sparkles');
		const generateTestText = generateTestLink.createSpan({
			text: plugin.i18n.t('reviewFlashcard.generateTest'),
		});
		let isGenerating = false;

		const updateGenerateTestText = async () => {
			const existingTestCount = await countTestsForSourceCard(plugin, file);
			if (!isGenerating) {
				generateTestText.setText(getGenerateTestLinkText(plugin, existingTestCount));
			}
		};

		void updateGenerateTestText();

		generateTestLink.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();

			if (isGenerating) {
				return;
			}

			isGenerating = true;
			generateTestLink.addClass('is-disabled');
			generateTestLink.setAttribute('aria-disabled', 'true');
			generateTestText.setText(plugin.i18n.t('reviewFlashcard.generatingTest'));

			void (async () => {
				try {
					await generateTestsFromCard(plugin, file);
				} finally {
					isGenerating = false;
					generateTestLink.removeClass('is-disabled');
					generateTestLink.removeAttribute('aria-disabled');
					await updateGenerateTestText();
				}
			})();
		});

		testActionRow.appendChild(generateTestLink);
		buttonContainer.appendChild(testActionRow);
	}

	updateNoteLengthWarning(buttonContainer, contentLength, plugin);

	addInteractiveBorderEffect(buttonContainer);

	return buttonContainer;
}

export function createCompletedCardActionsContainer(file: TFile, plugin: MemMasterPlugin, contentLength: number): HTMLElement {
	const buttonContainer = createDiv({
		cls: 'mm-estimation-card-buttons-container mm-completed-card-actions-container',
	});

	const textButtonContainer = createEl('p', {
		cls: 'mm-estimation-card-text',
		text: plugin.i18n.t('reviewFlashcard.completedReviewAction'),
	});

	const buttonGroup = createDiv({
		cls: 'mm-estimation-card-buttons-block',
	});

	const resetButton = createEl('button', {
		cls: 'mm-estimation-card-button mm-reset-card-button',
		text: plugin.i18n.t('reviewFlashcard.reviewAgain'),
	});

	resetButton.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();

		resetButton.disabled = true;
		void (async () => {
			const wasReset = await resetCardReview(plugin, file);
			if (wasReset) {
				buttonContainer.replaceWith(createButtonContainer(file, plugin, contentLength));
			} else {
				resetButton.disabled = false;
			}
		})();
	});

	buttonGroup.appendChild(resetButton);
	buttonContainer.appendChild(textButtonContainer);
	buttonContainer.appendChild(buttonGroup);
	addInteractiveBorderEffect(buttonContainer);

	return buttonContainer;
}

export async function syncFlashcardButtons(
	view: MarkdownView, 
	plugin: MemMasterPlugin,
	options: { 
		delay?: number;
		cleanupMisplaced?: boolean;
		removeIfNoTag?: boolean;
	} = {}
) {
	const { 
		delay = 0, 
		cleanupMisplaced = true, 
		removeIfNoTag = true 
	} = options;

	// Delay if specified
	if (delay > 0) {
		await sleep(delay);
	}

	if (!view.file) return;

	// Check if current file should display flashcard controls
	const hasCardTag = await isFileFlashcard(plugin, view.file);

	// If file is not a flashcard, optionally clean up and exit
	if (!hasCardTag) {
		if (removeIfNoTag) {
			const existingContainers = view.containerEl.querySelectorAll('.mm-estimation-card-buttons-container');
			existingContainers.forEach(container => container.remove());
		}
		return;
	}

	// Process all preview sections
	const containerEl = view.previewMode?.containerEl ?? view.containerEl;
	const previewSections = containerEl.querySelectorAll('.markdown-preview-section');
	const file = view.file;
	// Read once per sync and reuse for all preview sections in the same note.
	const content = await plugin.app.vault.cachedRead(file);
	const metadata = extractMetadata(content, file);
	const isCompleted = metadata ? isCardCompleted(metadata) : false;
	const isDueForReview = !metadata || isCardDueForReview(metadata);
	const contentLength = getReviewNoteLength(content);

	previewSections.forEach(section => {
		let container = section.querySelector<HTMLElement>('.mm-estimation-card-buttons-container');

		// Clean up misplaced containers if option is enabled
		if (cleanupMisplaced && container && container.parentElement !== section) {
			container.remove();
			container = null;
		}

		if (!isCompleted && !isDueForReview) {
			container?.remove();
			return;
		}

		const hasCompletedActions = Boolean(container?.hasClass('mm-completed-card-actions-container'));

		if (container && hasCompletedActions !== isCompleted) {
			container.remove();
			container = null;
		}

		if (!container) {
			const buttonContainer = isCompleted
				? createCompletedCardActionsContainer(file, plugin, contentLength)
				: createButtonContainer(file, plugin, contentLength);
			section.appendChild(buttonContainer);
		} else {
			if (!isCompleted) {
				updateNoteLengthWarning(container, contentLength, plugin);
			}
		}
	});
}
