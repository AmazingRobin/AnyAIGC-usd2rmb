/**
 * AnyAIGC 美元/人民币价格换算
 *
 * 在 anyaigc.ai 的「模型广场」(/pricing) 和「使用日志」(/console/log) 页面注入一个
 * 币种切换面板，把页面上的美元价格按用户设定的汇率换算成人民币。
 *
 * 换算是纯前端的文本替换：原始的美元文本被保存在 WeakMap 里，切回 USD 时逐字还原，
 * 不会修改任何请求或页面数据。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 浏览器 API 兼容层
  //
  // Chrome/Edge/Opera/Brave 暴露 `chrome`，Firefox 暴露 `browser`（同时也提供
  // `chrome` 作为别名，但其 storage API 是 Promise 版本）。这里统一取到一个对象，
  // 并把 storage 调用包装成 Promise，屏蔽两套 API 的差异。
  // ---------------------------------------------------------------------------
  const api = typeof globalThis.browser !== 'undefined' ? globalThis.browser : globalThis.chrome;

  const DEFAULTS = { currency: 'USD', rate: 6.8 };
  const STORAGE_KEYS = { currency: 'anyaigcPricingCurrency', rate: 'anyaigcPricingRate' };

  /** 读取设置。callback 与 Promise 两种 storage 实现都能兼容。 */
  function loadSettings() {
    return new Promise((resolve) => {
      const defaults = {
        [STORAGE_KEYS.currency]: DEFAULTS.currency,
        [STORAGE_KEYS.rate]: DEFAULTS.rate
      };
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        resolve(value || defaults);
      };
      try {
        const result = api.storage.local.get(defaults, done);
        // Firefox 返回 Promise 而不调用 callback。
        if (result && typeof result.then === 'function') result.then(done, () => done(defaults));
      } catch (_) {
        done(defaults);
      }
    });
  }

  function saveSettings() {
    try {
      const payload = { [STORAGE_KEYS.currency]: currency, [STORAGE_KEYS.rate]: rate };
      const result = api.storage.local.set(payload);
      // 避免 Firefox 下未处理的 Promise rejection。
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (_) {
      /* 存储不可用时功能仍可正常使用，只是不会被记住。 */
    }
  }

  // ---------------------------------------------------------------------------
  // 状态
  // ---------------------------------------------------------------------------
  const PANEL_ID = 'anyaigc-price-currency-panel';
  const CONVERTED_CLASS = 'anyaigc-rmb-price';

  // 只匹配紧跟数字的美元符号，避免误伤正文里单独出现的 "$"。
  const PRICE_PATTERN = /\$\s*(\d+(?:\.\d+)?)/g;

  // 记录每个文本节点的原始美元文本，用于无损还原。
  // 用 WeakMap 是为了让 SPA 丢弃节点后条目能被 GC 回收，不会随浏览时长泄漏内存。
  const priceStates = new WeakMap();

  let currency = DEFAULTS.currency;
  let rate = DEFAULTS.rate;
  let applying = false; // 抑制由我们自己的写入触发的 MutationObserver 回调
  let ready = false;
  let lastPath = '';

  // ---------------------------------------------------------------------------
  // 页面判定
  // ---------------------------------------------------------------------------
  function isPricingPage() {
    return location.pathname === '/pricing' || location.pathname.startsWith('/pricing/');
  }

  function isLogPage() {
    return location.pathname === '/console/log';
  }

  function isSupportedPage() {
    return isPricingPage() || isLogPage();
  }

  // ---------------------------------------------------------------------------
  // 换算
  // ---------------------------------------------------------------------------
  function formatRmb(value) {
    // 日志里的单次调用花费常常小到 4 位小数会被抹平成 0.0000，所以多给两位。
    const decimals = isLogPage() ? 6 : 4;
    return `¥${(value * rate).toFixed(decimals)}`;
  }

  function convert(text) {
    return text.replace(PRICE_PATTERN, (_match, value) => formatRmb(Number(value)));
  }

  function isPriceTextNode(node) {
    if (!node.nodeValue || !node.nodeValue.includes('$')) return false;
    const parent = node.parentElement;
    return !!parent
      && !parent.closest(`#${PANEL_ID}`)
      && !parent.closest('script, style, textarea, code, pre');
  }

  function updatePrices() {
    if (!isSupportedPage()) return;
    applying = true;
    try {
      document.querySelectorAll(`.${CONVERTED_CLASS}`).forEach((element) => {
        element.classList.remove(CONVERTED_CLASS);
      });

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);

      nodes.forEach((node) => {
        let state = priceStates.get(node);
        // 已换算过的节点以 ¥ 开头、不含 $，所以必须依赖 state 才能重新访问到它，
        // 否则切回 USD 时就找不到该节点了。
        if (!state && !isPriceTextNode(node)) return;

        if (state && node.nodeValue !== state.convertedText && node.nodeValue !== state.usdText) {
          // 站点重新渲染了这个文本节点，采用它最新的美元原文。
          state = undefined;
          priceStates.delete(node);
        }
        if (!state) {
          state = { usdText: node.nodeValue, convertedText: '' };
          priceStates.set(node, state);
        }

        state.convertedText = convert(state.usdText);
        node.nodeValue = currency === 'RMB' ? state.convertedText : state.usdText;

        if (currency === 'RMB' && state.convertedText !== state.usdText) {
          node.parentElement?.classList.add(CONVERTED_CLASS);
        }
      });
    } finally {
      applying = false;
    }
  }

  // ---------------------------------------------------------------------------
  // 面板挂载点
  //
  // 两个页面各有一个稳定的锚点：模型广场用「倍率」开关所在的控件组，使用日志用
  // 顶部工具栏的 MPM 指标标签。面板插到锚点左侧。
  // ---------------------------------------------------------------------------
  function findPricingAnchor() {
    const searchRow = document.querySelector('.pricing-search-row');
    const label = [...(searchRow?.querySelectorAll('span') || [])]
      .find((el) => el.textContent.trim() === '倍率');
    return label?.parentElement || null;
  }

  function findLogAnchor() {
    const label = [...document.querySelectorAll('.semi-tag-content')]
      .find((el) => el.textContent.trim().startsWith('MPM:'));
    return label?.closest('.semi-tag') || null;
  }

  function findAnchor() {
    return isPricingPage() ? findPricingAnchor() : findLogAnchor();
  }

  // ---------------------------------------------------------------------------
  // 面板
  // ---------------------------------------------------------------------------
  function buildPanel() {
    const panel = document.createElement('section');
    panel.id = PANEL_ID;

    const group = document.createElement('div');
    group.className = 'anyaigc-currency-switch';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', '价格单位');

    const usdButton = document.createElement('button');
    usdButton.type = 'button';
    usdButton.dataset.currency = 'USD';
    usdButton.textContent = 'USD';

    const rmbButton = document.createElement('button');
    rmbButton.type = 'button';
    rmbButton.dataset.currency = 'RMB';
    rmbButton.textContent = '人民币';

    group.append(usdButton, rmbButton);

    const label = document.createElement('label');
    label.append(document.createTextNode('汇率 '));

    const rateInput = document.createElement('input');
    rateInput.type = 'number';
    rateInput.min = '0.0001';
    rateInput.step = '0.01';
    rateInput.inputMode = 'decimal';
    rateInput.setAttribute('aria-label', '美元兑人民币汇率');
    rateInput.value = String(rate);
    label.appendChild(rateInput);

    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.className = 'anyaigc-apply-rate';
    applyButton.textContent = '应用';

    panel.append(group, label, applyButton);

    const refresh = () => {
      panel.querySelectorAll('button[data-currency]').forEach((button) => {
        const active = button.dataset.currency === currency;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    };

    panel.querySelectorAll('button[data-currency]').forEach((button) => {
      button.addEventListener('click', () => {
        currency = button.dataset.currency;
        refresh();
        updatePrices();
        saveSettings();
      });
    });

    const applyRate = () => {
      const next = Number(rateInput.value);
      if (!Number.isFinite(next) || next <= 0) {
        rateInput.value = String(rate); // 拒绝非法输入并回填当前汇率
        return;
      }
      rate = next;
      updatePrices();
      saveSettings();
    };

    applyButton.addEventListener('click', applyRate);
    // 输入框里回车等同于点「应用」，省一次点击。
    rateInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyRate();
      }
    });

    refresh();
    return panel;
  }

  function renderPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const anchor = findAnchor();
    // 等页面自己的工具栏渲染出来再插入。若退化成 fixed 定位的临时面板，
    // 工具栏就绪后会出现明显的位置跳动。
    if (!anchor?.parentElement) return;
    anchor.parentElement.insertBefore(buildPanel(), anchor);
  }

  function sync() {
    if (!ready) return;

    if (!isSupportedPage()) {
      document.getElementById(PANEL_ID)?.remove();
      return;
    }

    // SPA 可能整块替换了工具栏，此时把面板迁移到新的工具栏里。
    const panel = document.getElementById(PANEL_ID);
    const anchor = findAnchor();
    if (panel && anchor && panel.nextElementSibling !== anchor) panel.remove();

    renderPanel();
    updatePrices();
  }

  // ---------------------------------------------------------------------------
  // 路由监听
  //
  // 站点是 SPA，切页面不会重新注入 content script，因此需要自己感知路由变化。
  // 包装 history API 覆盖程序化跳转，popstate 覆盖前进/后退，
  // 定时轮询兜底覆盖那些不经过以上两者的框架内部跳转。
  // ---------------------------------------------------------------------------
  function watchRoute() {
    const check = () => {
      if (location.pathname === lastPath) return;
      lastPath = location.pathname;
      sync();
    };

    const wrap = (name) => {
      const original = history[name];
      if (typeof original !== 'function') return;
      history[name] = function (...args) {
        const result = original.apply(this, args);
        queueMicrotask(check);
        return result;
      };
    };

    wrap('pushState');
    wrap('replaceState');
    addEventListener('popstate', check);
    setInterval(check, 400);
  }

  // ---------------------------------------------------------------------------
  // 启动
  // ---------------------------------------------------------------------------
  loadSettings().then((settings) => {
    currency = settings[STORAGE_KEYS.currency] === 'RMB' ? 'RMB' : 'USD';
    const savedRate = Number(settings[STORAGE_KEYS.rate]);
    rate = Number.isFinite(savedRate) && savedRate > 0 ? savedRate : DEFAULTS.rate;

    ready = true;
    lastPath = location.pathname;
    sync();
    watchRoute();
  });

  // 表格分页、筛选、懒加载都会插入新的价格节点，需要持续跟进。
  // `applying` 用于跳过我们自己写入文本时触发的回调，避免无限循环。
  new MutationObserver(() => {
    if (!applying) sync();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
