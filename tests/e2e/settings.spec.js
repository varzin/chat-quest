import { test, expect } from '@playwright/test';
import { clearAppState, setFastTyping, openSidebar, closeSidebar, confirmDialog } from './helpers/utils.js';

test.describe('Settings', () => {

    test.beforeEach(async ({ page }) => {
        await clearAppState(page);
        await setFastTyping(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('opens settings from sidebar', async ({ page }) => {
        await openSidebar(page);
        await page.click('#btn-settings');

        // Settings modal should be visible
        const settingsModal = page.locator('#settings-modal');
        await expect(settingsModal).not.toHaveAttribute('hidden', '');
        await expect(settingsModal).toBeVisible();

        // Sidebar should close when settings opens
        const sidebar = page.locator('#sidebar');
        await expect(sidebar).not.toHaveClass(/is-open/);

        // Settings title should be visible
        const title = settingsModal.locator('.modal__title');
        await expect(title).toBeVisible();
    });

    test('changes theme to low-contrast', async ({ page }) => {
        await openSidebar(page);
        await page.click('#btn-settings');

        // Click low-contrast theme radio
        await page.click('label[for="theme-low-contrast"]');

        // Body (actually <html>) should have data-theme="low-contrast"
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'low-contrast');

        // Verify localStorage was updated
        const settings = await page.evaluate(() => {
            const raw = localStorage.getItem('chatquest_settings');
            return raw ? JSON.parse(raw) : null;
        });
        expect(settings).not.toBeNull();
        expect(settings.theme).toBe('low-contrast');

        // Switch back to default theme
        await page.click('label[for="theme-default"]');
        await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    });

    test('changes language to English', async ({ page }) => {
        await openSidebar(page);
        await page.click('#btn-settings');

        // Change language to English
        await page.selectOption('#settings-language', 'en');

        // data-i18n elements should now show English text
        // Check the settings title which has data-i18n="settings"
        const settingsTitle = page.locator('#settings-modal .modal__title[data-i18n="settings"]');
        await expect(settingsTitle).toHaveText('Settings');

        // Check another known element - the theme label
        const themeLabel = page.locator('[data-i18n="theme"]');
        await expect(themeLabel).toHaveText('Theme');

        // Check language label
        const languageLabel = page.locator('[data-i18n="language"]');
        await expect(languageLabel).toHaveText('Language');

        // Verify localStorage was updated
        const settings = await page.evaluate(() => {
            const raw = localStorage.getItem('chatquest_settings');
            return raw ? JSON.parse(raw) : null;
        });
        expect(settings.language).toBe('en');
    });

    test('changes typing speed via slider', async ({ page }) => {
        await openSidebar(page);
        await page.click('#btn-settings');

        // Set typing min slider to a new value via JavaScript (sliders are hard to drag in tests)
        await page.evaluate(() => {
            const slider = document.getElementById('settings-typing-min');
            slider.value = 800;
            slider.dispatchEvent(new Event('input', { bubbles: true }));
        });

        // Verify localStorage reflects the change
        const settings = await page.evaluate(() => {
            const raw = localStorage.getItem('chatquest_settings');
            return raw ? JSON.parse(raw) : null;
        });
        expect(settings).not.toBeNull();
        expect(settings.typingMinDelay).toBe(800);

        // Verify the value display was updated
        const displayValue = await page.locator('#typing-min-value').textContent();
        expect(displayValue).toBe('800');
    });

    test('clear data removes all scenarios', async ({ page }) => {
        // First verify there's data in localStorage (at least the demo scenario)
        const beforeScenarios = await page.evaluate(() => {
            const raw = localStorage.getItem('chatquest_scenarios');
            return raw ? JSON.parse(raw) : [];
        });
        expect(beforeScenarios.length).toBeGreaterThan(0);

        // Open settings and click clear data
        await openSidebar(page);
        await page.click('#btn-settings');
        await page.click('#btn-clear-data');

        // Confirm the dialog
        await confirmDialog(page);

        // Page should reload after clearing data, wait for it
        await page.waitForLoadState('networkidle');

        // After reload + re-init, the app will re-create the demo scenario,
        // but all custom data should be gone. Check that settings were reset.
        const afterSettings = await page.evaluate(() => {
            // Settings key should have been removed before reload,
            // but after reload the app re-initializes with defaults.
            // Check that any custom scenarios beyond demo are gone.
            const raw = localStorage.getItem('chatquest_scenarios');
            return raw ? JSON.parse(raw) : [];
        });

        // Only the demo scenario should exist (re-created on load)
        const customScenarios = afterSettings.filter(s => !s.isDemo);
        expect(customScenarios.length).toBe(0);
    });

    test('settings tabs switch correctly', async ({ page }) => {
        await openSidebar(page);
        await page.click('#btn-settings');

        // Initially General tab should be active
        const generalTab = page.locator('.settings-tabs__btn[data-tab="general"]');
        const apiKeysTab = page.locator('.settings-tabs__btn[data-tab="api-keys"]');
        const charactersTab = page.locator('.settings-tabs__btn[data-tab="characters"]');

        await expect(generalTab).toHaveClass(/is-active/);
        await expect(apiKeysTab).not.toHaveClass(/is-active/);
        await expect(charactersTab).not.toHaveClass(/is-active/);

        // General content visible, others hidden
        const generalContent = page.locator('#settings-tab-general');
        const apiKeysContent = page.locator('#settings-tab-api-keys');
        const charactersContent = page.locator('#settings-tab-characters');

        await expect(generalContent).toHaveClass(/is-active/);
        await expect(apiKeysContent).not.toHaveClass(/is-active/);
        await expect(charactersContent).not.toHaveClass(/is-active/);

        // Switch to API Keys tab
        await apiKeysTab.click();

        await expect(apiKeysTab).toHaveClass(/is-active/);
        await expect(generalTab).not.toHaveClass(/is-active/);
        await expect(apiKeysContent).toHaveClass(/is-active/);
        await expect(generalContent).not.toHaveClass(/is-active/);

        // Switch to Characters tab
        await charactersTab.click();

        await expect(charactersTab).toHaveClass(/is-active/);
        await expect(apiKeysTab).not.toHaveClass(/is-active/);
        await expect(charactersContent).toHaveClass(/is-active/);
        await expect(apiKeysContent).not.toHaveClass(/is-active/);

        // Switch back to General tab
        await generalTab.click();

        await expect(generalTab).toHaveClass(/is-active/);
        await expect(generalContent).toHaveClass(/is-active/);
        await expect(charactersContent).not.toHaveClass(/is-active/);
    });

});
