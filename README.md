# AnyAIGC 价格人民币换算

一个浏览器插件，在 [AnyAIGC](https://anyaigc.ai/) 的**模型广场**和**使用日志**页面加一个币种切换开关，
把页面上的美元价格按你自己填的汇率换算成人民币显示。

```
切换前   Claude Opus 4.5    $0.5736 / 1M tokens
切换后   Claude Opus 4.5    ¥3.9005 / 1M tokens        （汇率 6.8）
```

- 换算**只改变屏幕上的显示**，不影响你的实际账单，也不会修改任何提交给服务器的数据
- 全程在你的浏览器本地完成，**零网络请求**，不收集任何数据
- 只申请 `storage` 一项权限（用于记住你的汇率设置）
- 只在 `anyaigc.ai` 上生效，其他网站完全不加载

---

## 目录

- [功能说明](#功能说明)
- [安装](#安装)
  - [方式一：Chrome 应用商店（推荐）](#方式一chrome-应用商店推荐)
  - [方式二：下载 zip 手动安装](#方式二下载-zip-手动安装)
  - [各浏览器安装步骤](#各浏览器安装步骤)
- [使用教程](#使用教程)
- [常见问题](#常见问题)
- [浏览器兼容性](#浏览器兼容性)
- [从源码构建](#从源码构建)
- [发布到 Chrome 应用商店](#发布到-chrome-应用商店)
- [项目结构](#项目结构)
- [隐私](#隐私)
- [许可证](#许可证)

---

## 功能说明

插件在两个页面生效：

| 页面 | 地址 | 面板位置 | 小数位数 |
| --- | --- | --- | --- |
| 模型广场 | `https://anyaigc.ai/pricing` | 「倍率」开关**左侧** | 4 位 |
| 使用日志 | `https://anyaigc.ai/console/log` | 顶部 `MPM` 标签**左侧** | 6 位 |

> 使用日志里单次调用的花费常常非常小，4 位小数会被抹平成 `¥0.0000`，所以日志页多给两位。

面板包含三个控件：

```
┌─────────────────────────────────────────────┐
│  ┌──────┬────────┐                          │
│  │ USD  │ 人民币 │   汇率 [ 6.8  ]   [应用] │
│  └──────┴────────┘                          │
└─────────────────────────────────────────────┘
     币种切换            汇率输入      应用按钮
```

- **USD / 人民币**：点击即时切换，无需刷新
- **汇率**：可编辑，默认 `1 USD = 6.8 RMB`。改完点「应用」或直接按回车生效
- 换算后的价格会显示为**绿色**，让你一眼看出当前不是原始美元价
- 你的币种选择和汇率会自动保存，下次打开页面自动恢复

---

## 安装

### 方式一：Chrome 应用商店（推荐）

> 商店链接将在插件通过审核后补充到这里。

1. 打开应用商店中的插件页面
2. 点击「添加至 Chrome」
3. 在弹出的确认框中点击「添加扩展程序」

商店安装的优点是**自动更新** —— 有新版本时浏览器会自动升级，无需手动操作。

Edge / Opera / Brave / 360 / QQ 浏览器都基于 Chromium，也可以直接访问
Chrome 应用商店安装（Edge 首次访问会提示「允许来自其他商店的扩展」，点允许即可）。

### 方式二：下载 zip 手动安装

从 [Releases](https://github.com/AmazingRobin/AnyAIGC-usd2rmb/releases) 页面下载对应的 zip：

| 文件名 | 适用浏览器 |
| --- | --- |
| `anyaigc-usd2rmb-chrome-vX.Y.Z.zip` | Chrome、Edge、Opera、Brave、360、QQ 浏览器 |
| `anyaigc-usd2rmb-firefox-vX.Y.Z.zip` | Firefox |

下载后按下面对应浏览器的步骤安装。

> **注意**：手动安装的插件**不会自动更新**，需要你自己关注新版本。

### 各浏览器安装步骤

<details open>
<summary><b>Chrome</b></summary>

1. 下载 `anyaigc-usd2rmb-chrome-vX.Y.Z.zip` 并**解压到一个固定的文件夹**
   （比如 `D:\扩展\anyaigc-usd2rmb`）。

   > ⚠️ 解压后的文件夹**不要删除或移动**。Chrome 是直接从这个位置读取插件的，
   > 删掉文件夹插件就会失效。

2. 地址栏输入 `chrome://extensions/` 回车

3. 打开右上角的**「开发者模式」**开关

4. 点击左上角**「加载已解压的扩展程序」**

5. 选中第 1 步解压出来的**文件夹**（里面应该能看到 `manifest.json`），点「选择文件夹」

6. 插件出现在列表中即安装成功

</details>

<details>
<summary><b>Microsoft Edge</b></summary>

**推荐**：直接访问 Chrome 应用商店安装（见[方式一](#方式一chrome-应用商店推荐)）。

手动安装：

1. 下载并解压 `anyaigc-usd2rmb-chrome-vX.Y.Z.zip` 到固定文件夹（不要删除）
2. 地址栏输入 `edge://extensions/` 回车
3. 打开左下角**「开发人员模式」**
4. 点击**「加载解压缩的扩展」**
5. 选中解压出的文件夹

</details>

<details>
<summary><b>Firefox</b></summary>

Firefox 的正式版**要求扩展必须经过 Mozilla 签名**，未签名的插件只能临时加载
（重启浏览器后消失）。有三种选择：

**A. 临时加载（重启后失效，适合试用）**

1. 地址栏输入 `about:debugging#/runtime/this-firefox`
2. 点击**「临时载入附加组件」**
3. 直接选中 `anyaigc-usd2rmb-firefox-vX.Y.Z.zip` 文件本身（不用解压）

**B. 使用 Firefox Developer Edition / Nightly（永久安装）**

1. 地址栏输入 `about:config`，搜索 `xpinstall.signatures.required`，改为 `false`
2. 把 zip 后缀改成 `.xpi`
3. 地址栏输入 `about:addons` → 右上角齿轮 → **「从文件安装附加组件」** → 选择 `.xpi`

**C. 等待上架 Firefox 附加组件商店**（签名后的正式方式）

</details>

<details>
<summary><b>Opera</b></summary>

1. 下载并解压 `anyaigc-usd2rmb-chrome-vX.Y.Z.zip` 到固定文件夹
2. 地址栏输入 `opera://extensions` 回车
3. 打开右上角**「开发者模式」**
4. 点击**「加载已解压的扩展程序」**，选中解压出的文件夹

</details>

<details>
<summary><b>Brave</b></summary>

1. 下载并解压 `anyaigc-usd2rmb-chrome-vX.Y.Z.zip` 到固定文件夹
2. 地址栏输入 `brave://extensions/` 回车
3. 打开右上角**「开发者模式」**
4. 点击**「加载已解压的扩展程序」**，选中解压出的文件夹

</details>

<details>
<summary><b>360 极速浏览器 / 360 安全浏览器</b></summary>

1. 下载并解压 `anyaigc-usd2rmb-chrome-vX.Y.Z.zip` 到固定文件夹
2. 菜单 → **「更多工具」** → **「扩展程序」**（或地址栏 `se://extensions`）
3. 打开**「开发者模式」**
4. 点击**「加载已解压的扩展程序」**，选中解压出的文件夹

> 360 系浏览器的内核版本较旧，若提示不支持 Manifest V3，请升级浏览器到最新版。

</details>

<details>
<summary><b>QQ 浏览器</b></summary>

1. 下载并解压 `anyaigc-usd2rmb-chrome-vX.Y.Z.zip` 到固定文件夹
2. 菜单 → **「工具」** → **「扩展」**
3. 打开**「开发者模式」**
4. 点击**「加载已解压的扩展程序」**，选中解压出的文件夹

</details>

<details>
<summary><b>Safari</b></summary>

Safari 使用独立的扩展体系，需要在 **macOS** 上用 Xcode 转换后才能安装，
且上架 App Store 需要 Apple 开发者账号（$99/年）。当前版本**暂未提供** Safari 构建。

如果你有 Mac 环境，可以自行转换：

```bash
# 需要 Xcode
xcrun safari-web-extension-converter dist/chrome --project-location ./safari
```

然后在 Xcode 中打开生成的工程，签名并运行。详见
[Apple 官方文档](https://developer.apple.com/documentation/safariservices/safari_web_extensions/converting_a_web_extension_for_safari)。

</details>

---

## 使用教程

### 第 1 步：打开支持的页面

访问 [https://anyaigc.ai/pricing](https://anyaigc.ai/pricing)（模型广场），
或登录后访问使用日志页 `https://anyaigc.ai/console/log`。

### 第 2 步：找到切换面板

面板会自动出现在页面顶部的工具栏里：

- **模型广场**：在「倍率」开关的**左边**
- **使用日志**：在 `MPM:` 标签的**左边**

> 面板会等页面自己的工具栏渲染完成后再出现，所以刚打开页面时可能有一两秒延迟，这是正常的。

### 第 3 步：设置汇率

汇率默认是 `6.8`。建议改成你实际的结算汇率：

1. 点击汇率输入框，删掉原来的数字
2. 输入你的汇率，比如 `7.15`
3. 按**回车**，或点击右边的**「应用」**按钮

汇率会被记住，以后打开页面不用重新填。

> 只接受**大于 0 的数字**。填了负数、0 或者非数字，点「应用」时会自动恢复成上一次的有效值。

### 第 4 步：切换币种

点击**「人民币」**按钮，页面上所有美元价格立刻变成绿色的人民币价格。
点回**「USD」**恢复原始美元显示。

换算公式很简单：

```
人民币价格 = 美元价格 × 汇率
```

比如汇率 6.8 时，`$0.5736 × 6.8 = ¥3.9005`。

### 翻页、筛选后会怎样

插件会持续监听页面变化。你切换分页、筛选供应商、展开更多模型时，
新出现的价格会**自动按当前设置换算**，不需要重新点一次。

---

## 常见问题

<details>
<summary><b>面板没出现怎么办？</b></summary>

按顺序检查：

1. **确认地址正确**：必须是 `anyaigc.ai/pricing` 或 `anyaigc.ai/console/log`。
   首页、联系我们等其他页面不会出现面板（这是设计如此）。
2. **等几秒**：面板要等页面的工具栏加载完才会插入。
3. **刷新页面**（F5）。
4. **确认插件已启用**：打开 `chrome://extensions/`，看插件开关是不是开着。
5. **手动安装的检查文件夹**：如果你把解压出的文件夹删了或移动了，插件会失效。
   重新解压到固定位置并重新加载。
6. **看控制台报错**：按 F12 打开开发者工具，切到 Console 标签，看有没有红色报错，
   截图提 Issue。

</details>

<details>
<summary><b>为什么有的价格没被换算？</b></summary>

插件只换算形如 `$数字` 的文本（例如 `$0.5736`、`$12`）。以下情况不会被换算：

- 价格是图片而不是文字
- 价格写在 `<input>` 输入框里
- `$` 和数字之间有除空格以外的其他字符

如果你发现某个明显是价格的地方没被换算，欢迎提 Issue 并附上截图。

</details>

<details>
<summary><b>换算会影响我的实际扣费吗？</b></summary>

**完全不会。** 插件只修改浏览器里显示的文字，相当于给页面「贴了张便签」。
你的账户余额、实际扣费、API 计费全部由服务器端决定，插件碰不到也改不了。

关掉插件或点回 USD，页面显示的还是原始的美元数据。

</details>

<details>
<summary><b>汇率会自动更新吗？</b></summary>

**不会，需要你手动填。** 这是有意的设计：

- 自动获取汇率需要联网请求第三方接口，会引入网络权限、隐私顾虑和接口稳定性问题
- 不同用户的实际结算汇率不一样（银行汇率、信用卡汇率、平台结算汇率各有差异），
  手填能让你用上自己真实的成本汇率

建议你按实际结算汇率填写，比查来的中间价更有参考意义。

</details>

<details>
<summary><b>为什么日志页显示 6 位小数，价格页只有 4 位？</b></summary>

日志里单次 API 调用的花费经常小到 `$0.000012` 这个量级。如果只保留 4 位小数，
换算后会全变成 `¥0.0000`，完全看不出差别。所以日志页多给两位小数。

</details>

<details>
<summary><b>插件会收集我的数据吗？</b></summary>

不会。插件没有服务器，代码里**一行网络请求都没有**（构建时会自动检查这一点，
见 [`scripts/check.mjs`](scripts/check.mjs)）。

唯一存储的是你的币种选择和汇率数字，保存在你自己浏览器的本地存储里，随插件卸载一并删除。
详见 [PRIVACY.md](PRIVACY.md)。

</details>

<details>
<summary><b>会拖慢页面吗？</b></summary>

影响很小。插件用 `MutationObserver` 监听页面变化，只在页面真正变动时才工作，
且只遍历文本节点。原始的美元文本缓存在 `WeakMap` 里，切回 USD 时是直接还原而不是重新计算。

</details>

<details>
<summary><b>怎么卸载？</b></summary>

打开 `chrome://extensions/`（Edge 是 `edge://extensions/`），
找到「AnyAIGC 价格人民币换算」，点「移除」。你保存的汇率设置会一并删除。

</details>

---

## 浏览器兼容性

| 浏览器 | 最低版本 | 状态 | 安装方式 |
| --- | --- | --- | --- |
| Chrome | 88+ | ✅ 已在 Chromium 149 实测通过 | 商店 / zip |
| Edge | 88+ | ✅ 同内核，预期一致 | 商店 / zip |
| Opera | 74+ | ✅ 同内核，预期一致 | zip |
| Brave | 1.20+ | ✅ 同内核，预期一致 | zip |
| 360 极速 / 安全 | 支持 MV3 的版本 | ⚠️ 同内核，未实测 | zip |
| QQ 浏览器 | 支持 MV3 的版本 | ⚠️ 同内核，未实测 | zip |
| Firefox | 115+ | ⚠️ 已提供构建，未在真机实测 | zip（需签名或临时加载） |
| Safari | — | ❌ 未提供，需 macOS 自行转换 | 见上文说明 |

**关于兼容性的实现说明**：插件只用了各浏览器都支持的标准 API
（`MutationObserver`、`TreeWalker`、`WeakMap`、`history` API），
并在 [`src/content.js`](src/content.js) 顶部做了 `chrome` / `browser` 命名空间的兼容处理，
同时兼容 callback 和 Promise 两种 `storage` API 风格 —— 这是 Chrome 与 Firefox 之间最主要的差异点。

**诚实标注**：打✅的是在真实浏览器里跑过完整测试的；标⚠️的是同内核推断兼容或已提供构建但没有真机验证。
如果你在标⚠️的浏览器上试过，欢迎反馈结果。

---

## 从源码构建

需要 **Node.js 18+**。项目**零运行时依赖**，不需要 `npm install`。

```bash
git clone https://github.com/AmazingRobin/AnyAIGC-usd2rmb.git
cd AnyAIGC-usd2rmb

# 自检：验证 manifest、文件完整性、脚本语法
node scripts/check.mjs

# 打包全部目标
node scripts/build.mjs

# 或只打包某一个
node scripts/build.mjs chrome
node scripts/build.mjs firefox
```

产物在 `dist/`：

```
dist/
├── anyaigc-usd2rmb-chrome-v1.0.0.zip     ← 上传商店 / 分发给用户
├── anyaigc-usd2rmb-firefox-v1.0.0.zip
├── chrome/                                ← 解压目录，开发时直接「加载已解压的扩展程序」
└── firefox/
```

构建脚本会打印每个 zip 的 **sha256**。构建是可复现的 —— 相同的源码总是产出字节一致的 zip，
所以这个哈希可以用来校验分发出去的文件没被改动。

### 重新生成图标

图标由脚本生成（需要 Python + Pillow）：

```bash
pip install pillow
python scripts/make_icons.py
```

### 端到端测试

会真实加载扩展、打开线上页面、验证换算逻辑：

```bash
npm install --no-save playwright
node scripts/e2e.mjs
```

> **注意**：Chrome 136 起默认忽略 `--load-extension` 命令行开关，所以自动化测试用的是
> Playwright 下载的 Chromium。这个限制**只影响自动化**，用户手动通过
> 「加载已解压的扩展程序」安装完全正常。

### 修改版本号

改动 **两个** manifest 里的 `version` 字段（必须保持一致，`check.mjs` 会强制校验）：

- [`src/manifest.chrome.json`](src/manifest.chrome.json)
- [`src/manifest.firefox.json`](src/manifest.firefox.json)

---

## 发布到 Chrome 应用商店

完整流程见 [`docs/PUBLISHING.md`](docs/PUBLISHING.md)。简要版：

1. `node scripts/check.mjs && node scripts/build.mjs chrome`
2. 打开 [Chrome 开发者控制台](https://chrome.google.com/webstore/devconsole)
3. 「新增项目」→ 上传 `dist/anyaigc-usd2rmb-chrome-v1.0.0.zip`
4. 填写商店信息（描述文案、截图、分类）
5. 在「隐私权规范」中声明**不收集任何用户数据**，并说明 `storage` 权限用途
6. 提交审核（通常 1-3 个工作日）

---

## 项目结构

```
anyaigc-usd2rmb/
├── src/
│   ├── content.js              核心逻辑：换算 + 面板 + 路由监听
│   ├── content.css             面板样式
│   ├── manifest.chrome.json    Chrome / Edge / Opera / Brave / 360 / QQ
│   └── manifest.firefox.json   Firefox（多一个 gecko id）
├── icons/                      16/32/48/128 图标 + 商店宣传图块
├── scripts/
│   ├── build.mjs               打包成各浏览器的 zip（零依赖）
│   ├── check.mjs               构建前自检
│   ├── e2e.mjs                 端到端测试（需 playwright）
│   └── make_icons.py           生成图标（需 Pillow）
├── docs/
│   ├── PUBLISHING.md           Chrome 商店上架详细步骤
│   └── STORE_LISTING.md        可直接复制粘贴的商店文案
├── README.md
├── PRIVACY.md                  隐私政策（商店审核需要）
└── LICENSE
```

两份 manifest 之外的所有文件都是**共用**的 —— 没有分支代码，
浏览器差异全部收敛在 [`src/content.js`](src/content.js) 顶部的兼容层里。

---

## 隐私

**不收集任何数据，无任何网络请求，无统计追踪。** 完整说明见 [PRIVACY.md](PRIVACY.md)。

仅申请 `storage` 一项权限，用于在本地记住你的汇率设置。

---

## 许可证

[MIT](LICENSE)
