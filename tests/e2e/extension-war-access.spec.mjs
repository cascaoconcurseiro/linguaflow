import { expect, test } from './extension-fixture.mjs';

test('#555 YouTube bridge resources load on homepage and watch URL without unsafe attempts', async ({ extension }) => {
  const page = await extension.context.newPage();
  const unsafeResourceErrors = [];
  const bridgeLoads = [];
  const indexLoads = [];
  const failedExtensionResourceRequests = [];
  page.on('console', message => {
    const text = message.text();
    if (/Unsafe attempt to load URL chrome-extension:\/\//i.test(text)) {
      unsafeResourceErrors.push(message.text());
    }
    if (text.includes('Hook Superior Ativado')) bridgeLoads.push(text);
    if (text.includes('Inicializando Arquitetura Premium')) indexLoads.push(text);
  });
  page.on('requestfailed', request => {
    if (request.url().startsWith('chrome-extension://')) {
      failedExtensionResourceRequests.push(request.url());
    }
  });

  for (const url of ['https://www.youtube.com/', 'https://www.youtube.com/watch?v=lf-test']) {
    const previousLoads = bridgeLoads.length;
    const previousIndexLoads = indexLoads.length;
    await page.goto(url);
    await expect.poll(() => bridgeLoads.length).toBeGreaterThan(previousLoads);
    await expect.poll(() => indexLoads.length).toBeGreaterThan(previousIndexLoads);
    expect(unsafeResourceErrors).toEqual([]);
    expect(failedExtensionResourceRequests).toEqual([]);
  }
});
