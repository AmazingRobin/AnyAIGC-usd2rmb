# 发布到 Chrome 应用商店

面向已有 Chrome 开发者账号的情况。首次发布需要一次性支付 $5 注册费
（若账号已注册过则无需再付）。

---

## 一、发布前检查

```bash
node scripts/check.mjs          # 必须通过，不能有「失败」项
node scripts/build.mjs chrome   # 产出 dist/anyaigc-usd2rmb-chrome-v1.0.0.zip
```

自检会拦下这几类会导致上传被拒或审核被打回的问题：

- manifest 不是合法 JSON，或 `manifest_version` 不是 3
- 版本号格式不符合商店要求（必须是 1-4 段数字，每段 ≤ 65535）
- 名称超过 75 字符 / 描述超过 132 字符
- manifest 引用了不存在的文件
- 图标实际像素尺寸与文件名不符
- 出现了不必要的权限或过宽的 `matches` 模式
- 代码中出现网络请求（与隐私政策的「零数据收集」声明冲突）
- 两份 manifest 版本号不一致

**建议再手动过一遍**：把 `dist/chrome/` 用「加载已解压的扩展程序」装进浏览器，
打开 https://anyaigc.ai/pricing 实际点几下，确认面板正常、切换正常。

---

## 二、准备商店素材

### 必需

| 素材 | 规格 | 来源 |
| --- | --- | --- |
| 扩展包 | zip | `dist/anyaigc-usd2rmb-chrome-v1.0.0.zip` |
| 商店图标 | 128×128 PNG | `icons/icon-128.png` |
| 截图 | 1280×800 或 640×400 PNG/JPG，**至少 1 张，最多 5 张** | 需自己截 |
| 简短说明 | ≤ 132 字符 | 见 [STORE_LISTING.md](STORE_LISTING.md) |
| 详细说明 | ≤ 16000 字符 | 见 [STORE_LISTING.md](STORE_LISTING.md) |

### 可选但建议

| 素材 | 规格 | 来源 |
| --- | --- | --- |
| 小型宣传图块 | 440×280 PNG | `icons/store-tile-440x280.png` |

### 怎么截图

商店要求截图尺寸严格为 **1280×800** 或 **640×400**。建议截这几张：

1. **模型广场 + 人民币模式**（最重要，让用户一眼看懂功能）
   —— 面板可见、价格显示为绿色的 ¥
2. **模型广场 + USD 模式**（对比效果）
3. **使用日志页 + 人民币模式**
4. **面板特写**（放大展示三个控件）

截图技巧：

```bash
# 用 e2e 脚本自动截一张（会保存到 dist/e2e-pricing-rmb.png，1280×720）
node scripts/e2e.mjs
```

自动截的是 1280×720，不符合商店规格，需要补成 1280×800。可以用 Python 加白边：

```bash
python -c "
from PIL import Image
im = Image.open('dist/e2e-pricing-rmb.png')
canvas = Image.new('RGB', (1280, 800), 'white')
canvas.paste(im, (0, (800 - im.height) // 2))
canvas.save('dist/screenshot-1280x800.png')
print('已保存 dist/screenshot-1280x800.png')
"
```

手动截图更可控：把浏览器窗口调到合适大小，用系统截图工具截取页面区域，再裁成 1280×800。

---

## 三、上传

1. 打开 [Chrome 开发者控制台](https://chrome.google.com/webstore/devconsole)
2. 点击 **「新增项目」**
3. 上传 `dist/anyaigc-usd2rmb-chrome-v1.0.0.zip`
4. 等待解析完成，进入项目配置页

---

## 四、填写「商品详情」

| 字段 | 填什么 |
| --- | --- |
| 名称 | `AnyAIGC 价格人民币换算` |
| 简短说明 | 见 [STORE_LISTING.md](STORE_LISTING.md) |
| 详细说明 | 见 [STORE_LISTING.md](STORE_LISTING.md) |
| 类别 | **工具** |
| 语言 | **中文（简体）** |
| 图标 | 上传 `icons/icon-128.png` |
| 截图 | 上传准备好的 1280×800 截图 |
| 小型宣传图块 | 上传 `icons/store-tile-440x280.png` |

---

## 五、填写「隐私权规范」（最容易卡审核的一步）

这一步务必如实、完整地填，填得含糊是被打回的最常见原因。

### 单一用途说明

```
在 AnyAIGC 网站（anyaigc.ai）的模型价格页和使用日志页，将页面上以美元显示的
价格按用户自行设定的汇率换算为人民币显示，便于中国用户直观理解成本。
```

### 权限用途说明

**`storage` 权限**：

```
用于在用户本地保存两项设置：当前选择的显示币种（USD 或人民币）以及用户手动填写的
汇率数值。没有此权限，用户每次刷新页面都需要重新设置一次，严重影响可用性。
这两项设置仅存储在用户本地设备，不含任何个人信息，也不会被上传。
```

> 本插件**没有**申请 `host_permissions`。作用域完全由
> `content_scripts.matches` 限定在 `anyaigc.ai`，因此不需要额外的主机权限说明。
> 如果表单要求解释为什么代码会在 anyaigc.ai 上运行，回答：
>
> ```
> 插件的核心功能是修改 anyaigc.ai 页面上的价格显示，必须在该站点的页面上运行
> 内容脚本才能实现。匹配范围已严格限定为 anyaigc.ai 和 www.anyaigc.ai 两个域名，
> 不涉及任何其他网站。
> ```

### 数据用途声明

**关键：以下所有项目全部不勾选。**

| 数据类型 | 是否收集 |
| --- | --- |
| 个人身份信息 | ❌ 不勾 |
| 健康信息 | ❌ 不勾 |
| 财务和付款信息 | ❌ 不勾 |
| 身份验证信息 | ❌ 不勾 |
| 个人通信内容 | ❌ 不勾 |
| 位置信息 | ❌ 不勾 |
| 网页浏览记录 | ❌ 不勾 |
| 用户活动 | ❌ 不勾 |
| 网站内容 | ❌ 不勾 |

> 用户填写的汇率是一个自定义数字，不属于「财务和付款信息」——
> 它不是账户、卡号、交易记录或余额，只是一个用于本地显示换算的参数。

### 三项合规声明

三项都要勾选「是」：

- ✅ 我不会将用户数据出售或转让给第三方（用于核准的用例除外）
- ✅ 我不会将用户数据用于或转让给与本商品单一用途无关的目的
- ✅ 我不会将用户数据用于或转让给用于判定信用状况或放贷目的

### 隐私政策网址

填写仓库中 [PRIVACY.md](../PRIVACY.md) 的 GitHub 在线地址，例如：

```
https://github.com/AmazingRobin/AnyAIGC-usd2rmb/blob/main/PRIVACY.md
```

> 必须是**公开可访问**的链接。仓库如果是 private，审核会因为打不开而被打回 ——
> 要么把仓库设为 public，要么用 GitHub Pages / Gist 单独托管一份。

---

## 六、设置可见性并提交

| 选项 | 建议 |
| --- | --- |
| 可见性 | **公开**（想先内测可选「不公开」，通过链接访问） |
| 发布区域 | 全部区域，或至少包含「中国」 |

点击 **「提交以供审核」**。

**审核时长**：通常 1-3 个工作日。因为本插件权限极少、无数据收集、作用域窄，
属于低风险类型，通常会走较快的通道。

---

## 七、后续版本更新

1. 同步修改两份 manifest 的 `version`（`check.mjs` 会校验一致性）：
   - `src/manifest.chrome.json`
   - `src/manifest.firefox.json`
2. `node scripts/check.mjs && node scripts/build.mjs chrome`
3. 在开发者控制台进入已有项目 → **「软件包」** → 上传新 zip
4. 若功能有变化，更新详细说明
5. 提交审核

> 版本号只能递增，不能重复上传同一版本号。

---

## 常见被拒原因及对策

| 被拒原因 | 对策 |
| --- | --- |
| 权限申请超出功能所需 | 本插件只申请 `storage`，如被质疑，用上文的用途说明回复 |
| 隐私政策链接无法访问 | 确认仓库是 public，或单独托管隐私政策页面 |
| 数据用途声明与代码不符 | `check.mjs` 会自动扫描代码中的网络调用，确保声明与实现一致 |
| 描述与实际功能不符 | 用 [STORE_LISTING.md](STORE_LISTING.md) 里的文案，它与实际功能严格对应 |
| 截图不清晰或与功能无关 | 截图必须真实展示插件界面，不要用纯宣传图 |
| 代码混淆 | 本项目源码完全明文、无压缩、无混淆，不涉及此问题 |

---

## 附：Firefox 上架（可选）

Firefox 的扩展需要 Mozilla 签名。流程：

1. 注册 [Firefox 附加组件开发者账号](https://addons.mozilla.org/developers/)（免费）
2. 用 `web-ext` 校验并签名：

   ```bash
   npm install --no-save web-ext
   npx web-ext lint --source-dir dist/firefox
   npx web-ext sign --source-dir dist/firefox \
     --api-key <你的 JWT issuer> --api-secret <你的 JWT secret>
   ```

3. 签名后的 `.xpi` 出现在 `web-ext-artifacts/`，可直接分发或提交上架审核
