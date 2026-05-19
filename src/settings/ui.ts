import {App, getAllTags, PluginSettingTab, Setting, TFolder} from 'obsidian';
import MemMasterPlugin from '../main';
import { PLUGIN_EVENTS } from '../core/events';

export default class MemMasterPluginSettingTab extends PluginSettingTab {
	plugin: MemMasterPlugin;

	constructor(app: App, plugin: MemMasterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private getTagOptions(): string[] {
		const tags = new Set<string>();
		const currentTag = this.normalizeTagName(this.plugin.settings.tagName);

		tags.add('flashcard');

		if (currentTag) {
			tags.add(currentTag);
		}

		this.app.vault.getMarkdownFiles().forEach((file) => {
			const cache = this.app.metadataCache.getFileCache(file);
			const cacheTags = cache ? getAllTags(cache) : null;

			cacheTags?.forEach((tag) => {
				const normalizedTag = this.normalizeTagName(tag);

				if (normalizedTag) {
					tags.add(normalizedTag);
				}
			});
		});

		return Array.from(tags).sort((a, b) => a.localeCompare(b));
	}

	private getFolderOptions(): string[] {
		const folders = new Set<string>();
		const currentFolder = this.normalizeFolderPath(this.plugin.settings.folderName);

		if (currentFolder) {
			folders.add(currentFolder);
		}

		this.app.vault.getAllLoadedFiles().forEach((file) => {
			if (file instanceof TFolder && !file.isRoot()) {
				folders.add(file.path);
			}
		});

		return Array.from(folders).sort((a, b) => a.localeCompare(b));
	}

	private normalizeTagName(tagName: string): string {
		return tagName.trim().replace(/^#+/, '');
	}

	private normalizeFolderPath(folderPath: string): string {
		return folderPath.trim().replace(/^\/+|\/+$/g, '');
	}

	display(): void {
		const { containerEl } = this;
		const { i18n } = this.plugin;

		containerEl.empty();

		// Add heading for flashcard source settings
		new Setting(containerEl)
			.setName(i18n.t('settings.flashcardSourceHeading'))
			.setHeading();

		// Dropdown for mode selection
		new Setting(containerEl)
			.setName(i18n.t('settings.cardSource.name'))
			.setDesc(i18n.t('settings.cardSource.desc'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('tag', i18n.t('settings.sourceMode.tag'))
					.addOption('folder', i18n.t('settings.sourceMode.folder'))
					.setValue(this.plugin.settings.sourceMode)
					.onChange(async (value: 'tag' | 'folder') => {
						this.plugin.settings.sourceMode = value;
						await this.plugin.saveSettings();
						this.display(); // Refresh the settings panel

						this.plugin.events.trigger(PLUGIN_EVENTS.SETTINGS_UPDATED);
					})
			);

		// Show tag field ONLY when tag mode is selected
		if (this.plugin.settings.sourceMode === 'tag') {
			const tagOptions = this.getTagOptions();

			new Setting(containerEl)
				.setName(i18n.t('settings.tagName.name'))
				.setDesc(i18n.t('settings.tagName.desc'))
				.addDropdown((dropdown) => {
					tagOptions.forEach((tagName) => {
						dropdown.addOption(tagName, `#${tagName}`);
					});

					return dropdown
						.setValue(this.normalizeTagName(this.plugin.settings.tagName))
						.onChange(async (value) => {
							this.plugin.settings.tagName = value;
							await this.plugin.saveSettings();

							this.plugin.events.trigger(PLUGIN_EVENTS.SETTINGS_UPDATED);
						});
				});
		}

		// Show folder field ONLY when folder mode is selected
		if (this.plugin.settings.sourceMode === 'folder') {
			const folderOptions = this.getFolderOptions();

			new Setting(containerEl)
				.setName(i18n.t('settings.folderName.name'))
				.setDesc(i18n.t('settings.folderName.desc'))
				.addDropdown((dropdown) => {
					folderOptions.forEach((folderPath) => {
						dropdown.addOption(folderPath, folderPath);
					});

					return dropdown
						.setValue(this.normalizeFolderPath(this.plugin.settings.folderName))
						.onChange(async (value) => {
							this.plugin.settings.folderName = value;
							await this.plugin.saveSettings();

							this.plugin.events.trigger(PLUGIN_EVENTS.SETTINGS_UPDATED);
						});
				});
		}

		// Add heading for review list settings
		new Setting(containerEl)
			.setName(i18n.t('settings.reviewListHeading'))
			.setHeading();

		// Add toggle for hidden flashcards
		new Setting(containerEl)
			.setName(i18n.t('settings.isBlurFlashcardText.name'))
			.setDesc(i18n.t('settings.isBlurFlashcardText.desc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.isBlurFlashcardText)
					.onChange(async (value) => {
						this.plugin.settings.isBlurFlashcardText = value;
						await this.plugin.saveSettings();

						this.plugin.events.trigger(PLUGIN_EVENTS.SETTINGS_UPDATED);
					})
			);

		// Add toggle for opening cards in preview mode
		new Setting(containerEl)
			.setName(i18n.t('settings.openInPreviewMode.name'))
			.setDesc(i18n.t('settings.openInPreviewMode.desc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.openInPreviewMode)
					.onChange(async (value) => {
						this.plugin.settings.openInPreviewMode = value;
						await this.plugin.saveSettings();

						this.plugin.events.trigger(PLUGIN_EVENTS.SETTINGS_UPDATED);
					})
			);

		// Add heading for hotkeys settings
		new Setting(containerEl)
			.setName(i18n.t('settings.hotkeysHeading'))
			.setDesc(i18n.t('settings.hotkeysDesc'))
			.setHeading();
	}
}
