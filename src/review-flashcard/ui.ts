import { TFile, MarkdownView } from 'obsidian';
import MemMasterPlugin from '../main';
import { updateCardMetadata } from '../core/scheduler';
import { isFileFlashcard } from '../core/finder';
import { sleep } from '../core/utils';

export function createButtonContainer(file: TFile, plugin: MemMasterPlugin): HTMLElement {
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

	// Add mouse move handler for interactive border effect
	buttonContainer.addEventListener('mousemove', (e) => {
		const rect = buttonContainer.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * 100;
		const y = ((e.clientY - rect.top) / rect.height) * 100;
		buttonContainer.style.setProperty('--mouse-x', `${x}%`);
		buttonContainer.style.setProperty('--mouse-y', `${y}%`);
	});

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

	previewSections.forEach(section => {
		let container = section.querySelector('.mm-estimation-card-buttons-container');

		// Clean up misplaced containers if option is enabled
		if (cleanupMisplaced && container && container.parentElement !== section) {
			container.remove();
			container = null;
		}

		// Create container if it doesn't exist
		if (!container) {
			const buttonContainer = createButtonContainer(file, plugin);
			section.appendChild(buttonContainer);
		}
	});
}
