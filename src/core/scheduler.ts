import { TFile, Notice } from 'obsidian';
import { Card, createEmptyCard, fsrs, Grade, Rating, State } from 'ts-fsrs';
import MemMasterPlugin from '../main';
import { PLUGIN_EVENTS } from './events';
import { isFileInFolder } from './utils';

// Add this interface at the top of the file, after imports
interface ParsedContent {
    metadata: Record<string, string>;
    body: string;
}

type ReviewItemType = 'card' | 'test';
type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

const FSRS_PARAMETERS = {
    enable_short_term: false,
};

const MEMMASTER_FSRS_KEYS = [
    "memmaster-next-review",
    "memmaster-stage",
    "memmaster-completed",
    "memmaster-completed-at",
    "memmaster-fsrs-state",
    "memmaster-fsrs-stability",
    "memmaster-fsrs-difficulty",
    "memmaster-fsrs-scheduled-days",
    "memmaster-fsrs-reps",
    "memmaster-fsrs-lapses",
    "memmaster-fsrs-learning-steps",
    "memmaster-fsrs-last-review",
];

const MEMMASTER_LEGACY_SCHEDULING_KEYS = [
    "memmaster-stage",
    "memmaster-completed",
    "memmaster-completed-at",
];

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

function buildContentWithFrontmatter(metadata: Record<string, string>, body: string): string {
    const newFrontmatter =
        "---\n" +
        Object.entries(metadata)
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n") +
        "\n---\n";

    return newFrontmatter + body;
}

function buildContentWithOptionalFrontmatter(metadata: Record<string, string>, body: string): string {
    if (Object.keys(metadata).length === 0) {
        return body;
    }

    return buildContentWithFrontmatter(metadata, body);
}

function parseNumber(value: string | undefined, fallback: number): number {
    if (!value) {
        return fallback;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInteger(value: string | undefined, fallback: number): number {
    if (!value) {
        return fallback;
    }

    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDate(value: string | undefined): Date | undefined {
    if (!value) {
        return undefined;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseState(value: string | undefined): State {
    if (!value) {
        return State.New;
    }

    const numericState = Number(value);
    const validStates = [State.New, State.Learning, State.Review, State.Relearning] as number[];
    if (Number.isInteger(numericState) && validStates.includes(numericState)) {
        return numericState as State;
    }

    const state = State[value.trim() as keyof typeof State];
    return typeof state === 'number' ? state : State.New;
}

function getElapsedDays(lastReview: Date | undefined, now: Date): number {
    if (!lastReview) {
        return 0;
    }

    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.max(0, Math.floor((now.getTime() - lastReview.getTime()) / millisecondsPerDay));
}

function getFsrsCard(metadata: Record<string, string>, now: Date): Card {
    if (!metadata["memmaster-fsrs-state"]) {
        return createEmptyCard(now);
    }

    const lastReview = parseDate(metadata["memmaster-fsrs-last-review"]);

    return {
        due: parseDate(metadata["memmaster-next-review"]) ?? now,
        stability: parseNumber(metadata["memmaster-fsrs-stability"], 0),
        difficulty: parseNumber(metadata["memmaster-fsrs-difficulty"], 0),
        elapsed_days: getElapsedDays(lastReview, now),
        scheduled_days: parseInteger(metadata["memmaster-fsrs-scheduled-days"], 0),
        learning_steps: parseInteger(metadata["memmaster-fsrs-learning-steps"], 0),
        reps: parseInteger(metadata["memmaster-fsrs-reps"], 0),
        lapses: parseInteger(metadata["memmaster-fsrs-lapses"], 0),
        state: parseState(metadata["memmaster-fsrs-state"]),
        last_review: lastReview,
    };
}

function writeFsrsCardMetadata(metadata: Record<string, string>, card: Card): void {
    MEMMASTER_FSRS_KEYS.forEach((key) => delete metadata[key]);

    metadata["memmaster-next-review"] = card.due.toISOString();

    if (card.last_review) {
        metadata["memmaster-fsrs-last-review"] = card.last_review.toISOString();
    }

    metadata["memmaster-fsrs-state"] = State[card.state];
    metadata["memmaster-fsrs-stability"] = card.stability.toString();
    metadata["memmaster-fsrs-difficulty"] = card.difficulty.toString();
    metadata["memmaster-fsrs-scheduled-days"] = card.scheduled_days.toString();
    metadata["memmaster-fsrs-reps"] = card.reps.toString();
    metadata["memmaster-fsrs-lapses"] = card.lapses.toString();
    metadata["memmaster-fsrs-learning-steps"] = card.learning_steps.toString();
}

function hasLegacySchedulingMetadata(metadata: Record<string, string>): boolean {
    return MEMMASTER_LEGACY_SCHEDULING_KEYS.some((key) => key in metadata)
        && !metadata["memmaster-fsrs-state"];
}

function mapReviewRating(rating: ReviewRating): Grade {
    if (rating === "again") {
        return Rating.Again;
    }
    if (rating === "hard") {
        return Rating.Hard;
    }
    if (rating === "good") {
        return Rating.Good;
    }

    return Rating.Easy;
}

async function updateReviewMetadata(plugin: MemMasterPlugin, file: TFile, rating: ReviewRating, itemType: ReviewItemType) {
    const content = await plugin.app.vault.read(file);

    // Extract YAML frontmatter
    const { metadata, body } = parseFrontmatter(content);

    const now = new Date();
    const scheduler = fsrs(FSRS_PARAMETERS);
    const result = scheduler.next(getFsrsCard(metadata, now), now, mapReviewRating(rating));
    writeFsrsCardMetadata(metadata, result.card);

    // Write back to file
    await plugin.app.vault.modify(file, buildContentWithFrontmatter(metadata, body));
    new Notice(plugin.i18n.t(
        itemType === 'test' ? 'notices.testUpdated' : 'notices.cardUpdated',
        { date: metadata["memmaster-next-review"] }
    ));

    // Refresh review list view
    plugin.events.trigger(itemType === 'test' ? PLUGIN_EVENTS.TEST_UPDATED : PLUGIN_EVENTS.CARD_UPDATED);
}

export async function updateCardMetadata(plugin: MemMasterPlugin, file: TFile, rating: ReviewRating) {
    await updateReviewMetadata(plugin, file, rating, 'card');
}

export async function updateTestMetadata(plugin: MemMasterPlugin, file: TFile, rating: Extract<ReviewRating, 'good' | 'again'>) {
    await updateReviewMetadata(plugin, file, rating, 'test');
}

export async function clearAllMemMasterMetadata(plugin: MemMasterPlugin, file: TFile): Promise<boolean> {
    const content = await plugin.app.vault.read(file);
    const { metadata, body } = parseFrontmatter(content);

    Object.keys(metadata).forEach((key) => {
        if (key.startsWith("memmaster-")) {
            delete metadata[key];
        }
    });

    await plugin.app.vault.modify(file, buildContentWithOptionalFrontmatter(metadata, body));
    new Notice(plugin.i18n.t('notices.memMasterMetadataCleared'));
    plugin.events.trigger(PLUGIN_EVENTS.CARD_UPDATED);
    plugin.events.trigger(PLUGIN_EVENTS.TEST_UPDATED);

    return true;
}

export async function resetLegacyReviewMetadataToFsrs(plugin: MemMasterPlugin): Promise<number> {
    const now = new Date();
    let resetCount = 0;

    for (const file of plugin.app.vault.getMarkdownFiles()) {
        const content = await plugin.app.vault.cachedRead(file);
        const { metadata, body } = parseFrontmatter(content);

        if (!hasLegacySchedulingMetadata(metadata)) {
            continue;
        }

        writeFsrsCardMetadata(metadata, createEmptyCard(now));
        await plugin.app.vault.modify(file, buildContentWithFrontmatter(metadata, body));
        resetCount++;
    }

    if (resetCount > 0) {
        plugin.events.trigger(PLUGIN_EVENTS.CARD_UPDATED);
        plugin.events.trigger(PLUGIN_EVENTS.TEST_UPDATED);
    }

    return resetCount;
}

export async function makeFlashcard(plugin: MemMasterPlugin, file: TFile): Promise<boolean> {
    const content = await plugin.app.vault.read(file);
    const { metadata, body } = parseFrontmatter(content);

    // Initialize metadata for new flashcard
    const now = new Date();
    writeFsrsCardMetadata(metadata, createEmptyCard(now));

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
        await plugin.app.vault.modify(file, newFrontmatter + body);
        
        await plugin.app.fileManager.renameFile(file, newPath);
        new Notice(plugin.i18n.t('notices.flashcardCreated') + ' - ' + plugin.i18n.t('notices.movedToFolder', { folder: cleanFolderPath }));
        
        // Refresh review list view
        plugin.events.trigger(PLUGIN_EVENTS.CARD_UPDATED);
        return true;
    }

    return false;
}
