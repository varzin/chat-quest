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
    MESSAGE_BUBBLE,
    CHOICE_BTN,
    BTN_RESTART,
} from './helpers/selectors.js';
import { MULTI_STEP_SCENARIO } from './helpers/fixtures.js';

test.describe('Persistence', () => {

    test.beforeEach(async ({ page }) => {
        await clearAppState(page);
        await setFastTyping(page);
        // Inject the deterministic multi-step scenario for predictable state.
        await injectScenario(page, 'test_multistep', 'Multi Step Test', MULTI_STEP_SCENARIO);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('saves progress to localStorage after choice', async ({ page }) => {
        // Wait for the first choice ("Continue to step two").
        await waitForChoices(page);
        await selectChoice(page, 0);
        await waitForTypingDone(page);

        // Check that progress was saved in localStorage.
        const progress = await page.evaluate(() => {
            const raw = localStorage.getItem('chatquest_progress');
            return raw ? JSON.parse(raw) : null;
        });

        expect(progress).not.toBeNull();
        expect(progress).toHaveProperty('test_multistep');

        const state = progress['test_multistep'];
        expect(state).toHaveProperty('currentKnot');
        expect(state).toHaveProperty('displayedMessages');
        expect(state.displayedMessages.length).toBeGreaterThan(0);
    });

    test('restores messages on reload', async ({ page }) => {
        // Advance through one choice.
        await waitForChoices(page);
        await selectChoice(page, 0);
        await waitForTypingDone(page);

        // Wait for messages to settle (step_two messages + next choice point).
        await waitForChoices(page);
        const textsBefore = await getMessageTexts(page);

        // Reload the page.
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Messages should be restored from saved progress.
        await waitForMessages(page, textsBefore.length);

        const textsAfter = await getMessageTexts(page);
        expect(textsAfter).toEqual(textsBefore);
    });

    test('restores choice state on reload', async ({ page }) => {
        // Advance to step_two which presents a new choice.
        await waitForChoices(page);
        await selectChoice(page, 0);
        await waitForTypingDone(page);

        // Wait for step_two's choice to appear.
        await waitForChoices(page);
        const choiceCountBefore = await page.locator(CHOICE_BTN).count();
        expect(choiceCountBefore).toBeGreaterThanOrEqual(1);

        // Reload.
        await page.reload();
        await page.waitForLoadState('networkidle');

        // The same choices should reappear after restore.
        await waitForChoices(page);
        const choiceCountAfter = await page.locator(CHOICE_BTN).count();
        expect(choiceCountAfter).toBe(choiceCountBefore);
    });

    test('restart clears saved progress', async ({ page }) => {
        // Advance through one choice so progress is saved.
        await waitForChoices(page);
        await selectChoice(page, 0);
        await waitForTypingDone(page);
        await waitForChoices(page);

        // Verify progress exists.
        const progressBefore = await page.evaluate(() => {
            const raw = localStorage.getItem('chatquest_progress');
            return raw ? JSON.parse(raw) : null;
        });
        expect(progressBefore).toHaveProperty('test_multistep');

        // Restart.
        await page.locator(BTN_RESTART).click();
        await confirmDialog(page);

        // Wait for the scenario to replay from start.
        await waitForMessages(page, 1);

        // Progress for this scenario should be cleared.
        const progressAfter = await page.evaluate(() => {
            const raw = localStorage.getItem('chatquest_progress');
            return raw ? JSON.parse(raw) : null;
        });

        // Either the key is gone entirely or it no longer has the test_multistep entry.
        const hasEntry = progressAfter && 'test_multistep' in progressAfter;
        expect(hasEntry).toBe(false);
    });

    test('remembers current scenario across reloads', async ({ page }) => {
        // The injected scenario was set as current by injectScenario().
        // Verify chatquest_current points to our scenario.
        const currentBefore = await page.evaluate(() => {
            const raw = localStorage.getItem('chatquest_current');
            return raw ? JSON.parse(raw) : null;
        });

        expect(currentBefore).not.toBeNull();
        expect(currentBefore.type).toBe('scenario');
        expect(currentBefore.id).toBe('test_multistep');

        // Reload and verify it persists.
        await page.reload();
        await page.waitForLoadState('networkidle');

        const currentAfter = await page.evaluate(() => {
            const raw = localStorage.getItem('chatquest_current');
            return raw ? JSON.parse(raw) : null;
        });

        expect(currentAfter).toEqual(currentBefore);

        // The chat header should show the scenario title.
        await waitForMessages(page, 1);
        const title = await page.locator('#chat-title').textContent();
        expect(title).toBe('Multi Step Test');
    });

});
