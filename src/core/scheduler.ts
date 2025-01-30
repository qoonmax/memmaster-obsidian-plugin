import { TFile, Notice } from 'obsidian';
import MemMasterPlugin from '../main';
import { PLUGIN_EVENTS } from './events';
import { isFileInFolder } from './utils';

// Add this interface at the top of the file, after imports
interface ParsedContent {
    metadata: Record<string, string>;
    body: string;
}

// New function to extract and parse frontmatter
function parseFrontmatter(content: string): ParsedContent {
    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = frontmatterMatch ? frontmatterMatch[1] : "";
    const body = frontmatterMatch ? content.replace(frontmatterMatch[0], "").trim() : content;

    // Parse frontmatter into metadata object
    const metadata: Record<string, string> = {};
    frontmatter.split("\n").forEach((line) => {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            if (key && value) {
                metadata[key] = value;
            }
        }
    });

    return { metadata, body };
}

export async function updateCardMetadata(plugin: MemMasterPlugin, file: TFile, difficulty: string) {
    const content = await plugin.app.vault.read(file);

    // Extract YAML frontmatter
    const { metadata, body } = parseFrontmatter(content);

    // Update stage and review date
    const now = new Date();
    let nextInterval: number;
    let stage = parseInt(metadata["memmaster-stage"] || "0");

    if (difficulty === "easy") {
        nextInterval = Math.pow(2, stage);
        stage++;
    } else if (difficulty === "medium") {
        nextInterval = Math.pow(1.5, stage);
        stage++;
    } else if (difficulty === "hard") {
        nextInterval = Math.max(1, Math.floor(Math.pow(1.2, stage)));
        stage++;
    } else {
        // Default fallback for unknown difficulty
        nextInterval = 1;
        stage++;
    }

    // Check if stage is above 10
    if (stage > 10) {
        // Remove metadata by removing the entire frontmatter
        await plugin.app.vault.modify(file, body);
        new Notice(plugin.i18n.t('notices.cardMastered'));

        // Refresh review list view
        plugin.events.trigger(PLUGIN_EVENTS.CARD_UPDATED);
        return;
    }

    // If stage is not above 10, proceed with normal update
    const nextDate = new Date(now.getTime() + nextInterval * 24 * 60 * 60 * 1000);
    metadata["memmaster-next-review"] = nextDate.toISOString().split("T")[0];
    metadata["memmaster-stage"] = stage.toString();

    // Form new YAML
    const newFrontmatter =
        "---\n" +
        Object.entries(metadata)
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n") +
        "\n---\n";

    // Write back to file
    await plugin.app.vault.modify(file, newFrontmatter + "\n" + body);
    new Notice(plugin.i18n.t('notices.cardUpdated', { date: metadata["memmaster-next-review"] }));

    // Refresh review list view
    plugin.events.trigger(PLUGIN_EVENTS.CARD_UPDATED);
}

export async function makeFlashcard(plugin: MemMasterPlugin, file: TFile): Promise<boolean> {
    const content = await plugin.app.vault.read(file);
    const { metadata, body } = parseFrontmatter(content);

    // Initialize metadata for new flashcard
    const now = new Date();
    metadata["memmaster-next-review"] = now.toISOString().split("T")[0];
    metadata["memmaster-stage"] = "0";

    if (plugin.settings.sourceMode === 'tag') {
        // Add tag to content
        const tagName = plugin.settings.tagName || 'flashcard';
        const tag = tagName.startsWith('#') ? tagName : `#${tagName}`;
        
        // Check if tag already exists in content
        const tagRegex = new RegExp(`(^|\\s)${tag.replace('#', '\\#')}(\\b|$)`, 'i');
        if (tagRegex.test(content)) {
            new Notice(plugin.i18n.t('notices.alreadyFlashcard'));
            return false;
        }

        // Check if tag exists in frontmatter
        let hasTagInFrontmatter = false;
        if (metadata['tags']) {
            const tags = metadata['tags'];
            if (tags.includes(tagName)) {
                hasTagInFrontmatter = true;
            }
        }

        if (hasTagInFrontmatter) {
            new Notice(plugin.i18n.t('notices.alreadyFlashcard'));
            return false;
        }

        // Add tag to body content (at the beginning)
        // Remove only leading/trailing empty lines, but preserve indentation
        let newBody = body.replace(/^\n+/, '').replace(/\n+$/, '');
        if (newBody.length > 0) {
            newBody = tag + '\n\n' + newBody;
        } else {
            newBody = tag + '\n';
        }

        // Form new YAML
        const newFrontmatter =
            "---\n" +
            Object.entries(metadata)
                .map(([key, value]) => `${key}: ${value}`)
                .join("\n") +
            "\n---";

        // Write back to file with tag in body
        await plugin.app.vault.modify(file, newFrontmatter + "\n" + newBody);
        new Notice(plugin.i18n.t('notices.flashcardCreated') + ' - ' + plugin.i18n.t('notices.tagAdded', { tag }));
        
        // Refresh review list view
        plugin.events.trigger(PLUGIN_EVENTS.CARD_UPDATED);
        return true;

    } else if (plugin.settings.sourceMode === 'folder') {
        // Move file to folder
        const folderPath = plugin.settings.folderName || 'Flashcards';
        const cleanFolderPath = folderPath.trim().replace(/^\/+|\/+$/g, '');
        
        // Check if file is already in the target folder
        if (isFileInFolder(file.path, cleanFolderPath)) {
            new Notice(plugin.i18n.t('notices.alreadyFlashcard'));
            return false;
        }

        // Ensure folder exists
        const folder = plugin.app.vault.getAbstractFileByPath(cleanFolderPath);
        if (!folder) {
            await plugin.app.vault.createFolder(cleanFolderPath);
        }

        // Move file
        const newPath = `${cleanFolderPath}/${file.name}`;
        
        // Update metadata before moving
        const newFrontmatter =
            "---\n" +
            Object.entries(metadata)
                .map(([key, value]) => `${key}: ${value}`)
                .join("\n") +
            "\n---\n";
        await plugin.app.vault.modify(file, newFrontmatter + "\n" + body);
        
        await plugin.app.fileManager.renameFile(file, newPath);
        new Notice(plugin.i18n.t('notices.flashcardCreated') + ' - ' + plugin.i18n.t('notices.movedToFolder', { folder: cleanFolderPath }));
        
        // Refresh review list view
        plugin.events.trigger(PLUGIN_EVENTS.CARD_UPDATED);
        return true;
    }

    return false;
}