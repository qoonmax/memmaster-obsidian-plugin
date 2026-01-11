import {ItemView, WorkspaceLeaf, MarkdownView, setIcon} from 'obsidian';
import MemMasterPlugin from '../main';
import { getFlashcardsForReview } from '../core/finder';
import { PLUGIN_EVENTS } from '../core/events';

export default class ReviewListView extends ItemView {
	static VIEW_TYPE = 'review-list-view';
	private plugin: MemMasterPlugin;
	private searchQuery = ''; // Add search state
	private sortOrder: 'oldest-first' | 'newest-first' = 'oldest-first'; // Add sort order state
	private documentClickHandler: (() => void) | null = null; // Handler reference for cleanup

	constructor(leaf: WorkspaceLeaf, plugin: MemMasterPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return ReviewListView.VIEW_TYPE;
	}

	getDisplayText() {
		return this.plugin.i18n.t('reviewList.viewTitle');
	}

	// New method to render content
	async renderContent(): Promise<void> {
		const container = this.contentEl;
		container.empty();

		// Add search box container
		const searchContainer = container.createDiv({
			cls: 'mm-search-container',
		});

		const searchWrapper = searchContainer.createDiv({
			cls: 'mm-search-wrapper',
		});

		// Add search icon
		const searchIcon = searchWrapper.createEl('span', {
			cls: 'mm-search-icon',
		});
		setIcon(searchIcon, 'search');

		const searchInput = searchWrapper.createEl('input', {
			type: 'text',
			cls: 'mm-search-input',
			placeholder: this.plugin.i18n.t('reviewList.searchPlaceholder'),
			value: this.searchQuery,
		});

		// Handle search input
		searchInput.addEventListener('input', (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
			this.filterCards();
		});

		// Add custom sort dropdown
		const sortWrapper = searchContainer.createDiv({
			cls: 'mm-sort-wrapper',
		});

		sortWrapper.createEl('label', {
			cls: 'mm-sort-label',
			text: this.plugin.i18n.t('reviewList.sortLabel'),
		});

		const customDropdown = sortWrapper.createDiv({
			cls: 'mm-custom-dropdown',
		});

		// Current selected option display
		const selectedDisplay = customDropdown.createDiv({
			cls: 'mm-dropdown-selected',
		});

		const selectedText = selectedDisplay.createEl('span', {
			cls: 'mm-dropdown-selected-text',
			text: this.sortOrder === 'oldest-first' 
				? this.plugin.i18n.t('reviewList.sortOldestFirst')
				: this.plugin.i18n.t('reviewList.sortNewestFirst'),
		});

		const dropdownArrow = selectedDisplay.createEl('span', {
			cls: 'mm-dropdown-arrow',
		});
		setIcon(dropdownArrow, 'chevron-down');

		// Dropdown options container
		const optionsContainer = customDropdown.createDiv({
			cls: 'mm-dropdown-options',
		});

		// Dynamic border element for open state
		const dropdownBorder = customDropdown.createDiv({
			cls: 'mm-dropdown-border',
		});

		// Sort options data
		const sortOptions = [
			{ value: 'oldest-first', text: this.plugin.i18n.t('reviewList.sortOldestFirst') },
			{ value: 'newest-first', text: this.plugin.i18n.t('reviewList.sortNewestFirst') },
		];

		// Create option elements
		sortOptions.forEach(option => {
			const optionEl = optionsContainer.createDiv({
				cls: `mm-dropdown-option ${this.sortOrder === option.value ? 'mm-dropdown-option-selected' : ''}`,
				attr: { 'data-value': option.value },
			});
			optionEl.setText(option.text);

			optionEl.addEventListener('click', (e) => {
				e.stopPropagation();
				this.sortOrder = option.value as 'oldest-first' | 'newest-first';
				selectedText.setText(option.text);
				
				// Update selected state
				optionsContainer.querySelectorAll('.mm-dropdown-option').forEach(opt => {
					opt.removeClass('mm-dropdown-option-selected');
				});
				optionEl.addClass('mm-dropdown-option-selected');
				
				// Close dropdown
				customDropdown.removeClass('mm-dropdown-open');
				
				this.sortCards();
			});
		});

		// Toggle dropdown on click
		selectedDisplay.addEventListener('click', (e) => {
			e.stopPropagation();
			const isOpening = !customDropdown.hasClass('mm-dropdown-open');
			customDropdown.toggleClass('mm-dropdown-open', isOpening);
			
			if (isOpening) {
				// Set options height for border calculation
				requestAnimationFrame(() => {
					const optionsHeight = optionsContainer.offsetHeight;
					dropdownBorder.style.setProperty('--dropdown-options-height', `${optionsHeight}px`);
				});
			}
		});

		// Close dropdown when clicking outside
		// Remove previous handler if exists to prevent memory leak
		if (this.documentClickHandler) {
			document.removeEventListener('click', this.documentClickHandler);
		}
		this.documentClickHandler = () => {
			customDropdown.removeClass('mm-dropdown-open');
		};
		document.addEventListener('click', this.documentClickHandler);

		// Add mouse move handler for interactive border effect on selected (closed state)
		selectedDisplay.addEventListener('mousemove', (e) => {
			if (!customDropdown.hasClass('mm-dropdown-open')) {
				const rect = selectedDisplay.getBoundingClientRect();
				const x = ((e.clientX - rect.left) / rect.width) * 100;
				const y = ((e.clientY - rect.top) / rect.height) * 100;
				selectedDisplay.style.setProperty('--mouse-x', `${x}%`);
				selectedDisplay.style.setProperty('--mouse-y', `${y}%`);
			}
		});

		// Add mouse move handler for entire dropdown (open state)
		customDropdown.addEventListener('mousemove', (e) => {
			if (customDropdown.hasClass('mm-dropdown-open')) {
				const selectedRect = selectedDisplay.getBoundingClientRect();
				const optionsRect = optionsContainer.getBoundingClientRect();
				
				// Calculate combined bounding box
				const top = selectedRect.top;
				const left = selectedRect.left;
				const right = selectedRect.right;
				const bottom = optionsRect.bottom;
				const width = right - left;
				const height = bottom - top;
				
				const x = ((e.clientX - left) / width) * 100;
				const y = ((e.clientY - top) / height) * 100;
				dropdownBorder.style.setProperty('--mouse-x', `${x}%`);
				dropdownBorder.style.setProperty('--mouse-y', `${y}%`);
			}
		});

		const grid = container.createDiv({
			cls: 'mm-card-grid',
		});

		// Use the new core function to get flashcards
		const sortedFlashcards = await getFlashcardsForReview(this.plugin);

		// If there are no cards for review, show a message
		if (sortedFlashcards.length === 0) {
			const noFlashcardsMessage = container.createDiv({ cls: 'mm-no-flashcards' });
			noFlashcardsMessage.setText(this.plugin.i18n.t('reviewList.noFlashcards'));
			return;
		}

		// Add "no results" message (initially hidden)
		const noResultsMessage = container.createDiv({ 
			cls: 'mm-no-search-results mm-hidden'
		});
		noResultsMessage.setText(this.plugin.i18n.t('reviewList.noSearchResults'));

		// Create cards
		for (const metadata of sortedFlashcards) {
			const card = grid.createDiv({ cls: 'mm-card' });
			
			const blurClass = this.plugin.settings.isBlurFlashcardText ? 'mm-blur-enabled' : 'mm-blur-disabled';
			card.classList.add(blurClass);

			card.setAttribute('data-filename', metadata.file.basename.toLowerCase());
			card.setAttribute('data-content', metadata.content.toLowerCase());
			
			// Calculate and store days overdue for sorting
			let daysOverdue = 0;
			if (metadata.nextReview) {
				const reviewDate = new Date(metadata.nextReview);
				daysOverdue = Math.floor((new Date().getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));
			}
			card.setAttribute('data-overdue-days', daysOverdue.toString());

			// Add header - file name
			const headerContainer = card.createDiv({ cls: 'mm-card-header' });
			headerContainer.createEl('h4', { text: metadata.file.basename });

			// Add date of next review
			if (metadata.nextReview) {
				headerContainer.createEl('span', {
					cls: 'mm-review-info',
					text: daysOverdue > 0 
						? this.plugin.i18n.t('reviewList.overdueByDays', { days: daysOverdue.toString() })
						: this.plugin.i18n.t('reviewList.dueToday')
				});
			}

			// Extract lines for tags and content
			const lines = metadata.content.split('\n');
			// Filter only lines with tags, excluding markdown headers
			const tagLines = lines.filter((line) => {
				const trimmedLine = line.trim();
				// Exclude lines that start with markdown headers (# , ## , ### etc.)
				if (/^#+\s/.test(trimmedLine)) {
					return false;
				}
				return line.includes('#');
			});

			// Extract individual tags as array
			const extractedTagsList = tagLines
				.flatMap((line) => {
					return line.split(/\s+/)
						.filter(word => word.startsWith('#') && word.length > 1 && word[1] !== '#');
				});
			
			// Store tags as data attribute for search
			card.setAttribute('data-tags', extractedTagsList.join(' ').toLowerCase());

			// Remove tags and YAML from content
			const contentWithoutTags = metadata.content
				.replace(/^---[\s\S]*?---/, '') // Remove YAML frontmatter
				.replace(/#[^\s#]+/g, '') // Remove all tags (# followed by non-whitespace, non-# characters)
				.replace(/\n+/g, ' ') // Replace multiple newlines with space
				.trim();

			const truncatedContent = contentWithoutTags.slice(0, 128);

			const contentEl = card.createDiv({ cls: 'mm-card-content' });
			
			// Create tags container
			const tagsContainer = contentEl.createDiv({ cls: 'mm-card-tags' });
			extractedTagsList.forEach(tag => {
				tagsContainer.createEl('p', { text: tag });
			});
			
			// Create text content
			contentEl.createEl('p', { cls: 'mm-card-text', text: truncatedContent });

			const button = card.createEl('span', {
				cls: 'mm-open-card-button',
			});
			setIcon(button, 'eye');

			card.addEventListener('click', () => {
				void this.openCardFile(metadata.file.path);
			});

			// Add mouse move handler for interactive border effect
			card.addEventListener('mousemove', (e) => {
				const rect = card.getBoundingClientRect();
				const x = ((e.clientX - rect.left) / rect.width) * 100;
				const y = ((e.clientY - rect.top) / rect.height) * 100;
				card.style.setProperty('--mouse-x', `${x}%`);
				card.style.setProperty('--mouse-y', `${y}%`);
			});
		}

		// Apply initial filter if there's a search query
		if (this.searchQuery) {
			this.filterCards();
		}

		// Apply initial sort based on current sort order
		this.sortCards();
	}

	// New method to filter cards based on search query
	private filterCards(): void {
		const cards = this.contentEl.querySelectorAll('.mm-card');
		const noResultsMessage = this.contentEl.querySelector('.mm-no-search-results');
		const query = this.searchQuery;
		let hasVisibleCards = false;

		cards.forEach((card) => {
			const filename = card.getAttribute('data-filename') || '';
			const content = card.getAttribute('data-content') || '';
			const tags = card.getAttribute('data-tags') || '';

			const matches = filename.includes(query) ||
				content.includes(query) ||
				tags.includes(query);

			if (matches) {
				card.removeClass('mm-hidden');
				hasVisibleCards = true;
			} else {
				card.addClass('mm-hidden');
			}
		});

		// Show/hide "no results" message
		if (noResultsMessage) {
			if (!hasVisibleCards && query.length > 0) {
				noResultsMessage.removeClass('mm-hidden');
			} else {
				noResultsMessage.addClass('mm-hidden');
			}
		}
	}

	// Method to sort cards based on sort order
	private sortCards() {
		const grid = this.contentEl.querySelector('.mm-card-grid');
		if (!grid) return;

		const cards = Array.from(grid.querySelectorAll('.mm-card'));
		
		cards.sort((a, b) => {
			const daysA = parseInt(a.getAttribute('data-overdue-days') || '0');
			const daysB = parseInt(b.getAttribute('data-overdue-days') || '0');

			if (this.sortOrder === 'oldest-first') {
				// Most overdue first (higher days = earlier)
				return daysB - daysA;
			} else {
				// Least overdue first (lower days = earlier)
				return daysA - daysB;
			}
		});

			// Re-append cards in sorted order
		cards.forEach(card => grid.appendChild(card));
	}

	private async openCardFile(filePath: string): Promise<void> {
		await this.app.workspace.openLinkText(filePath, '/', false);
		// Wait for file to open and switch to preview mode if setting is enabled
		if (this.plugin.settings.openInPreviewMode) {
			setTimeout(() => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view && view.file?.path === filePath) {
					// Find the leaf containing this view
					const leaves = this.app.workspace.getLeavesOfType('markdown');
					const leaf = leaves.find(l => l.view === view);
					if (leaf) {
						const currentState = leaf.getViewState();
						void leaf.setViewState({
							type: 'markdown',
							state: { ...currentState.state, mode: 'preview' }
						});
					}
				}
			}, 100);
		}
	}

	async onOpen(): Promise<void> {
		this.containerEl.addClass('mm-view');
		await this.renderContent();

		// Wrap in arrow function to preserve proper typing
		const refreshContent = (): void => {
			void this.renderContent();
		};

		// Add event handler for activation of the tab
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				if (leaf?.view instanceof ReviewListView && leaf.view === this) {
					refreshContent();
				}
			})
		);

		this.registerEvent(
			this.plugin.events.on(PLUGIN_EVENTS.CARD_UPDATED, refreshContent)
		);

		this.registerEvent(
			this.plugin.events.on(PLUGIN_EVENTS.SETTINGS_UPDATED, refreshContent)
		);
	}

	async onClose(): Promise<void> {
		// Remove document click handler to prevent memory leak
		if (this.documentClickHandler) {
			document.removeEventListener('click', this.documentClickHandler);
			this.documentClickHandler = null;
		}
		this.containerEl.empty();
		await Promise.resolve();
	}
}