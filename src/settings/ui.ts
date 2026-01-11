import {App, PluginSettingTab, Setting} from 'obsidian';
import MemMasterPlugin from '../main';
import { PLUGIN_EVENTS } from '../core/events';

export default class MemMasterPluginSettingTab extends PluginSettingTab {
	plugin: MemMasterPlugin;

	constructor(app: App, plugin: MemMasterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
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
			new Setting(containerEl)
				.setName(i18n.t('settings.tagName.name'))
				.setDesc(i18n.t('settings.tagName.desc'))
				.addText((text) =>
					text
						.setPlaceholder(i18n.t('settings.tagName.placeholder'))
						.setValue(this.plugin.settings.tagName)
						.onChange(async (value) => {
							this.plugin.settings.tagName = value;
							await this.plugin.saveSettings();

							this.plugin.events.trigger(PLUGIN_EVENTS.SETTINGS_UPDATED);
						})
				);
		}

		// Show folder field ONLY when folder mode is selected
		if (this.plugin.settings.sourceMode === 'folder') {
			new Setting(containerEl)
				.setName(i18n.t('settings.folderName.name'))
				.setDesc(i18n.t('settings.folderName.desc'))
				.addText((text) =>
					text
						.setPlaceholder(i18n.t('settings.folderName.placeholder'))
						.setValue(this.plugin.settings.folderName)
						.onChange(async (value) => {
							this.plugin.settings.folderName = value;
							await this.plugin.saveSettings();

							this.plugin.events.trigger(PLUGIN_EVENTS.SETTINGS_UPDATED);
						})
				);
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