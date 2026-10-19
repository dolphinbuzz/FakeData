// Vitest Global Setup - FakeData
// This file is run before all tests

import { vi } from 'vitest';

// ============================================
// Chrome APIs Mock
// ============================================

global.chrome = {
  runtime: {
    sendMessage: vi.fn((message, callback) => {
      if (callback) callback({});
    }),
    onMessage: {
      addListener: vi.fn(),
    },
    lastError: null,
    getURL: (path) => `chrome-extension://test/${path}`,
    id: 'test-extension-id',
  },
  storage: {
    local: {
      get: vi.fn((keys, callback) => {
        if (callback) callback({});
      }),
      set: vi.fn((items, callback) => {
        if (callback) callback();
      }),
    },
  },
  tabs: {
    query: vi.fn((queryInfo, callback) => {
      if (callback) {callback([
        { id: 1, url: 'https://example.com/page', active: true, title: 'Test Page' },
      ]);}
    }),
    sendMessage: vi.fn((tabId, message, callback) => {
      if (callback) callback({});
    }),
    onActivated: {
      addListener: vi.fn(),
    },
    create: vi.fn((createProperties, callback) => {
      if (callback) callback({ id: 2, url: createProperties.url });
    }),
  },
  scripting: {
    executeScript: vi.fn((injection, callback) => {
      if (callback) callback();
    }),
  },
  sidePanel: {
    open: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  },
  windows: {
    getCurrent: vi.fn((callback) => {
      if (callback) callback({ type: 'popup', id: 1 });
    }),
  },
};

// ============================================
// DOM / jsdom Extensions
// ============================================

// CSS.escape polyfill
Object.defineProperty(window, 'CSS', {
  value: {
    escape: (str) => String(str).replace(/([^\w-])/g, '\\$1'),
  },
  writable: true,
});

// Element methods - use defineProperty for read-only properties
Object.defineProperty(Element.prototype, 'matches', {
  value: vi.fn((_selector) => true),
  writable: true,
});
Object.defineProperty(Element.prototype, 'closest', {
  value: vi.fn((_selector) => null),
  writable: true,
});
Object.defineProperty(Element.prototype, 'querySelector', {
  value: vi.fn(() => null),
  writable: true,
});
Object.defineProperty(Element.prototype, 'querySelectorAll', {
  value: vi.fn(() => []),
  writable: true,
});
Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
  value: vi.fn(() => ({
    top: 0,
    left: 0,
    right: 100,
    bottom: 30,
    height: 30,
    width: 100,
    x: 0,
    y: 0,
  })),
  writable: true,
});
Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
});
Object.defineProperty(Element.prototype, 'dispatchEvent', {
  value: vi.fn(() => true),
  writable: true,
});
Object.defineProperty(Element.prototype, 'focus', {
  value: vi.fn(),
  writable: true,
});
Object.defineProperty(Element.prototype, 'blur', {
  value: vi.fn(),
  writable: true,
});
Object.defineProperty(Element.prototype, 'click', {
  value: vi.fn(),
  writable: true,
});
Object.defineProperty(Element.prototype, 'setAttribute', {
  value: vi.fn(),
  writable: true,
});
Object.defineProperty(Element.prototype, 'getAttribute', {
  value: vi.fn(() => null),
  writable: true,
});
Object.defineProperty(Element.prototype, 'removeAttribute', {
  value: vi.fn(),
  writable: true,
});
Object.defineProperty(Element.prototype, 'hasAttribute', {
  value: vi.fn(() => false),
  writable: true,
});
Object.defineProperty(Element.prototype, 'classList', {
  value: {
    add: vi.fn(),
    remove: vi.fn(),
    toggle: vi.fn(),
    contains: vi.fn(() => false),
    value: '',
    toString: () => '',
  },
  writable: true,
});

// HTMLElement specific
Object.defineProperty(HTMLElement.prototype, 'style', {
  value: {},
  writable: true,
});
Object.defineProperty(HTMLElement.prototype, 'dataset', {
  value: {},
  writable: true,
});
Object.defineProperty(HTMLElement.prototype, 'hidden', {
  value: false,
  writable: true,
});
Object.defineProperty(HTMLElement.prototype, 'innerText', {
  value: '',
  writable: true,
});
Object.defineProperty(HTMLElement.prototype, 'textContent', {
  value: '',
  writable: true,
});

// HTMLInputElement
Object.defineProperty(HTMLInputElement.prototype, 'value', {
  value: '',
  writable: true,
});
Object.defineProperty(HTMLInputElement.prototype, 'type', {
  value: 'text',
  writable: true,
});
Object.defineProperty(HTMLInputElement.prototype, 'checked', {
  value: false,
  writable: true,
});
Object.defineProperty(HTMLInputElement.prototype, 'disabled', {
  value: false,
  writable: true,
});
Object.defineProperty(HTMLInputElement.prototype, 'required', {
  value: false,
  writable: true,
});
Object.defineProperty(HTMLInputElement.prototype, 'placeholder', {
  value: '',
  writable: true,
});
Object.defineProperty(HTMLInputElement.prototype, 'name', {
  value: '',
  writable: true,
});
Object.defineProperty(HTMLInputElement.prototype, 'autocomplete', {
  value: '',
  writable: true,
});
Object.defineProperty(HTMLInputElement.prototype, 'labels', {
  value: [],
  writable: true,
});

// HTMLSelectElement
Object.defineProperty(HTMLSelectElement.prototype, 'value', {
  value: '',
  writable: true,
});
Object.defineProperty(HTMLSelectElement.prototype, 'options', {
  value: [],
  writable: true,
});
Object.defineProperty(HTMLSelectElement.prototype, 'selectedIndex', {
  value: -1,
  writable: true,
});
Object.defineProperty(HTMLSelectElement.prototype, 'multiple', {
  value: false,
  writable: true,
});
Object.defineProperty(HTMLSelectElement.prototype, 'disabled', {
  value: false,
  writable: true,
});
Object.defineProperty(HTMLSelectElement.prototype, 'required', {
  value: false,
  writable: true,
});
Object.defineProperty(HTMLSelectElement.prototype, 'name', {
  value: '',
  writable: true,
});

// HTMLTextAreaElement
Object.defineProperty(HTMLTextAreaElement.prototype, 'value', {
  value: '',
  writable: true,
});

// window.getComputedStyle
window.getComputedStyle = vi.fn(() => ({
  display: 'block',
  visibility: 'visible',
  outline: '',
  outlineOffset: '',
  getPropertyPriority: vi.fn(() => ''),
  setProperty: vi.fn(),
}));

// MutationObserver
global.MutationObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(() => []),
}));

// history API
window.history.pushState = vi.fn();
window.history.replaceState = vi.fn();
window.history.back = vi.fn();
window.history.forward = vi.fn();

// location
Object.defineProperty(window, 'location', {
  value: {
    href: 'https://example.com/page',
    origin: 'https://example.com',
    protocol: 'https:',
    host: 'example.com',
    hostname: 'example.com',
    pathname: '/page',
    search: '',
    hash: '',
    port: '',
  },
  writable: true,
});

// document
// document.documentElement and document.head are read-only in jsdom
document.body = document.body || document.createElement('body');
document.querySelector = vi.fn(() => null);
document.querySelectorAll = vi.fn(() => []);
document.getElementById = vi.fn(() => null);
document.createElement = vi.fn((tag) => {
  const el = document.createElement(tag);
  return el;
});
document.createTextNode = vi.fn((text) => document.createTextNode(text));

// Console (suppress in tests unless needed)
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// ============================================
// Test Utilities
// ============================================

// Helper to create mock field objects
global.createMockField = (overrides = {}) => ({
  key: 'test-selector::0',
  selector: '#test-selector',
  label: 'Test Field',
  inferredType: 'text',
  tagName: 'input',
  inputType: 'text',
  value: '',
  required: false,
  disabled: false,
  selectorRule: 'id',
  selectorStatus: 'stable',
  selectorSuggestion: '',
  locatorName: 'page-test-text',
  ...overrides,
});

// Helper to create mock generator context
global.createMockContext = (overrides = {}) => ({
  nome: 'João',
  sobrenome: 'Silva Santos',
  sexo: 'Masculino',
  mae: 'Maria Silva',
  pai: 'José Santos',
  cep: '01234-567',
  endereco: 'Rua das Flores',
  numero: '123',
  bairro: 'Centro',
  cidade: 'São Paulo',
  estado: { sigla: 'SP', nome: 'São Paulo', cidades: ['São Paulo'], ddds: ['11'] },
  ...overrides,
});

// Helper to create mock vehicle
global.createMockVehicle = (overrides = {}) => ({
  marca: 'Toyota',
  modelo: 'Corolla',
  estado: { sigla: 'SP', nome: 'São Paulo', cidades: ['São Paulo'], ddds: ['11'] },
  ...overrides,
});

// Helper to create mock profile
global.createMockProfile = (overrides = {}) => ({
  id: 'https://example.com/page::1234567890::abc123',
  name: 'Test Profile',
  pageUrl: 'https://example.com/page',
  fields: [],
  audit: [],
  ...overrides,
});

// Reset mocks between tests
beforeEach(() => {
  // Preserve chrome mock - save reference before clearing
  const savedChrome = global.chrome;
  vi.clearAllMocks();
  // Restore chrome mock
  global.chrome = savedChrome;
  // Reset DOM
  document.body.innerHTML = '';
  // document.head is read-only in jsdom, skip
  // Reset chrome.runtime.lastError
  if (chrome && chrome.runtime) {
    chrome.runtime.lastError = null;
  }
});

// Restore console after all tests
afterAll(() => {
  global.console = originalConsole;
});