import { Events, MarkdownView, Plugin, TFile, Notice } from 'obsidian';
import { MemMasterPluginSettings } from './settings/storage';
import { loadSettings, saveSettings } from './settings/storage';
import MemMasterPluginSettingTab from './settings/ui';
import ReviewListView from './review-list/ui';
import { syncFlashcardButtons } from './review-flashcard/ui';
import { I18n } from './i18n/i18n';
import { updateCardMetadata, makeFlashcard } from './core/scheduler';
import { isFileFlashcard } from './core/finder';
import { sleep } from './core/utils';

export default class MemMasterPlugin extends Plugin {
	settings: MemMasterPluginSettings;
	private observer: MutationObserver;
	public events: Events;
	public i18n: I18n;

	async onload() {
		// Initialize i18n
		this.i18n = new I18n();

		// Create events manager
		this.events = new Events();

		// Load settings
		this.settings = await loadSettings(this);

		// Create MutationObserver
		this.observer = new MutationObserver((_mutations) => {
			const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeLeaf) {
				// Full sync with cleanup
				void syncFlashcardButtons(activeLeaf, this, {
					cleanupMisplaced: true,
					removeIfNoTag: true
				});
			}
		});

		// Handler for active leaf change
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", async (leaf) => {
				if (leaf && leaf.view instanceof MarkdownView) {
					this.observer.disconnect();
					await sleep(100);

					// Full sync with cleanup
					await syncFlashcardButtons(leaf.view, this, {
						cleanupMisplaced: true,
						removeIfNoTag: true
					});

					const previewEl = leaf.view.previewMode?.containerEl;
					if (previewEl) {
						this.observer.observe(previewEl, {
							childList: true,
							subtree: true
						});
					}
				}
			})
		);

		// Add resize handler
		this.registerEvent(
			this.app.workspace.on("resize", async () => {
				const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeLeaf) {
					// Gentle sync - only add missing buttons
					await syncFlashcardButtons(activeLeaf, this, {
						delay: 100,
						cleanupMisplaced: false,
						removeIfNoTag: false
					});
				}
			})
		);

		// Handler for layout changes
		this.registerEvent(
			this.app.workspace.on("layout-change", async () => {
				const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeLeaf) {
					// Gentle sync - only add missing buttons
					await syncFlashcardButtons(activeLeaf, this, {
						delay: 100,
						cleanupMisplaced: false,
						removeIfNoTag: false
					});
				}
			})
		);

		// Rest of the code...
		this.addRibbonIcon('square-library', this.i18n.t('ribbonIcon.openReviewFlashcards'), () => {
			void this.activateView();
		});

		this.registerView(
			ReviewListView.VIEW_TYPE,
			(leaf) => new ReviewListView(leaf, this)
		);

		this.addCommand({
			id: 'open-review-list-view',
			name: this.i18n.t('commands.openReviewListView'),
			callback: () => {
				void this.activateView();
			},
		});

		// Add hotkey commands for marking cards
		this.addCommand({
			id: 'mark-card-easy',
			name: this.i18n.t('commands.markAsEasy'),
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					if (!checking) {
						void this.markCardWithDifficulty(activeFile, 'easy');
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'mark-card-medium',
			name: this.i18n.t('commands.markAsMedium'),
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					if (!checking) {
						void this.markCardWithDifficulty(activeFile, 'medium');
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'mark-card-hard',
			name: this.i18n.t('commands.markAsHard'),
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					if (!checking) {
						void this.markCardWithDifficulty(activeFile, 'hard');
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'make-flashcard',
			name: this.i18n.t('commands.makeFlashcard'),
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					if (!checking) {
						void this.makeDocumentFlashcard(activeFile);
					}
					return true;
				}
				return false;
			},
		});

		this.addSettingTab(new MemMasterPluginSettingTab(this.app, this));
	}

	onunload() {
		// Disable observer
		this.observer.disconnect();
	}


	private async activateView(): Promise<void> {
		const leaf = this.app.workspace.getLeaf(true);

		await leaf.setViewState({
			type: ReviewListView.VIEW_TYPE,
			active: true,
		});

		await this.app.workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		this.settings = await loadSettings(this);
	}

	async saveSettings() {
		await saveSettings(this, this.settings);
	}

	private async markCardWithDifficulty(file: TFile, difficulty: 'easy' | 'medium' | 'hard') {
		// Check if the file is a flashcard
		const isFlashcard = await isFileFlashcard(this, file);
		
		if (!isFlashcard) {
			new Notice(this.i18n.t('notices.notAFlashcard'));
			return;
		}

		// Update card metadata
		await updateCardMetadata(this, file, difficulty);
	}

	private async makeDocumentFlashcard(file: TFile) {
		// Try to make the document a flashcard
		await makeFlashcard(this, file);
	}
}