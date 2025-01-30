import { TFile } from 'obsidian';
import MemMasterPlugin from '../main';
import { isFileInFolder } from './utils';

export interface CardMetadata {
    nextReview: string;
    stage: string;
    file: TFile;
    content: string;
}

/**
 * Check if content contains given tag either as inline #tag or in YAML frontmatter tags.
 */
export function hasTagInContent(content: string, rawTagName: string): boolean {
    const tagName = rawTagName.replace(/^#/, '');

    // Inline #tag detection
    const inlineRegex = new RegExp(`(^|\\s)#${tagName}(\\b|$)`, 'i');
    const hasInlineTag = inlineRegex.test(content);

    // YAML tags detection
    let hasYamlTag = false;
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
        const fm = fmMatch[1];
        const tagsLine = fm.split('\n').find(l => l.trim().toLowerCase().startsWith('tags:'));
        if (tagsLine) {
            const tagsPart = tagsLine.split(':').slice(1).join(':').trim();
            const yamlRegex = new RegExp(`\\b${tagName}\\b`, 'i');
            hasYamlTag = yamlRegex.test(tagsPart);
        }
    }

    return hasInlineTag || hasYamlTag;
}

export async function isFileFlashcard(plugin: MemMasterPlugin, file: TFile): Promise<boolean> {
    if (plugin.settings.sourceMode === 'folder') {
        const raw = plugin.settings.folderName ?? '';
        const folderPath = raw.trim().replace(/^\/+|\/+$/g, '');
        
        if (!folderPath) {
            return false;
        }

        return isFileInFolder(file.path, folderPath);
    }

    // Default/tag mode
    const content = await plugin.app.vault.cachedRead(file);
    return hasTagInContent(content, plugin.settings.tagName);
}

// Extract metadata from file content
export function extractMetadata(content: string, file: TFile): CardMetadata | null {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    // If there is no frontmatter or it doesn't contain nextReview and stage, return null
    if (!frontmatterMatch) {
        return null;
    }

    const frontmatter = frontmatterMatch[1];
    let hasNextReview = false;
    let hasStage = false;

    const metadata: CardMetadata = {
        nextReview: '',
        stage: '0',
        file: file,
        content: content
    };

    frontmatter.split("\n").forEach((line) => {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) return;
        
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        
        if (key === "memmaster-next-review") {
            metadata.nextReview = value;
            hasNextReview = true;
        }
        if (key === "memmaster-stage") {
            metadata.stage = value;
            hasStage = true;
        }
    });

    // Return null if there are no both required fields
    if (!hasNextReview || !hasStage) {
        return null;
    }

    return metadata;
}

// Check if card is due for review
export function isCardDueForReview(metadata: CardMetadata): boolean {
    if (!metadata.nextReview) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reviewDate = new Date(metadata.nextReview);
    reviewDate.setHours(0, 0, 0, 0);
    return reviewDate <= today;
}

// Sort flashcards by review date
export function sortFlashcards(cards: CardMetadata[]): CardMetadata[] {
    return cards.sort((a, b) => {
        if (!a.nextReview) return -1;
        if (!b.nextReview) return 1;
        return new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime();
    });
}

// Get all flashcards that are due for review
export async function getFlashcardsForReview(plugin: MemMasterPlugin): Promise<CardMetadata[]> {
    const files = plugin.app.vault.getMarkdownFiles();
    const cardMetadata: CardMetadata[] = [];

    for (const file of files) {
        const shouldInclude = await isFileFlashcard(plugin, file);

        if (shouldInclude) {
            const content = await plugin.app.vault.cachedRead(file);
            // Extract metadata; if none, treat as unscheduled (due today)
            const extracted = extractMetadata(content, file);
            const metadata = extracted ?? {
                nextReview: '',
                stage: '0',
                file,
                content
            };
            if (isCardDueForReview(metadata)) {
                cardMetadata.push(metadata);
            }
        }
    }

    // Sort cards
    return sortFlashcards(cardMetadata);
}