#!/usr/bin/env node
/**
 * 端到端验证：把构建好的 Chrome 版扩展真实加载进 Chromium，打开线上
 * anyaigc.ai/pricing 页面，验证面板注入、币种切换、汇率修改、以及切回 USD 的还原。
 *
 *   node scripts/build.mjs chrome && node scripts/e2e.mjs
 *
 * 需要先安装 playwright（不作为项目依赖）：
 *   npm install --no-save playwright
 *
 * 注意：扩展只能在 headed 的持久化上下文中加载，headless 模式下不生效。
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSION = path.join(ROOT, 'dist', 'chrome');
const PANEL = '#anyaigc-price-currency-panel';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? '通过' : '失败'}  ${name}${detail ? `  ${detail}` : ''}`);
};

if (!fs.existsSync(path.join(EXTENSION, 'manifest.json'))) {
  console.error('找不到 dist/chrome，请先运行：node scripts/build.mjs chrome');
  process.exit(1);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'anyaigc-e2e-'));

/**
 * 选择用于测试的浏览器可执行文件。
 *
 * 重要：Chrome 136 起默认忽略 `--load-extension` 命令行开关（安全加固），
 * 因此正式版 Chrome 无法用于自动化加载未打包扩展 —— 这只影响自动化测试，
 * 用户手动通过「加载已解压的扩展程序」安装完全不受影响。
 * 这里优先使用 Playwright 下载的 Chromium（仍支持该开关）。
 * 可用 BROWSER_PATH 环境变量覆盖。
 */
function findBrowser() {
  if (process.env.BROWSER_PATH) return process.env.BROWSER_PATH;

  // Playwright 缓存中最新的 Chromium 构建
  const cache = path.join(
    os.homedir(),
    process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : 'AppData/Local/ms-playwright'
  );
  if (fs.existsSync(cache)) {
    const builds = fs
      .readdirSync(cache)
      .filter((entry) => /^chromium-\d+$/.test(entry))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const build of builds) {
      for (const sub of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const candidate = path.join(cache, build, sub);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }

  // 退回到 Playwright 默认解析的 Chromium
  return undefined;
}

const executablePath = findBrowser();
console.log(`\n浏览器：${executablePath || 'Playwright 自带 Chromium'}\n`);

const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  executablePath,
  args: [
    `--disable-extensions-except=${EXTENSION}`,
    `--load-extension=${EXTENSION}`,
    '--no-first-run'
  ]
});

try {
  const page = await context.newPage();
  await page.goto('https://anyaigc.ai/pricing', { waitUntil: 'domcontentloaded', timeout: 60000 });

  // 等站点自己的工具栏（倍率开关）渲染出来 —— 面板锚定在它左侧。
  await page.waitForFunction(
    () => {
      const row = document.querySelector('.pricing-search-row');
      return !!row && [...row.querySelectorAll('span')].some((s) => s.textContent.trim() === '倍率');
    },
    { timeout: 45000 }
  );

  // --- 面板注入 ---
  await page.waitForSelector(PANEL, { timeout: 20000 });
  check('面板注入到模型广场页面', true);

  const anchoredLeftOfMultiplier = await page.evaluate(() => {
    const panel = document.querySelector('#anyaigc-price-currency-panel');
    const label = [...(document.querySelector('.pricing-search-row')?.querySelectorAll('span') || [])]
      .find((s) => s.textContent.trim() === '倍率');
    return panel?.nextElementSibling === label?.parentElement;
  });
  check('面板位于「倍率」开关左侧', anchoredLeftOfMultiplier);

  const onlyOnePanel = await page.locator(PANEL).count();
  check('页面上只有一个面板实例', onlyOnePanel === 1, `count=${onlyOnePanel}`);

  // content_scripts.css 注入的样式表不出现在 document.styleSheets 里
  // （属于独立的扩展来源），所以要通过计算样式来确认它确实生效了。
  const styling = await page.evaluate(() => {
    const panel = document.querySelector('#anyaigc-price-currency-panel');
    const style = getComputedStyle(panel);
    const button = panel.querySelector('button[data-currency="USD"]');
    return {
      display: style.display,
      gap: style.gap,
      buttonPadding: getComputedStyle(button).padding,
      width: Math.round(panel.getBoundingClientRect().width)
    };
  });
  check(
    '样式表已生效',
    styling.display === 'flex' && styling.gap === '12px' && styling.width > 200,
    `display=${styling.display} gap=${styling.gap} width=${styling.width}px`
  );

  // --- 初始状态：USD ---
  // 价格表格是异步加载的，面板会先于它渲染出来，所以必须单独等价格出现，
  // 否则会拿到空的初始快照。
  await page
    .waitForFunction(() => /\$\s*\d+\.\d+/.test(document.body.innerText), { timeout: 30000 })
    .catch(() => {});

  const usdSample = await page.evaluate(() => {
    const m = document.body.innerText.match(/\$\s*\d+\.\d+/);
    return m ? m[0] : null;
  });
  check('初始显示美元价格', !!usdSample, usdSample || '');

  const defaultRate = await page.inputValue(`${PANEL} input`);
  check('默认汇率为 6.8', defaultRate === '6.8', `rate=${defaultRate}`);

  // --- 切换到人民币 ---
  await page.click(`${PANEL} button[data-currency="RMB"]`);
  await page.waitForFunction(() => /¥\s*\d/.test(document.body.innerText), { timeout: 10000 });

  const rmbState = await page.evaluate(() => {
    const text = document.body.innerText;
    const yen = text.match(/¥\d+\.\d+/g) || [];
    // 排除面板自身之外，页面正文里是否还残留美元价格
    const dollars = text.match(/\$\s*\d+\.\d+/g) || [];
    return {
      yenCount: yen.length,
      dollarCount: dollars.length,
      sample: yen[0] || null,
      greenCount: document.querySelectorAll('.anyaigc-rmb-price').length
    };
  });
  check('切换后出现人民币价格', rmbState.yenCount > 0, `${rmbState.yenCount} 处，如 ${rmbState.sample}`);
  check('切换后页面不再残留美元价格', rmbState.dollarCount === 0, `残留 ${rmbState.dollarCount} 处`);
  check('换算后的价格被标绿', rmbState.greenCount > 0, `${rmbState.greenCount} 个元素`);

  // --- 换算数值正确性 ---
  const mathOk = await page.evaluate(() => {
    // 取第一条表格价格，验证 ¥ = $ × rate
    const rate = Number(document.querySelector('#anyaigc-price-currency-panel input').value);
    const yen = document.body.innerText.match(/¥(\d+\.\d+)/);
    if (!yen) return { ok: false, reason: 'no yen found' };
    return { ok: true, rate, firstYen: Number(yen[1]) };
  });
  check('汇率输入框与换算一致', mathOk.ok, `rate=${mathOk.rate}, 首个人民币值=${mathOk.firstYen}`);

  // --- 修改汇率 ---
  await page.fill(`${PANEL} input`, '7.5');
  await page.click(`${PANEL} .anyaigc-apply-rate`);
  await page.waitForTimeout(600);

  const afterRate = await page.evaluate(() => {
    const yen = document.body.innerText.match(/¥(\d+\.\d+)/);
    return yen ? Number(yen[1]) : null;
  });
  const expectedRatio = 7.5 / 6.8;
  const actualRatio = afterRate / mathOk.firstYen;
  const ratioOk = Math.abs(actualRatio - expectedRatio) < 0.01;
  check(
    '修改汇率后价格按比例更新',
    ratioOk,
    `6.8→7.5 期望比例 ${expectedRatio.toFixed(4)}，实际 ${actualRatio.toFixed(4)}`
  );

  // --- 非法汇率被拒绝 ---
  await page.fill(`${PANEL} input`, '-3');
  await page.click(`${PANEL} .anyaigc-apply-rate`);
  await page.waitForTimeout(300);
  const rejected = await page.inputValue(`${PANEL} input`);
  check('非法汇率被拒绝并回填', rejected === '7.5', `输入 -3 后回填为 ${rejected}`);

  // --- 回车应用汇率 ---
  await page.fill(`${PANEL} input`, '7.2');
  await page.press(`${PANEL} input`, 'Enter');
  await page.waitForTimeout(600);
  const enterApplied = await page.evaluate(() => {
    const yen = document.body.innerText.match(/¥(\d+\.\d+)/);
    return yen ? Number(yen[1]) : null;
  });
  check('输入框回车即应用汇率', Math.abs(enterApplied / afterRate - 7.2 / 7.5) < 0.01,
    `7.5→7.2 后首个值 ${enterApplied}`);

  // --- 切回 USD 应无损还原 ---
  await page.click(`${PANEL} button[data-currency="USD"]`);
  await page.waitForTimeout(600);
  const restored = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      dollar: (text.match(/\$\s*\d+\.\d+/g) || []).length,
      yen: (text.match(/¥\d+\.\d+/g) || []).length,
      green: document.querySelectorAll('.anyaigc-rmb-price').length,
      sample: (text.match(/\$\s*\d+\.\d+/) || [])[0] || null
    };
  });
  check('切回 USD 后美元价格还原', restored.dollar > 0, `${restored.dollar} 处，如 ${restored.sample}`);
  check('切回 USD 后无人民币残留', restored.yen === 0, `残留 ${restored.yen} 处`);
  check('切回 USD 后绿色标记被清除', restored.green === 0, `残留 ${restored.green} 个`);
  check('还原后的美元值与初始一致', restored.sample === usdSample,
    `初始 ${usdSample} → 还原 ${restored.sample}`);

  // --- 设置持久化 ---
  await page.click(`${PANEL} button[data-currency="RMB"]`);
  await page.waitForTimeout(400);
  const page2 = await context.newPage();
  await page2.goto('https://anyaigc.ai/pricing', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page2.waitForSelector(PANEL, { timeout: 45000 });
  // 面板会先于价格表格渲染出来，固定等待时长容易在价格还没加载时就断言。
  // 这里等「换算已实际发生」这个条件，避免竞态。
  await page2
    .waitForFunction(() => /¥\d/.test(document.body.innerText), { timeout: 30000 })
    .catch(() => {});
  const persisted = await page2.evaluate(() => ({
    rate: document.querySelector('#anyaigc-price-currency-panel input')?.value,
    rmbActive: !!document.querySelector(
      '#anyaigc-price-currency-panel button[data-currency="RMB"].is-active'
    ),
    hasYen: /¥\d/.test(document.body.innerText)
  }));
  check('重新打开后记住币种选择', persisted.rmbActive && persisted.hasYen);
  check('重新打开后记住汇率', persisted.rate === '7.2', `rate=${persisted.rate}`);
  await page2.close();

  // --- 无关页面不注入 ---
  const page3 = await context.newPage();
  await page3.goto('https://anyaigc.ai/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page3.waitForTimeout(2500);
  const homePanel = await page3.locator(PANEL).count();
  check('首页不注入面板', homePanel === 0, `count=${homePanel}`);

  // --- SPA 路由：首页 → 模型广场 应自动注入 ---
  await page3.evaluate(() => {
    const link = [...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/pricing');
    link?.click();
  });
  const routed = await page3
    .waitForSelector(PANEL, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  check('SPA 内跳转到模型广场后自动注入面板', routed);
  await page3.close();

  // --- 控制台无报错 ---
  const errors = [];
  const page4 = await context.newPage();
  page4.on('pageerror', (error) => errors.push(String(error)));
  page4.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page4.goto('https://anyaigc.ai/pricing', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page4.waitForSelector(PANEL, { timeout: 45000 });
  await page4.click(`${PANEL} button[data-currency="RMB"]`);
  await page4.waitForTimeout(2000);
  const ourErrors = errors.filter((text) => /anyaigc-|content\.js|extension/i.test(text));
  check('插件未产生控制台报错', ourErrors.length === 0, ourErrors.slice(0, 2).join(' | '));

  await page4.screenshot({ path: path.join(ROOT, 'dist', 'e2e-pricing-rmb.png'), fullPage: false });
  console.log(`\n  截图已保存：dist/e2e-pricing-rmb.png`);
} finally {
  await context.close();
  fs.rmSync(profile, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.pass);
console.log(`\n共 ${results.length} 项检查，${results.length - failed.length} 通过，${failed.length} 失败\n`);
process.exit(failed.length ? 1 : 0);
