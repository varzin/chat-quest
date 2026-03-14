import { test, expect } from '@playwright/test';
import {
  clearAppState,
  setFastTyping,
  waitForMessages,
  openSidebar,
} from './helpers/utils.js';
import {
  EDITOR_MODAL,
  AI_CHAT_NO_KEYS,
  AI_CHAT_NO_CHARS,
  AI_CHAT_SETUP,
  AI_CHAT_CHARACTER,
  AI_CHAT_MODEL,
  AI_CHAT_START,
  AI_CHAT_TITLE_INPUT,
  CHAT_INPUT,
  CHAT_INPUT_FIELD,
  BTN_SEND,
  MESSAGES,
  MESSAGE_BUBBLE,
  BTN_ADD_SCENARIO,
} from './helpers/selectors.js';

// -------------------------------------------------------
// Helpers specific to AI chat tests
// -------------------------------------------------------

/**
 * Inject an OpenAI API key into localStorage.
 */
async function injectApiKey(page, provider = 'openai', key = 'sk-test-key-1234') {
  await page.evaluate(
    ({ provider, key }) => {
      const storageKey = 'chatquest_api_keys';
      const raw = localStorage.getItem(storageKey);
      const keys = raw ? JSON.parse(raw) : { openai: null, grok: null };
      keys[provider] = key;
      localStorage.setItem(storageKey, JSON.stringify(keys));
    },
    { provider, key },
  );
}

/**
 * Inject a test character into localStorage.
 */
async function injectCharacter(page, char) {
  const defaultChar = {
    id: 'test-char-1',
    name: 'Test Bot',
    prompt: 'You are a helpful test bot.',
    ...char,
  };
  await page.evaluate(
    (c) => {
      const storageKey = 'chatquest_characters';
      const raw = localStorage.getItem(storageKey);
      const list = raw ? JSON.parse(raw) : [];
      list.push(c);
      localStorage.setItem(storageKey, JSON.stringify(list));
    },
    defaultChar,
  );
}

/**
 * Open the editor modal and switch to the AI Chat tab.
 */
async function openAiChatTab(page) {
  await openSidebar(page);
  await page.click(BTN_ADD_SCENARIO);

  const modal = page.locator(EDITOR_MODAL);
  await expect(modal).not.toHaveAttribute('hidden', '');

  // Click the AI Chat tab button
  await page.click('.editor-tabs__btn[data-tab="ai-chat"]');
}

/**
 * Create an AI chat through the UI (assumes API key + character already injected).
 * Opens editor -> AI tab -> selects character & model -> clicks Start.
 */
async function createAiChatViaUI(page) {
  await openAiChatTab(page);

  // Setup form should be visible
  await expect(page.locator(AI_CHAT_SETUP)).not.toHaveAttribute('hidden', '');

  // Character select should have at least one option
  await expect(page.locator(`${AI_CHAT_CHARACTER} option`).first()).toBeAttached();

  // Model select should have at least one option
  await expect(page.locator(`${AI_CHAT_MODEL} option`).first()).toBeAttached();

  // Click start
  await page.click(AI_CHAT_START);

  // Editor modal should close
  await expect(page.locator(EDITOR_MODAL)).toBeHidden();

  // Chat input bar should be visible
  await expect(page.locator(CHAT_INPUT)).not.toHaveAttribute('hidden', '');
}

/**
 * Mock the chat completions API with a successful response.
 */
async function mockApiSuccess(page, responseText = 'Hello from the AI!') {
  await page.route('**/v1/chat/completions', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { content: responseText } }],
      }),
    });
  });
}

/**
 * Mock the chat completions API with a 401 error.
 */
async function mockApiError401(page) {
  await page.route('**/v1/chat/completions', (route) => {
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Invalid API key' } }),
    });
  });
}

/**
 * Send a message in the AI chat input bar.
 */
async function sendMessage(page, text) {
  const input = page.locator(CHAT_INPUT_FIELD);
  await input.fill(text);
  await page.click(BTN_SEND);
}

// -------------------------------------------------------
// Tests
// -------------------------------------------------------

test.describe('AI Chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await clearAppState(page);
    await setFastTyping(page);
    await page.reload({ waitUntil: 'networkidle' });
  });

  test('shows "no API keys" state when no keys are configured', async ({ page }) => {
    await openAiChatTab(page);

    // The "no keys" empty state should be visible
    const noKeysEl = page.locator(AI_CHAT_NO_KEYS);
    await expect(noKeysEl).not.toHaveAttribute('hidden', '');
    await expect(noKeysEl).toBeVisible();

    // The setup form should be hidden
    await expect(page.locator(AI_CHAT_SETUP)).toBeHidden();
  });

  test('shows "no characters" state when API key exists but no characters', async ({ page }) => {
    // Inject only API key, no characters
    await injectApiKey(page);
    await page.reload({ waitUntil: 'networkidle' });

    await openAiChatTab(page);

    // The "no characters" empty state should be visible
    const noCharsEl = page.locator(AI_CHAT_NO_CHARS);
    await expect(noCharsEl).not.toHaveAttribute('hidden', '');
    await expect(noCharsEl).toBeVisible();

    // The "no keys" state should be hidden (keys exist)
    await expect(page.locator(AI_CHAT_NO_KEYS)).toBeHidden();

    // The setup form should be hidden
    await expect(page.locator(AI_CHAT_SETUP)).toBeHidden();
  });

  test('creates AI chat with character and model selection', async ({ page }) => {
    // Inject API key and character
    await injectApiKey(page);
    await injectCharacter(page);
    await page.reload({ waitUntil: 'networkidle' });

    await createAiChatViaUI(page);

    // Chat input field should be usable
    const inputField = page.locator(CHAT_INPUT_FIELD);
    await expect(inputField).toBeVisible();
    await expect(inputField).toBeEnabled();
  });

  test('sends message and receives mocked API response', async ({ page }) => {
    const mockResponse = 'I am a mocked AI response!';

    // Inject API key and character
    await injectApiKey(page);
    await injectCharacter(page);
    await page.reload({ waitUntil: 'networkidle' });

    // Mock the API before creating the chat
    await mockApiSuccess(page, mockResponse);

    await createAiChatViaUI(page);

    // Send a message
    await sendMessage(page, 'Hello AI');

    // Wait for at least 2 messages (player + NPC response)
    await waitForMessages(page, 2);

    // Get all message bubble texts
    const bubbles = page.locator(`${MESSAGES} ${MESSAGE_BUBBLE}`);
    const texts = await bubbles.allInnerTexts();

    // Player message should be present
    expect(texts.some((t) => t.includes('Hello AI'))).toBe(true);

    // Mocked NPC response should be present
    expect(texts.some((t) => t.includes(mockResponse))).toBe(true);
  });

  test('shows error message on API failure (401)', async ({ page }) => {
    // Inject API key and character
    await injectApiKey(page);
    await injectCharacter(page);
    await page.reload({ waitUntil: 'networkidle' });

    // Mock 401 error
    await mockApiError401(page);

    await createAiChatViaUI(page);

    // Send a message
    await sendMessage(page, 'Test error handling');

    // Wait for at least 2 messages (player + error)
    await waitForMessages(page, 2);

    // Check that an error message appeared
    const bubbles = page.locator(`${MESSAGES} ${MESSAGE_BUBBLE}`);
    const texts = await bubbles.allInnerTexts();

    // There should be an error message containing "Error"
    expect(texts.some((t) => t.includes('Error'))).toBe(true);
    expect(texts.some((t) => t.includes('Invalid API key'))).toBe(true);
  });

  test('persists AI chat messages after page reload', async ({ page }) => {
    const mockResponse = 'Persisted response from AI';

    // Inject API key and character
    await injectApiKey(page);
    await injectCharacter(page);
    await page.reload({ waitUntil: 'networkidle' });

    // Mock API
    await mockApiSuccess(page, mockResponse);

    await createAiChatViaUI(page);

    // Send a message and wait for response
    await sendMessage(page, 'Remember this');
    await waitForMessages(page, 2);

    // Verify messages are there before reload
    let texts = await page.locator(`${MESSAGES} ${MESSAGE_BUBBLE}`).allInnerTexts();
    expect(texts.some((t) => t.includes('Remember this'))).toBe(true);
    expect(texts.some((t) => t.includes(mockResponse))).toBe(true);

    // Reload the page (API key and character still in localStorage)
    await page.reload({ waitUntil: 'networkidle' });

    // Messages should be restored from localStorage
    await waitForMessages(page, 2);

    texts = await page.locator(`${MESSAGES} ${MESSAGE_BUBBLE}`).allInnerTexts();
    expect(texts.some((t) => t.includes('Remember this'))).toBe(true);
    expect(texts.some((t) => t.includes(mockResponse))).toBe(true);
  });
});
