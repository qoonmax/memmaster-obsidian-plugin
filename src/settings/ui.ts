import {App, getAllTags, PluginSettingTab, Setting, setIcon, TFolder} from 'obsidian';
import MemMasterPlugin from '../main';
import { PLUGIN_EVENTS } from '../core/events';
import { DEEPSEEK_MODEL_OPTIONS, DEFAULT_SETTINGS, OPENAI_MODEL_OPTIONS } from './storage';

const GITHUB_ISSUES_URL = 'https://github.com/qoonmax/memmaster-obsidian-plugin/issues';

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

	private getFolderOptions(currentFolderName = this.plugin.settings.folderName): string[] {
		const folders = new Set<string>();
		const currentFolder = this.normalizeFolderPath(currentFolderName);

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

	private displaySupportFooter(containerEl: HTMLElement): void {
		const { i18n } = this.plugin;
		const footerEl = containerEl.createDiv({ cls: 'mm-settings-support-footer' });
		const iconEl = footerEl.createSpan({ cls: 'mm-settings-support-footer-icon' });
		setIcon(iconEl, 'github');

		const textEl = footerEl.createDiv({ cls: 'mm-settings-support-footer-text' });
		textEl.createEl('strong', { text: i18n.t('settings.support.title') });
		textEl.createEl('span', { text: i18n.t('settings.support.desc') });
		textEl.createEl('a', {
			text: i18n.t('settings.support.linkLabel'),
			attr: {
				href: GITHUB_ISSUES_URL,
				target: '_blank',
				rel: 'noopener noreferrer',
			},
		});
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

		new Setting(containerEl)
			.setName(i18n.t('settings.testsHeading'))
			.setHeading();

		new Setting(containerEl)
			.setName(i18n.t('settings.testsEnabled.name'))
			.setDesc(i18n.t('settings.testsEnabled.desc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.testsEnabled)
					.onChange(async (value) => {
						this.plugin.settings.testsEnabled = value;
						await this.plugin.saveSettings();
						this.display();

						this.plugin.events.trigger(PLUGIN_EVENTS.SETTINGS_UPDATED);
					})
			);

		if (this.plugin.settings.testsEnabled) {
			const currentTestsFolder = this.normalizeFolderPath(this.plugin.settings.testsFolderName)
				|| DEFAULT_SETTINGS.testsFolderName;
			const testsFolderOptions = this.getFolderOptions(currentTestsFolder);

			new Setting(containerEl)
				.setName(i18n.t('settings.testsFolderName.name'))
				.setDesc(i18n.t('settings.testsFolderName.desc'))
				.addDropdown((dropdown) => {
					testsFolderOptions.forEach((folderPath) => {
						dropdown.addOption(folderPath, folderPath);
					});

					return dropdown
						.setValue(currentTestsFolder)
						.onChange(async (value) => {
							this.plugin.settings.testsFolderName = value;
							await this.plugin.saveSettings();

							this.plugin.events.trigger(PLUGIN_EVENTS.SETTINGS_UPDATED);
						});
				});

			new Setting(containerEl)
				.setName(i18n.t('settings.aiProvider.name'))
				.setDesc(i18n.t('settings.aiProvider.desc'))
				.addDropdown((dropdown) =>
					dropdown
						.addOption('openai', i18n.t('settings.aiProvider.openai'))
						.addOption('deepseek', i18n.t('settings.aiProvider.deepseek'))
						.setValue(this.plugin.settings.aiProvider)
						.onChange(async (value: 'openai' | 'deepseek') => {
							this.plugin.settings.aiProvider = value;
							await this.plugin.saveSettings();

							this.plugin.events.trigger(PLUGIN_EVENTS.SETTINGS_UPDATED);
						})
				);

			new Setting(containerEl)
				.setName(i18n.t('settings.openaiApiKey.name'))
				.setDesc(i18n.t('settings.openaiApiKey.desc'))
				.addText((text) =>
					text
						.setPlaceholder(i18n.t('settings.openaiApiKey.placeholder'))
						.setValue(this.plugin.settings.openaiApiKey)
						.onChange(async (value) => {
							this.plugin.settings.openaiApiKey = value.trim();
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName(i18n.t('settings.openaiModel.name'))
				.setDesc(i18n.t('settings.openaiModel.desc'))
				.addDropdown((dropdown) => {
					const options = new Set([this.plugin.settings.openaiModel, ...OPENAI_MODEL_OPTIONS]);
					options.forEach((model) => {
						dropdown.addOption(model, model);
					});

					return dropdown
						.setValue(this.plugin.settings.openaiModel)
						.onChange(async (value) => {
							this.plugin.settings.openaiModel = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName(i18n.t('settings.deepseekApiKey.name'))
				.setDesc(i18n.t('settings.deepseekApiKey.desc'))
				.addText((text) =>
					text
						.setPlaceholder(i18n.t('settings.deepseekApiKey.placeholder'))
						.setValue(this.plugin.settings.deepseekApiKey)
						.onChange(async (value) => {
							this.plugin.settings.deepseekApiKey = value.trim();
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName(i18n.t('settings.deepseekModel.name'))
				.setDesc(i18n.t('settings.deepseekModel.desc'))
				.addDropdown((dropdown) => {
					const options = new Set([this.plugin.settings.deepseekModel, ...DEEPSEEK_MODEL_OPTIONS]);
					options.forEach((model) => {
						dropdown.addOption(model, model);
					});

					return dropdown
						.setValue(this.plugin.settings.deepseekModel)
						.onChange(async (value) => {
							this.plugin.settings.deepseekModel = value;
							await this.plugin.saveSettings();
						});
				});

			const clientPromptSetting = new Setting(containerEl)
				.setName(i18n.t('settings.testClientPrompt.name'))
				.setDesc(i18n.t('settings.testClientPrompt.desc'));

			clientPromptSetting.settingEl.addClass('mm-test-client-prompt-setting');

			clientPromptSetting
				.addTextArea((text) => {
					text.inputEl.rows = 5;
					text.inputEl.addClass('mm-test-client-prompt-textarea');

					return text
						.setPlaceholder(i18n.t('settings.testClientPrompt.placeholder'))
						.setValue(this.plugin.settings.testClientPrompt)
						.onChange(async (value) => {
							this.plugin.settings.testClientPrompt = value;
							await this.plugin.saveSettings();
						});
				});
		}

		// Add heading for hotkeys settings
		new Setting(containerEl)
			.setName(i18n.t('settings.hotkeysHeading'))
			.setDesc(i18n.t('settings.hotkeysDesc'))
			.setHeading();

		this.displaySupportFooter(containerEl);
	}
}
