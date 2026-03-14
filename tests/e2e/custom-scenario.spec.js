import { test, expect } from '@playwright/test';
import { clearAppState, setFastTyping, waitForMessages, waitForChoices, waitForTypingDone, openSidebar, closeSidebar, injectScenario, confirmDialog } from './helpers/utils.js';
import { SIMPLE_SCENARIO } from './helpers/fixtures.js';

test.describe('Custom Scenario - Editor', () => {

    test.beforeEach(async ({ page }) => {
        await clearAppState(page);
        await setFastTyping(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('opens editor modal for new scenario', async ({ page }) => {
        await openSidebar(page);
        await page.click('#btn-add-scenario');

        const editorModal = page.locator('#editor-modal');
        await expect(editorModal).not.toHaveAttribute('hidden', '');
        await expect(editorModal).toBeVisible();

        // Editor title should show "new chat" text
        const editorTitle = page.locator('#editor-title');
        await expect(editorTitle).toBeVisible();

        // Textarea should be empty for new scenario
        const textarea = page.locator('#editor-textarea');
        await expect(textarea).toHaveValue('');

        // Editor tabs should be visible (scenario + ai-chat)
        const editorTabs = page.locator('#editor-tabs');
        await expect(editorTabs).not.toHaveAttribute('hidden', '');
    });

    test('saves valid scenario and starts playback', async ({ page }) => {
        await openSidebar(page);
        await page.click('#btn-add-scenario');

        // Paste valid scenario into textarea
        const textarea = page.locator('#editor-textarea');
        await textarea.fill(SIMPLE_SCENARIO);

        // Click save
        await page.click('#editor-save');

        // Editor modal should close
        const editorModal = page.locator('#editor-modal');
        await expect(editorModal).toBeHidden();

        // Messages should start appearing (scenario playback begins)
        await waitForMessages(page, 1);

        const messages = page.locator('#messages .message');
        const count = await messages.count();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test('shows error for invalid scenario', async ({ page }) => {
        await openSidebar(page);
        await page.click('#btn-add-scenario');

        // Paste garbage into textarea
        const textarea = page.locator('#editor-textarea');
        await textarea.fill('this is not a valid scenario at all\nrandom garbage text');

        // Click save
        await page.click('#editor-save');

        // Error should be visible
        const editorError = page.locator('#editor-error');
        await expect(editorError).not.toHaveAttribute('hidden', '');
        await expect(editorError).toBeVisible();

        // Error should have some text content
        const errorText = await editorError.textContent();
        expect(errorText.length).toBeGreaterThan(0);

        // Editor modal should remain open
        const editorModal = page.locator('#editor-modal');
        await expect(editorModal).not.toHaveAttribute('hidden', '');
    });

    test('edits existing scenario', async ({ page }) => {
        // Inject a custom scenario
        await injectScenario(page, 'test-edit', 'Editable Scenario', SIMPLE_SCENARIO);
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Open sidebar and click edit on the custom scenario
        await openSidebar(page);

        // Find the edit button for our custom scenario (non-demo items have edit buttons)
        const editButton = page.locator('.sidebar__item-btn--edit').first();
        await editButton.click();

        // Editor modal should open
        const editorModal = page.locator('#editor-modal');
        await expect(editorModal).not.toHaveAttribute('hidden', '');

        // Editor tabs should have hidden attribute in edit mode
        // (Note: CSS display:flex may override hidden visually, so check the attribute)
        const editorTabs = page.locator('#editor-tabs');
        await expect(editorTabs).toHaveAttribute('hidden', '');

        // Textarea should contain the scenario source
        const textarea = page.locator('#editor-textarea');
        const value = await textarea.inputValue();
        expect(value.length).toBeGreaterThan(0);
        expect(value).toContain('dialog:');

        // Modify the source slightly and save
        await textarea.fill(SIMPLE_SCENARIO);
        await page.click('#editor-save');

        // Modal should close
        await expect(editorModal).toBeHidden();
    });

    test('editor tabs switch between scenario and AI chat', async ({ page }) => {
        await openSidebar(page);
        await page.click('#btn-add-scenario');

        // Initially scenario tab should be active
        const scenarioTab = page.locator('.editor-tabs__btn[data-tab="scenario"]');
        const aiChatTab = page.locator('.editor-tabs__btn[data-tab="ai-chat"]');

        await expect(scenarioTab).toHaveClass(/is-active/);
        await expect(aiChatTab).not.toHaveClass(/is-active/);

        // Scenario tab content should be visible
        const scenarioContent = page.locator('#editor-tab-scenario');
        const aiChatContent = page.locator('#editor-tab-ai-chat');

        await expect(scenarioContent).toHaveClass(/is-active/);
        await expect(aiChatContent).not.toHaveClass(/is-active/);

        // Click AI Chat tab
        await aiChatTab.click();

        await expect(aiChatTab).toHaveClass(/is-active/);
        await expect(scenarioTab).not.toHaveClass(/is-active/);

        await expect(aiChatContent).toHaveClass(/is-active/);
        await expect(scenarioContent).not.toHaveClass(/is-active/);

        // Switch back to scenario tab
        await scenarioTab.click();

        await expect(scenarioTab).toHaveClass(/is-active/);
        await expect(scenarioContent).toHaveClass(/is-active/);
        await expect(aiChatContent).not.toHaveClass(/is-active/);
    });

});
