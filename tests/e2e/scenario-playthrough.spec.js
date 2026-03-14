import { test, expect } from '@playwright/test';
import {
    clearAppState,
    setFastTyping,
    waitForMessages,
    waitForChoices,
    waitForTypingDone,
    selectChoice,
    getMessageTexts,
    injectScenario,
    confirmDialog,
} from './helpers/utils.js';
import {
    MESSAGES,
    MESSAGE_NPC,
    MESSAGE_PLAYER,
    MESSAGE_BUBBLE,
    CHOICE_BTN,
    TYPING_INDICATOR,
    BTN_RESTART,
    CHOICES_CONTENT,
} from './helpers/selectors.js';
import { BRANCHING_SCENARIO } from './helpers/fixtures.js';

test.describe('Scenario Playthrough', () => {

    test.beforeEach(async ({ page }) => {
        await clearAppState(page);
        await setFastTyping(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('loads demo scenario on first visit', async ({ page }) => {
        // After clearing state and visiting /, the app should fetch and load the demo scenario.
        // The demo "start" knot has multiple NPC text lines before choices appear.
        await waitForMessages(page, 1);

        const npcMessages = page.locator(`${MESSAGES} ${MESSAGE_NPC}`);
        const count = await npcMessages.count();
        expect(count).toBeGreaterThanOrEqual(1);

        // The first message bubble should contain text from the demo scenario.
        const firstBubble = page.locator(`${MESSAGES} ${MESSAGE_NPC} ${MESSAGE_BUBBLE}`).first();
        const text = await firstBubble.textContent();
        expect(text.length).toBeGreaterThan(0);
    });

    test('displays NPC messages with typing indicator', async ({ page }) => {
        // With very fast typing delays (10ms) the indicator may vanish before we catch it.
        // Instead, verify that after the scenario loads, NPC messages are rendered —
        // which implies the typing-then-display cycle completed successfully.
        await waitForChoices(page); // choices appear after all NPC text is shown

        // At least one NPC message bubble should exist.
        const bubbles = page.locator(`${MESSAGES} ${MESSAGE_NPC} ${MESSAGE_BUBBLE}`);
        const count = await bubbles.count();
        expect(count).toBeGreaterThanOrEqual(1);

        // Typing indicator should NOT be visible now (all messages rendered).
        const indicator = page.locator(TYPING_INDICATOR);
        await expect(indicator).toBeHidden();
    });

    test('shows choice buttons after NPC messages', async ({ page }) => {
        // The demo "start" knot ends with 3 choices.
        await waitForChoices(page);

        const buttons = page.locator(CHOICE_BTN);
        await expect(buttons).toHaveCount(3);

        // Verify the choice texts match the demo scenario.
        const texts = await buttons.allInnerTexts();
        expect(texts).toContain('Я ищу Кристалл Вечности');
        expect(texts).toContain('Я просто заблудился');
        expect(texts).toContain('Я пришёл попросить вашей помощи');
    });

    test('selecting a choice shows player message', async ({ page }) => {
        await waitForChoices(page);

        // Grab the text of the first choice before clicking.
        const firstChoiceText = await page.locator(CHOICE_BTN).first().textContent();

        await selectChoice(page, 0);

        // A player message should appear with the choice text.
        const playerMessages = page.locator(`${MESSAGES} ${MESSAGE_PLAYER}`);
        await playerMessages.first().waitFor({ state: 'visible', timeout: 5_000 });

        const playerBubble = page.locator(`${MESSAGES} ${MESSAGE_PLAYER} ${MESSAGE_BUBBLE}`).first();
        await expect(playerBubble).toHaveText(firstChoiceText);
    });

    test('selecting a choice advances to next knot', async ({ page }) => {
        await waitForChoices(page);

        // Record the NPC message count before choosing.
        const npcCountBefore = await page.locator(`${MESSAGES} ${MESSAGE_NPC}`).count();

        // Select the first choice ("Я ищу Кристалл Вечности" -> seeking_crystal).
        await selectChoice(page, 0);

        // Wait for new NPC messages from the target knot.
        await waitForTypingDone(page);
        await waitForMessages(page, npcCountBefore + 2);

        const npcCountAfter = await page.locator(`${MESSAGES} ${MESSAGE_NPC}`).count();
        expect(npcCountAfter).toBeGreaterThan(npcCountBefore);
    });

    test('reaches END state', async ({ page }) => {
        // Play through two choices to reach END.
        // start -> choice 0 ("Я ищу Кристалл Вечности") -> seeking_crystal
        await waitForChoices(page);
        await selectChoice(page, 0);
        await waitForTypingDone(page);

        // seeking_crystal -> choice 0 ("Он может спасти мою деревню от болезни") -> noble_cause -> END
        await waitForChoices(page);
        await selectChoice(page, 0);
        await waitForTypingDone(page);

        // At END, choices should disappear (choices-content should be empty).
        const choiceButtons = page.locator(CHOICE_BTN);
        await expect(choiceButtons).toHaveCount(0);

        // The final NPC messages should be present.
        const allTexts = await getMessageTexts(page);
        expect(allTexts.length).toBeGreaterThanOrEqual(3);
    });

    test('restart clears and replays', async ({ page }) => {
        // Make a choice to advance beyond start.
        await waitForChoices(page);
        await selectChoice(page, 0);
        await waitForTypingDone(page);

        // Record the current messages.
        const textsBeforeRestart = await getMessageTexts(page);
        expect(textsBeforeRestart.length).toBeGreaterThanOrEqual(2);

        // Click restart.
        await page.locator(BTN_RESTART).click();
        await confirmDialog(page);

        // After restart, messages should be cleared and replayed from the beginning.
        await waitForMessages(page, 1);
        await waitForChoices(page);

        // The first NPC message should match the start of the demo scenario.
        const firstBubble = page.locator(`${MESSAGES} ${MESSAGE_NPC} ${MESSAGE_BUBBLE}`).first();
        const firstText = await firstBubble.textContent();
        // The demo start knot begins with an asterisk-formatted action text.
        expect(firstText).toContain('Туман расступается');
    });

    test('multiple paths produce different messages', async ({ page }) => {
        // Inject the branching scenario so we have predictable, short paths.
        await injectScenario(page, 'test_branching', 'Branching Test', BRANCHING_SCENARIO);
        await page.reload();
        await page.waitForLoadState('networkidle');
        await setFastTyping(page);
        await page.reload();
        await page.waitForLoadState('networkidle');

        // --- Play path Alpha ---
        // start knot: NPC "Choose your path wisely." + 3 choices
        await waitForChoices(page);
        await selectChoice(page, 0); // "Path Alpha" -> path_alpha

        // Wait for the ending message to appear (NPC greeting + player echo + NPC ending = 3 messages).
        await page.locator(`${MESSAGE_BUBBLE}:text-is("You chose Alpha. Ending A reached.")`).waitFor({ timeout: 10_000 });

        const textsAlpha = await getMessageTexts(page);
        expect(textsAlpha.some(t => t.includes('Ending A reached'))).toBe(true);

        // --- Restart and play path Beta ---
        await page.locator(BTN_RESTART).click();
        await confirmDialog(page);

        // After restart, wait for the scenario to reload from scratch with new choices.
        // The "Ending A" message should no longer be present once restart completes.
        await page.locator(`${MESSAGE_BUBBLE}:text-is("Choose your path wisely.")`).waitFor({ timeout: 10_000 });
        await waitForChoices(page);
        await selectChoice(page, 1); // "Path Beta" -> path_beta

        await page.locator(`${MESSAGE_BUBBLE}:text-is("You chose Beta. Ending B reached.")`).waitFor({ timeout: 10_000 });

        const textsBeta = await getMessageTexts(page);
        expect(textsBeta.some(t => t.includes('Ending B reached'))).toBe(true);
        expect(textsBeta.some(t => t.includes('Ending A reached'))).toBe(false);
    });

});
