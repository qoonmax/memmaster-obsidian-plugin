import { TFile, MarkdownView } from 'obsidian';
import MemMasterPlugin from '../main';
import { updateCardMetadata } from '../core/scheduler';
import { isFileFlashcard } from '../core/finder';
import { sleep } from '../core/utils';

export function createButtonContainer(file: TFile, plugin: MemMasterPlugin): HTMLElement {
	const buttonContainer = document.createElement('div');
	buttonContainer.className = 'mm-estimation-card-buttons-container';

	const textButtonContainer = document.createElement('p');
	textButtonContainer.className = 'mm-estimation-card-text';
	textButtonContainer.textContent = plugin.i18n.t('reviewFlashcard.difficultyQuestion');

	const buttonGroup = document.createElement('div');
	buttonGroup.className = 'mm-estimation-card-buttons-block';

	const easyButton = document.createElement('button');
	easyButton.className = 'mm-estimation-card-button mm-easy-button';
	easyButton.textContent = plugin.i18n.t('reviewFlashcard.easy');
	easyButton.addEventListener('click', async (e) => {
		e.preventDefault();
		e.stopPropagation(); // Prevent event bubbling
		await updateCardMetadata(plugin, file, 'easy');
	});

	const mediumButton = document.createElement('button');
	mediumButton.className = 'mm-estimation-card-button mm-medium-button';
	mediumButton.textContent = plugin.i18n.t('reviewFlashcard.medium');
	mediumButton.addEventListener('click', async (e) => {
		e.preventDefault();
		e.stopPropagation();
		await updateCardMetadata(plugin, file, 'medium');
	});

	const hardButton = document.createElement('button');
	hardButton.className = 'mm-estimation-card-button mm-hard-button';
	hardButton.textContent = plugin.i18n.t('reviewFlashcard.hard');
	hardButton.addEventListener('click', async (e) => {
		e.preventDefault();
		e.stopPropagation();
		await updateCardMetadata(plugin, file, 'hard');
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
			const existingContainers = document.querySelectorAll('.mm-estimation-card-buttons-container');
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