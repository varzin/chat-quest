/**
 * Reusable E2E test helpers
 */

import {
  MESSAGES,
  MESSAGE_BUBBLE,
  CHOICES_CONTENT,
  CHOICE_BTN,
  TYPING_INDICATOR,
  BTN_MENU,
  SIDEBAR,
  SIDEBAR_CLOSE,
  SIDEBAR_OVERLAY,
  CONFIRM_OK,
} from './selectors.js';

/**
 * Clear all localStorage data and reload the page.
 * @param {import('@playwright/test').Page} page
 */
export async function clearAppState(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
}

/**
 * Set typing delays to 10ms for fast tests via localStorage.
 * Must be called BEFORE page reload / navigation so the app picks up the values.
 * @param {import('@playwright/test').Page} page
 */
export async function setFastTyping(page) {
  await page.evaluate(() => {
    const key = 'chatquest_settings';
    const raw = localStorage.getItem(key);
    const settings = raw ? JSON.parse(raw) : {};
    settings.typingMinDelay = 10;
    settings.typingMaxDelay = 10;
    localStorage.setItem(key, JSON.stringify(settings));
  });
}

/**
 * Wait until at least `count` messages appear in the chat.
 * @param {import('@playwright/test').Page} page
 * @param {number} count
 * @param {{ timeout?: number }} [options]
 */
export async function waitForMessages(page, count, options = {}) {
  const timeout = options.timeout ?? 10_000;
  await page.waitForFunction(
    ({ selector, n }) => document.querySelectorAll(selector).length >= n,
    { selector: `${MESSAGES} ${MESSAGE_BUBBLE}`, n: count },
    { timeout },
  );
}

/**
 * Wait until at least one choice button is visible.
 * @param {import('@playwright/test').Page} page
 * @param {{ timeout?: number }} [options]
 */
export async function waitForChoices(page, options = {}) {
  const timeout = options.timeout ?? 10_000;
  await page.locator(CHOICE_BTN).first().waitFor({ state: 'visible', timeout });
}

/**
 * Wait until the typing indicator is hidden / removed.
 * @param {import('@playwright/test').Page} page
 * @param {{ timeout?: number }} [options]
 */
export async function waitForTypingDone(page, options = {}) {
  const timeout = options.timeout ?? 10_000;
  // The typing indicator may not exist yet or may already be hidden.
  // We wait for it to be detached or hidden.
  const indicator = page.locator(TYPING_INDICATOR);
  try {
    await indicator.waitFor({ state: 'hidden', timeout });
  } catch {
    // Already hidden or never appeared — that's fine.
  }
}

/**
 * Click the choice button at the given 0-based index.
 * @param {import('@playwright/test').Page} page
 * @param {number} index
 */
export async function selectChoice(page, index) {
  const buttons = page.locator(CHOICE_BTN);
  await buttons.nth(index).click();
}

/**
 * Return an array of trimmed text contents from all message bubbles.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
export async function getMessageTexts(page) {
  return page.locator(`${MESSAGES} ${MESSAGE_BUBBLE}`).allInnerTexts();
}

/**
 * Open the sidebar by clicking the menu button.
 * @param {import('@playwright/test').Page} page
 */
export async function openSidebar(page) {
  await page.locator(BTN_MENU).click();
  await page.locator(SIDEBAR).waitFor({ state: 'visible' });
}

/**
 * Close the sidebar.
 * @param {import('@playwright/test').Page} page
 */
export async function closeSidebar(page) {
  // Try clicking the close button first; fall back to overlay.
  const closeBtn = page.locator(SIDEBAR_CLOSE);
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
  } else {
    await page.locator(SIDEBAR_OVERLAY).click();
  }
  await page.locator(SIDEBAR).waitFor({ state: 'hidden' });
}

/**
 * Inject a scenario into localStorage so the app can load it.
 * Call this BEFORE navigating / reloading so the app picks it up.
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 * @param {string} title
 * @param {string} source - Full YAML+Ink text
 */
export async function injectScenario(page, id, title, source) {
  await page.evaluate(
    ({ id, title, source }) => {
      // Save scenario source
      localStorage.setItem(`scenario_${id}`, JSON.stringify(source));

      // Update scenario list
      const listKey = 'chatquest_scenarios';
      const raw = localStorage.getItem(listKey);
      const list = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex((s) => s.id === id);
      const meta = { id, title, isDemo: false };
      if (idx >= 0) {
        list[idx] = meta;
      } else {
        list.push(meta);
      }
      localStorage.setItem(listKey, JSON.stringify(list));

      // Set as current
      localStorage.setItem(
        'chatquest_current',
        JSON.stringify({ type: 'scenario', id }),
      );
    },
    { id, title, source },
  );
}

/**
 * Click the confirm (OK) button in the confirm modal.
 * @param {import('@playwright/test').Page} page
 */
export async function confirmDialog(page) {
  await page.locator(CONFIRM_OK).waitFor({ state: 'visible', timeout: 3_000 });
  await page.locator(CONFIRM_OK).click();
}
