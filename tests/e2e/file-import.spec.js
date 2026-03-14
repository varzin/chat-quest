import { test, expect } from '@playwright/test';
import path from 'path';
import {
  clearAppState,
  setFastTyping,
  waitForMessages,
  openSidebar,
} from './helpers/utils.js';
import {
  EDITOR_MODAL,
  EDITOR_FILE_INPUT,
  MESSAGES,
  MESSAGE_BUBBLE,
  SCENARIO_LIST,
  BTN_ADD_SCENARIO,
} from './helpers/selectors.js';

// Path to the real demo.ink file in the project
const DEMO_INK_PATH = path.resolve(import.meta.dirname, '../../scenarios/demo.ink');

test.describe('File Import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await clearAppState(page);
    await setFastTyping(page);
    await page.reload({ waitUntil: 'networkidle' });
  });

  test('imports .ink file via file input', async ({ page }) => {
    // Open editor modal (new chat)
    await openSidebar(page);
    await page.click(BTN_ADD_SCENARIO);

    const editorModal = page.locator(EDITOR_MODAL);
    await expect(editorModal).not.toHaveAttribute('hidden', '');

    // Use the hidden file input to load the demo.ink file
    await page.setInputFiles(EDITOR_FILE_INPUT, DEMO_INK_PATH);

    // Editor modal should close after file load
    await expect(editorModal).toBeHidden();

    // Scenario should start playing - messages should appear
    await waitForMessages(page, 1);

    const bubbles = page.locator(`${MESSAGES} ${MESSAGE_BUBBLE}`);
    const count = await bubbles.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('imported scenario appears in sidebar', async ({ page }) => {
    // Import the demo.ink file
    await openSidebar(page);
    await page.click(BTN_ADD_SCENARIO);
    await page.setInputFiles(EDITOR_FILE_INPUT, DEMO_INK_PATH);

    // Wait for the scenario to load
    await waitForMessages(page, 1);

    // Open sidebar and check for the scenario entry
    await openSidebar(page);

    const sidebarList = page.locator(SCENARIO_LIST);
    const items = sidebarList.locator('.sidebar__item');
    const count = await items.count();

    // There should be at least one item (the imported scenario)
    expect(count).toBeGreaterThanOrEqual(1);

    // The imported scenario title should be visible in one of the items
    const allTitles = await sidebarList
      .locator('.sidebar__item-title')
      .allInnerTexts();
    // demo.ink has title "Дух Древнего Леса"
    expect(allTitles.some((t) => t.includes('Дух Древнего Леса'))).toBe(true);
  });

  test('imported scenario is playable with messages and choices', async ({ page }) => {
    // Import the demo.ink file
    await openSidebar(page);
    await page.click(BTN_ADD_SCENARIO);
    await page.setInputFiles(EDITOR_FILE_INPUT, DEMO_INK_PATH);

    // Wait for multiple NPC messages from the start knot
    // The demo scenario starts with the spirit speaking several lines
    await waitForMessages(page, 2, { timeout: 15_000 });

    // Verify NPC messages appeared
    const bubbles = page.locator(`${MESSAGES} ${MESSAGE_BUBBLE}`);
    const texts = await bubbles.allInnerTexts();
    expect(texts.length).toBeGreaterThanOrEqual(2);

    // The first messages should contain text from the demo scenario start knot
    const allText = texts.join(' ');
    // The spirit says something about the forest / mortal
    expect(
      allText.includes('Смертный') ||
      allText.includes('лес') ||
      allText.includes('Туман'),
    ).toBe(true);
  });
});
