import { expect, test } from './extension-fixture.mjs';

test('#555 local fonts decode and accessible captions work in consecutive page loads', async ({ extension }) => {
  const { context } = extension;
  const remoteFonts = [];
  context.on('request', request => {
    const hostname = new URL(request.url()).hostname;
    if (['fonts.googleapis.com', 'fonts.gstatic.com', 'fonts.cdnfonts.com'].includes(hostname)) remoteFonts.push(request.url());
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('https://www.youtube.com/watch?v=lf-test');
  await page.locator('#lf-yt-toggle-wrapper').click();
  await expect(page.locator('#lf-orig')).not.toBeEmpty({ timeout: 15000 });
  await page.locator('#lf-yt-btn').click();
  await page.locator('#sel-font-family').selectOption('OpenDyslexic');
  await expect(page.locator('#linguaflow-subtitle-host')).toHaveCSS('--lf-font-family', 'OpenDyslexic');
  const faces = await page.locator('#sel-font-family').evaluate(async select => {
    const css = select.getRootNode().querySelector('style').textContent;
    const urls = [...css.matchAll(/src: url\('([^']+)'\)/g)].map(match => match[1]);
    return Promise.all(urls.map(async (url, index) => {
      const font = new FontFace(`LFTest${index}`, `url("${url}")`);
      await font.load();
      return font.status;
    }));
  });
  expect(faces).toEqual(['loaded', 'loaded', 'loaded', 'loaded']);
  expect(remoteFonts).toEqual([]);
  await page.reload();
  await page.locator('#lf-yt-toggle-wrapper').click();
  await expect(page.locator('#lf-orig')).not.toBeEmpty({ timeout: 15000 });
  await page.locator('#lf-yt-btn').click();
  await page.locator('#sel-font-family').selectOption('OpenDyslexic');
  await expect(page.locator('#linguaflow-subtitle-host')).toHaveCSS('--lf-font-family', 'OpenDyslexic');
  expect(remoteFonts).toEqual([]);
  expect(errors).toEqual([]);
});
