// TODO: Mock Playwright objects for testing

export function createMockPage() {
  return {
    goto: async (url: string) => {},
    url: () => 'https://www.immobilienscout24.de/',
    title: async () => 'Test Page',
    content: async () => '<html></html>',
    $: async (selector: string) => null,
    $$: async (selector: string) => [],
    click: async (selector: string) => {},
    fill: async (selector: string, value: string) => {},
    type: async (selector: string, text: string) => {},
    waitForSelector: async (selector: string) => null,
    waitForTimeout: async (ms: number) => {},
    screenshot: async () => Buffer.from('mock-screenshot'),
    keyboard: {
      type: async (text: string, options?: { delay?: number }) => {},
    },
    mouse: {
      move: async (x: number, y: number) => {},
    },
    close: async () => {},
  };
}

export function createMockBrowserContext() {
  return {
    newPage: async () => createMockPage(),
    cookies: async () => [],
    addCookies: async (cookies: unknown[]) => {},
    close: async () => {},
  };
}

export function createMockBrowser() {
  return {
    newContext: async () => createMockBrowserContext(),
    close: async () => {},
  };
}
