import {App, getAllTags, Modal, Notice, PluginSettingTab, Setting, setIcon, TFolder} from 'obsidian';
import MemMasterPlugin from '../main';
import { PLUGIN_EVENTS } from '../core/events';
import { isValidUserKey } from '../cloud/identity';
import { CloudUserStatus } from '../cloud/client';

class ImportBackupKeyModal extends Modal {
	private plugin: MemMasterPlugin;
	private userKey = '';
	private onImport: () => void;

	constructor(app: App, plugin: MemMasterPlugin, onImport: () => void) {
		super(app);
		this.plugin = plugin;
		this.onImport = onImport;
	}

	onOpen(): void {
		const { contentEl } = this;
		const { i18n } = this.plugin;

		contentEl.empty();
		contentEl.createEl('h2', { text: i18n.t('settings.cloudIdentity.importModalTitle') });
		contentEl.createEl('p', { text: i18n.t('settings.cloudIdentity.importModalDesc') });

		new Setting(contentEl)
			.setName(i18n.t('settings.cloudIdentity.backupKey'))
			.addText((text) => {
				text
					.setPlaceholder(i18n.t('settings.cloudIdentity.importPlaceholder'))
					.onChange((value) => {
						this.userKey = value.trim();
					});

				text.inputEl.focus();
			});

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText(i18n.t('settings.cloudIdentity.cancel'))
					.onClick(() => this.close())
			)
			.addButton((button) =>
				button
					.setButtonText(i18n.t('settings.cloudIdentity.importButton'))
					.setCta()
					.onClick(async () => {
						if (!isValidUserKey(this.userKey)) {
							new Notice(i18n.t('notices.invalidBackupKey'));
							return;
						}

						button.setDisabled(true);

						try {
							const status = await this.plugin.checkCloudConnectionStatus(this.userKey);

							if (status.state === 'connected') {
								this.plugin.settings.userKey = this.userKey;
								await this.plugin.saveSettings();
								new Notice(i18n.t('notices.backupKeyImported'));
								this.onImport();
								this.close();
							} else if (status.state === 'not_found') {
								new Notice(i18n.t('notices.backupKeyNotFound'));
							} else if (status.state === 'bad_request') {
								new Notice(i18n.t('notices.invalidBackupKey'));
							} else {
								new Notice(i18n.t('notices.cloudUnavailable'));
							}
						} catch {
							new Notice(i18n.t('notices.connectionSaveFailed'));
						} finally {
							button.setDisabled(false);
						}
					})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

class CreateConnectionConfirmModal extends Modal {
	private plugin: MemMasterPlugin;
	private onCreate: () => void;

	constructor(app: App, plugin: MemMasterPlugin, onCreate: () => void) {
		super(app);
		this.plugin = plugin;
		this.onCreate = onCreate;
	}

	onOpen(): void {
		const { contentEl } = this;
		const { i18n } = this.plugin;

		contentEl.empty();
		contentEl.createEl('h2', { text: i18n.t('settings.cloudIdentity.createModalTitle') });
		contentEl.createEl('p', { text: i18n.t('settings.cloudIdentity.createModalDesc') });

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText(i18n.t('settings.cloudIdentity.cancel'))
					.onClick(() => this.close())
			)
			.addButton((button) =>
				button
					.setButtonText(i18n.t('settings.cloudIdentity.createConnection'))
					.setCta()
					.onClick(async () => {
						button.setDisabled(true);
						const isCreated = await this.plugin.createCloudConnection();

						if (isCreated) {
							new Notice(i18n.t('notices.connectionCreated'));
							this.onCreate();
							this.close();
						} else {
							button.setDisabled(false);
						}
					})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export default class MemMasterPluginSettingTab extends PluginSettingTab {
	plugin: MemMasterPlugin;
	private cloudConnectionStatusRequestId = 0;

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

	private openCreateConnectionModal(): void {
		new CreateConnectionConfirmModal(this.app, this.plugin, () => {
			this.display();
			this.plugin.events.trigger(PLUGIN_EVENTS.SETTINGS_UPDATED);
		}).open();
	}

	private addCloudStatusAction(statusEl: HTMLElement, label: string, onClick: () => void): void {
		const actionsEl = statusEl.createDiv({ cls: 'mm-cloud-identity-status-actions' });
		const buttonEl = actionsEl.createEl('button', { text: label });

		buttonEl.addEventListener('click', onClick);
	}

	private renderCloudIdentityStatus(
		statusEl: HTMLElement,
		status: 'checking' | 'missing' | CloudUserStatus
	): void {
		const { i18n } = this.plugin;

		statusEl.empty();
		statusEl.removeClass('mm-cloud-identity-status-connected');
		statusEl.removeClass('mm-cloud-identity-status-warning');
		statusEl.removeClass('mm-cloud-identity-status-error');
		statusEl.removeClass('mm-cloud-identity-status-loading');

		const iconEl = statusEl.createSpan({ cls: 'mm-cloud-identity-status-icon' });
		const textEl = statusEl.createDiv({ cls: 'mm-cloud-identity-status-text' });

		if (status === 'checking') {
			statusEl.addClass('mm-cloud-identity-status-loading');
			setIcon(iconEl, 'loader-circle');
			textEl.createEl('strong', { text: i18n.t('settings.cloudIdentity.statusChecking') });
			textEl.createEl('p', { text: i18n.t('settings.cloudIdentity.statusCheckingDesc') });
			return;
		}

		if (status === 'missing') {
			statusEl.addClass('mm-cloud-identity-status-warning');
			setIcon(iconEl, 'circle-alert');
			textEl.createEl('strong', { text: i18n.t('settings.cloudIdentity.statusMissing') });
			textEl.createEl('p', { text: i18n.t('settings.cloudIdentity.statusMissingDesc') });
			this.addCloudStatusAction(statusEl, i18n.t('settings.cloudIdentity.createConnection'), () => {
				this.openCreateConnectionModal();
			});
			return;
		}

		if (status.state === 'connected') {
			statusEl.addClass('mm-cloud-identity-status-connected');
			setIcon(iconEl, 'circle-check');
			textEl.createEl('strong', { text: i18n.t('settings.cloudIdentity.statusConnected') });
			textEl.createEl('p', {
				text: i18n.t('settings.cloudIdentity.statusConnectedDesc', {
					date: new Date(status.user.createdAt).toLocaleString(),
				}),
			});
			return;
		}

		statusEl.addClass(status.state === 'unavailable'
			? 'mm-cloud-identity-status-warning'
			: 'mm-cloud-identity-status-error');
		setIcon(iconEl, status.state === 'unavailable' ? 'cloud-off' : 'circle-x');

		if (status.state === 'not_found') {
			textEl.createEl('strong', { text: i18n.t('settings.cloudIdentity.statusNotFound') });
			textEl.createEl('p', { text: i18n.t('settings.cloudIdentity.statusNotFoundDesc') });
			this.addCloudStatusAction(statusEl, i18n.t('settings.cloudIdentity.createConnection'), () => {
				this.openCreateConnectionModal();
			});
		} else if (status.state === 'bad_request') {
			textEl.createEl('strong', { text: i18n.t('settings.cloudIdentity.statusInvalid') });
			textEl.createEl('p', { text: i18n.t('settings.cloudIdentity.statusInvalidDesc') });
			this.addCloudStatusAction(statusEl, i18n.t('settings.cloudIdentity.createConnection'), () => {
				this.openCreateConnectionModal();
			});
		} else {
			textEl.createEl('strong', { text: i18n.t('settings.cloudIdentity.statusUnavailable') });
			textEl.createEl('p', { text: i18n.t('settings.cloudIdentity.statusUnavailableDesc') });
			this.addCloudStatusAction(statusEl, i18n.t('settings.cloudIdentity.tryAgain'), () => {
				void this.refreshCloudIdentityStatus(statusEl);
			});
		}
	}

	private async refreshCloudIdentityStatus(statusEl: HTMLElement): Promise<void> {
		const requestId = ++this.cloudConnectionStatusRequestId;

		if (!this.plugin.settings.userKey) {
			this.renderCloudIdentityStatus(statusEl, 'checking');
			const isCreated = await this.plugin.ensureCloudConnection();

			if (requestId !== this.cloudConnectionStatusRequestId) {
				return;
			}

			if (!isCreated || !this.plugin.settings.userKey) {
				this.renderCloudIdentityStatus(statusEl, 'missing');
				return;
			}

			this.display();
			return;
		}

		this.renderCloudIdentityStatus(statusEl, 'checking');
		const status = await this.plugin.checkCloudConnectionStatus();

		if (requestId !== this.cloudConnectionStatusRequestId) {
			return;
		}

		this.renderCloudIdentityStatus(statusEl, status);
	}

	private displayCloudIdentitySettings(containerEl: HTMLElement): void {
		const { i18n } = this.plugin;
		const hasUserKey = Boolean(this.plugin.settings.userKey);

		new Setting(containerEl)
			.setName(i18n.t('settings.cloudIdentity.heading'))
			.setDesc(i18n.t('settings.cloudIdentity.desc'))
			.setHeading();

		const infoEl = containerEl.createDiv({ cls: 'mm-cloud-identity-callout' });
		const iconEl = infoEl.createSpan({ cls: 'mm-cloud-identity-callout-icon' });
		setIcon(iconEl, 'sparkles');

		const textEl = infoEl.createDiv({ cls: 'mm-cloud-identity-callout-text' });
		textEl.createEl('strong', { text: i18n.t('settings.cloudIdentity.calloutTitle') });
		textEl.createEl('p', { text: i18n.t('settings.cloudIdentity.calloutBody') });

		const statusEl = containerEl.createDiv({ cls: 'mm-cloud-identity-status' });
		void this.refreshCloudIdentityStatus(statusEl);

		if (hasUserKey) {
			new Setting(containerEl)
				.setName(i18n.t('settings.cloudIdentity.copyBackupKey'))
				.setDesc(i18n.t('settings.cloudIdentity.copyBackupKeyDesc'))
				.addButton((button) =>
					button
						.setButtonText(i18n.t('settings.cloudIdentity.copyBackupKey'))
						.onClick(async () => {
							if (!this.plugin.settings.userKey) {
								return;
							}

							try {
								await globalThis.navigator.clipboard.writeText(this.plugin.settings.userKey);
								new Notice(i18n.t('notices.backupKeyCopied'));
							} catch {
								new Notice(i18n.t('notices.backupKeyCopyFailed'));
							}
						})
				);
		}

		new Setting(containerEl)
			.setName(i18n.t('settings.cloudIdentity.importBackupKey'))
			.setDesc(i18n.t('settings.cloudIdentity.importBackupKeyDesc'))
			.addButton((button) =>
				button
					.setButtonText(i18n.t('settings.cloudIdentity.importBackupKey'))
					.onClick(() => {
						new ImportBackupKeyModal(this.app, this.plugin, () => {
							this.display();
							this.plugin.events.trigger(PLUGIN_EVENTS.SETTINGS_UPDATED);
						}).open();
					})
			);
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

		this.displayCloudIdentitySettings(containerEl);

		// Add heading for hotkeys settings
		new Setting(containerEl)
			.setName(i18n.t('settings.hotkeysHeading'))
			.setDesc(i18n.t('settings.hotkeysDesc'))
			.setHeading();
	}
}
