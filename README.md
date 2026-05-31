# MemMaster Flashcards + AI Tests

A simple yet powerful spaced repetition plugin that helps you memorize your Obsidian notes using flashcards, AI-generated tests, quizzes, spaced repetition, active recall, and review scheduling.

![Banner](docs/screenshots/img_1.png)
![Review List](docs/screenshots/img_2.png)
![Flashcard Review](docs/screenshots/img_3.png)

## Features

- **Turn any note into a flashcard** — by tag or folder
- **Review list** — shows all cards due for review today, sorted by urgency
- **Completed cards** — mastered cards are moved to a separate Completed tab
- **Review completed cards again** — reset completed cards and return them to the review flow
- **Difficulty rating** — mark cards as Easy, Medium, or Hard
- **Smart scheduling** — calculates review intervals automatically
- **AI-generated tests** — generate multiple-choice tests and quizzes from flashcards
- **OpenAI and DeepSeek support** — choose an AI provider and model for test generation
- **Tests review mode** — answer generated tests in a dedicated review flow with explanations
- **Markdown test files** — generated tests are saved in your vault and linked to source cards
- **Character count warning** — helps keep flashcard notes focused and easy to review
- **Keyboard shortcuts** — quick review without leaving the keyboard
- **Responsive layout** — works better on smaller screens and mobile devices
- **Multilingual** — multiple language support

## How It Works

1. Mark a note as a flashcard by command, tag, or folder.
2. The plugin adds metadata to track your review progress.
3. Review cards when they're due and rate each card as Easy, Medium, or Hard.
4. Optionally generate AI tests from a flashcard using OpenAI or DeepSeek.
5. Review generated tests in the Tests mode and choose the correct answer.
6. Cards and tests are rescheduled based on your rating or answer:
   - **Easy** → longer interval (`2^stage` days)
   - **Medium** → moderate interval (`1.5^stage` days)
   - **Hard** → shorter interval (`1.2^stage` days)
7. After 10 successful reviews, a card or test is considered completed and moved out of the active review queue.
8. Completed cards remain available in the Completed tab and can be reset if you want to review them again.

## Algorithm

MemMaster uses a simplified version of the SM-2 (SuperMemo 2) algorithm.

Unlike the original SM-2 algorithm, it doesn't use an "ease factor" coefficient. Instead, fixed base values are applied for each difficulty level, making the system more predictable and easier to understand.

## AI Tests

MemMaster can generate up to 3 multiple-choice tests from a source flashcard. Tests use OpenAI or DeepSeek, are saved as Markdown files in your vault, and include the question, answer options, correct answer, explanation, source card link, review date, and review stage.

Generated tests appear in the Tests mode of the review list. Correct answers advance the test through the spaced repetition schedule; wrong answers stay due so you can retry them.

## Installation

1. Open **Settings → Community plugins** in Obsidian.
2. Click **Browse** and search for **MemMaster**.
3. Click **Install**, then **Enable**.
4. Configure your preferred flashcard source, such as tag or folder, in plugin settings.
5. To use AI tests, enable tests in settings, choose OpenAI or DeepSeek, add your API key, and select a tests folder.

## Privacy

MemMaster stores review metadata, generated tests, and plugin settings in your Obsidian vault. Flashcard review is local-only. When you generate AI tests, the source card content is sent to your selected provider, OpenAI or DeepSeek, using the API key stored in your local plugin settings.

## Usage

| Command | Description |
|---------|-------------|
| `Open Review List View` | Open the review panel |
| `Make current document a flashcard` | Convert current note to flashcard |
| `Mark current card as Easy/Medium/Hard` | Rate card difficulty |
| `Generate test` button | Generate AI tests from the current flashcard |

## Completed Cards

When a card reaches the final review stage, MemMaster marks it as completed instead of removing all plugin metadata.

Completed cards are excluded from the regular review queue, but they remain visible in the Completed tab. You can reset a completed card if you want to review it again.
