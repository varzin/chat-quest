import { test, expect } from '@playwright/test';
import { clearAppState, setFastTyping, waitForMessages, openSidebar, closeSidebar, injectScenario, confirmDialog } from './helpers/utils.js';
import { SIMPLE_SCENARIO, BRANCHING_SCENARIO } from './helpers/fixtures.js';

test.describe('Sidebar', () => {

    test.beforeEach(async ({ page }) => {
        await clearAppState(page);
        await setFastTyping(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('opens and closes sidebar', async ({ page }) => {
        const sidebar = page.locator('#sidebar');
        const overlay = page.locator('#sidebar-overlay');

        // Sidebar should be closed initially
        await expect(sidebar).not.toHaveClass(/is-open/);
        await expect(overlay).not.toHaveClass(/is-visible/);

        // Click menu button to open
        await page.click('#btn-menu');

        await expect(sidebar).toHaveClass(/is-open/);
        await expect(overlay).toHaveClass(/is-visible/);

        // Click overlay to close
        await page.click('#sidebar-overlay', { force: true });

        await expect(sidebar).not.toHaveClass(/is-open/);
        await expect(overlay).not.toHaveClass(/is-visible/);

        // Open again and close via close button
        await page.click('#btn-menu');
        await expect(sidebar).toHaveClass(/is-open/);

        await page.click('#sidebar-close');
        await expect(sidebar).not.toHaveClass(/is-open/);
    });

    test('lists all scenarios', async ({ page }) => {
        // Inject 2 custom scenarios
        await injectScenario(page, 'custom-1', 'Custom Scenario One', SIMPLE_SCENARIO);
        await injectScenario(page, 'custom-2', 'Custom Scenario Two', BRANCHING_SCENARIO);
        await page.reload();
        await page.waitForLoadState('networkidle');

        await openSidebar(page);

        // Should have 3 items: 1 demo + 2 custom
        const items = page.locator('#scenario-list .sidebar__item');
        await expect(items).toHaveCount(3);

        // Check that our custom scenario titles appear
        const allTitles = await page.locator('#scenario-list .sidebar__item-title').allTextContents();
        expect(allTitles).toContain('Custom Scenario One');
        expect(allTitles).toContain('Custom Scenario Two');
    });

    test('switches between scenarios', async ({ page }) => {
        // Inject a custom scenario
        await injectScenario(page, 'switch-test', 'Switch Test Scenario', SIMPLE_SCENARIO);
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Get initial chat title
        const chatTitle = page.locator('#chat-title');
        const initialTitle = await chatTitle.textContent();

        // Open sidebar and click the other scenario
        await openSidebar(page);

        // Find and click a scenario item that is different from current
        const items = page.locator('#scenario-list .sidebar__item');
        const count = await items.count();

        // Click the item that is NOT active
        for (let i = 0; i < count; i++) {
            const item = items.nth(i);
            const hasActive = await item.evaluate(el => el.classList.contains('is-active'));
            if (!hasActive) {
                await item.click();
                break;
            }
        }

        // Sidebar should close after selection
        const sidebar = page.locator('#sidebar');
        await expect(sidebar).not.toHaveClass(/is-open/);

        // Chat title should change
        const newTitle = await chatTitle.textContent();
        expect(newTitle).not.toBe(initialTitle);
    });

    test('deletes scenario with confirmation', async ({ page }) => {
        // Inject a custom scenario
        await injectScenario(page, 'delete-me', 'Delete Me Scenario', SIMPLE_SCENARIO);
        await page.reload();
        await page.waitForLoadState('networkidle');

        await openSidebar(page);

        // Count items before deletion
        const itemsBefore = await page.locator('#scenario-list .sidebar__item').count();

        // Find the delete button for a custom scenario (non-demo)
        const deleteButton = page.locator('.sidebar__item-btn--delete').first();
        await deleteButton.click();

        // Confirm dialog should appear
        await confirmDialog(page);

        // Item should be removed from the list
        const itemsAfter = await page.locator('#scenario-list .sidebar__item').count();
        expect(itemsAfter).toBe(itemsBefore - 1);

        // The deleted scenario title should not appear
        const allTitles = await page.locator('#scenario-list .sidebar__item-title').allTextContents();
        expect(allTitles).not.toContain('Delete Me Scenario');
    });

    test('AI chats listed alongside scenarios', async ({ page }) => {
        // Inject AI chat data into localStorage
        await page.evaluate(() => {
            const chatId = 'test-ai-chat-1';
            const chatData = {
                title: 'AI Chat with Bot',
                characterId: 'char-1',
                characterName: 'TestBot',
                provider: 'openai',
                model: 'gpt-4o-mini',
                messages: []
            };
            localStorage.setItem(`aichat_${chatId}`, JSON.stringify(chatData));

            const chatList = [{
                id: chatId,
                characterName: 'TestBot',
                characterId: 'char-1',
                provider: 'openai',
                model: 'gpt-4o-mini'
            }];
            localStorage.setItem('chatquest_ai_chats', JSON.stringify(chatList));
        });

        await page.reload();
        await page.waitForLoadState('networkidle');

        await openSidebar(page);

        // Should have at least 2 items: 1 demo scenario + 1 AI chat
        const items = page.locator('#scenario-list .sidebar__item');
        const count = await items.count();
        expect(count).toBeGreaterThanOrEqual(2);

        // The AI chat title should appear in the list
        const allTitles = await page.locator('#scenario-list .sidebar__item-title').allTextContents();
        const hasAiChat = allTitles.some(t => t.includes('AI Chat with Bot') || t.includes('TestBot'));
        expect(hasAiChat).toBe(true);
    });

    test('active item is highlighted', async ({ page }) => {
        // Inject a custom scenario
        await injectScenario(page, 'active-test', 'Active Test', SIMPLE_SCENARIO);
        await page.reload();
        await page.waitForLoadState('networkidle');

        await openSidebar(page);

        // Exactly one item should have is-active class
        const activeItems = page.locator('#scenario-list .sidebar__item.is-active');
        await expect(activeItems).toHaveCount(1);

        // Click a different (non-active) scenario to switch
        const items = page.locator('#scenario-list .sidebar__item');
        const count = await items.count();

        for (let i = 0; i < count; i++) {
            const item = items.nth(i);
            const hasActive = await item.evaluate(el => el.classList.contains('is-active'));
            if (!hasActive) {
                await item.click();
                break;
            }
        }

        // Re-open sidebar to check active state updated
        await openSidebar(page);

        // Still exactly one active item
        const updatedActiveItems = page.locator('#scenario-list .sidebar__item.is-active');
        await expect(updatedActiveItems).toHaveCount(1);
    });

});
