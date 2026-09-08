#!/usr/bin/env node
/**
 * 构建前自检：验证 manifest 合法性、文件完整性、以及内容脚本的语法。
 *
 *   node scripts/check.mjs
 *
 * 这些检查针对的都是「浏览器会静默拒绝加载扩展、或商店审核会打回」的问题 ——
 * 这类错误在人工点开插件之前很难发现，所以放在构建流程里自动拦截。
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function exists(relative) {
  return fs.existsSync(path.join(ROOT, relative));
}

// ---------------------------------------------------------------------------
// 1. manifest 校验
// ---------------------------------------------------------------------------
const MANIFESTS = ['src/manifest.chrome.json', 'src/manifest.firefox.json'];

// Chrome 应用商店的硬性长度限制，超出会在上传阶段直接被拒。
const NAME_MAX = 75;
const DESCRIPTION_MAX = 132;

const versions = new Map();

MANIFESTS.forEach((file) => {
  if (!exists(file)) {
    fail(`缺少 manifest：${file}`);
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(read(file));
  } catch (error) {
    fail(`${file} 不是合法 JSON：${error.message}`);
    return;
  }

  if (manifest.manifest_version !== 3) {
    fail(`${file}: manifest_version 应为 3，实际为 ${manifest.manifest_version}`);
  }

  // 商店要求 1-4 段纯数字版本号，每段 0-65535。
  if (!/^\d+(\.\d+){0,3}$/.test(manifest.version || '')) {
    fail(`${file}: version "${manifest.version}" 不符合商店要求的数字版本格式`);
  } else if (manifest.version.split('.').some((part) => Number(part) > 65535)) {
    fail(`${file}: version 中每段数字不能超过 65535`);
  } else {
    versions.set(file, manifest.version);
  }

  if (!manifest.name) fail(`${file}: 缺少 name`);
  else if ([...manifest.name].length > NAME_MAX) {
    fail(`${file}: name 长度 ${[...manifest.name].length} 超过商店上限 ${NAME_MAX}`);
  }

  if (!manifest.description) fail(`${file}: 缺少 description`);
  else if ([...manifest.description].length > DESCRIPTION_MAX) {
    fail(
      `${file}: description 长度 ${[...manifest.description].length} 超过商店上限 ${DESCRIPTION_MAX}`
    );
  }

  // 声明 default_locale 却没有 _locales 目录，扩展会直接加载失败。
  if (manifest.default_locale && !exists('_locales')) {
    fail(`${file}: 声明了 default_locale 但仓库中没有 _locales/ 目录，扩展将无法加载`);
  }

  // 权限收敛检查：本插件的功能只需要 storage。多出的权限会触发更严格的审核。
  const permissions = manifest.permissions || [];
  const extra = permissions.filter((permission) => permission !== 'storage');
  if (extra.length) {
    warn(`${file}: 出现了非必要权限 ${extra.join(', ')}，会加重商店审核`);
  }
  if (manifest.host_permissions?.length) {
    warn(`${file}: 声明了 host_permissions，本插件靠 content_scripts.matches 即可，通常不需要`);
  }

  // manifest 中引用的每个文件都必须真实存在，否则加载时报错。
  const referenced = [
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {}),
    ...(manifest.content_scripts || []).flatMap((script) => [
      ...(script.js || []),
      ...(script.css || [])
    ])
  ];
  referenced.forEach((relative) => {
    if (!exists(relative)) fail(`${file}: 引用了不存在的文件 ${relative}`);
  });

  const scripts = manifest.content_scripts || [];
  if (!scripts.length) fail(`${file}: 没有声明 content_scripts，插件不会生效`);
  scripts.forEach((script, index) => {
    const matches = script.matches || [];
    if (!matches.length) fail(`${file}: content_scripts[${index}] 缺少 matches`);
    // 通配主机权限会触发人工审核，本插件不应该出现。
    matches.forEach((pattern) => {
      if (pattern === '<all_urls>' || pattern.startsWith('*://*/')) {
        fail(`${file}: content_scripts[${index}] 使用了过宽的匹配模式 ${pattern}`);
      }
    });
    ['anyaigc.ai', 'www.anyaigc.ai'].forEach((host) => {
      if (!matches.some((pattern) => pattern.includes(host))) {
        warn(`${file}: content_scripts[${index}] 的 matches 未覆盖 ${host}`);
      }
    });
  });

  // Firefox 的 MV3 需要显式的扩展 ID 才能被 web-ext 签名和上架。
  if (file.includes('firefox')) {
    if (!manifest.browser_specific_settings?.gecko?.id) {
      fail(`${file}: Firefox 版必须提供 browser_specific_settings.gecko.id`);
    }
  } else if (manifest.browser_specific_settings) {
    fail(`${file}: Chrome 版不应包含 browser_specific_settings（Chrome 会报未知键警告）`);
  }
});

// 两份 manifest 的版本号必须同步，否则发布时容易只更新一边。
if (new Set(versions.values()).size > 1) {
  const detail = [...versions].map(([file, version]) => `${file}=${version}`).join(', ');
  fail(`各 manifest 版本号不一致：${detail}`);
}

// ---------------------------------------------------------------------------
// 2. 必需文件
// ---------------------------------------------------------------------------
['src/content.js', 'src/content.css', 'README.md', 'PRIVACY.md', 'LICENSE'].forEach((file) => {
  if (!exists(file)) fail(`缺少文件：${file}`);
});

[16, 32, 48, 128].forEach((size) => {
  const file = `icons/icon-${size}.png`;
  if (!exists(file)) {
    fail(`缺少图标：${file}（可运行 python scripts/make_icons.py 生成）`);
    return;
  }
  // 读 PNG 头部的 IHDR，确认实际像素尺寸与文件名一致 —— 尺寸不符会被商店拒绝。
  const buffer = fs.readFileSync(path.join(ROOT, file));
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width !== size || height !== size) {
    fail(`${file}: 实际尺寸 ${width}x${height}，与文件名声明的 ${size}x${size} 不符`);
  }
});

// ---------------------------------------------------------------------------
// 3. 内容脚本检查
// ---------------------------------------------------------------------------
if (exists('src/content.js')) {
  // 用 node --check 做真正的语法解析，比正则匹配可靠。
  try {
    execFileSync(process.execPath, ['--check', path.join(ROOT, 'src/content.js')], {
      stdio: 'pipe'
    });
  } catch (error) {
    fail(`src/content.js 语法错误：\n${error.stderr?.toString().trim()}`);
  }

  const source = read('src/content.js');

  // 隐私政策承诺过「零网络请求」，这里确保代码与承诺一致。
  [
    [/\bfetch\s*\(/, 'fetch()'],
    [/XMLHttpRequest/, 'XMLHttpRequest'],
    [/\bWebSocket\b/, 'WebSocket'],
    [/\bnavigator\.sendBeacon\b/, 'navigator.sendBeacon()'],
    [/\bEventSource\b/, 'EventSource']
  ].forEach(([pattern, label]) => {
    if (pattern.test(source)) {
      fail(`src/content.js 出现了网络调用 ${label}，与隐私政策「零网络请求」的承诺冲突`);
    }
  });

  // MV3 的扩展页面 CSP 禁止这些动态求值方式。
  [
    [/\beval\s*\(/, 'eval()'],
    [/new\s+Function\s*\(/, 'new Function()']
  ].forEach(([pattern, label]) => {
    if (pattern.test(source)) fail(`src/content.js 使用了 ${label}，违反 MV3 的 CSP 限制`);
  });

  // 页面 CSP 可能拦截 innerHTML 注入的 <style>，且是潜在的注入面。
  if (/\.innerHTML\s*=/.test(source)) {
    warn('src/content.js 使用了 innerHTML 赋值，建议改用 createElement 以规避页面 CSP');
  }

  // 遗留的 openlux 标识必须全部替换掉。
  const leftover = source.match(/openlux/gi);
  if (leftover) fail(`src/content.js 仍残留 ${leftover.length} 处 "openlux" 标识`);
}

if (exists('src/content.css')) {
  const css = read('src/content.css');
  const leftover = css.match(/openlux/gi);
  if (leftover) fail(`src/content.css 仍残留 ${leftover.length} 处 "openlux" 标识`);
}

// 全仓扫描遗留标识（跳过构建产物与 .git）。
function walk(dir, onFile) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (['node_modules', 'dist', '.git', '.playwright-mcp'].includes(entry.name)) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, onFile);
    else onFile(full);
  });
}

walk(ROOT, (full) => {
  if (!/\.(js|mjs|css|json|md|py|yml|yaml)$/.test(full)) return;
  // 自检脚本本身包含 "openlux" 字面量用于检测，跳过。
  if (path.resolve(full) === path.resolve(ROOT, 'scripts/check.mjs')) return;
  const content = fs.readFileSync(full, 'utf8');
  const hits = content.match(/openlux/gi);
  if (hits) {
    fail(`${path.relative(ROOT, full)}: 残留 ${hits.length} 处 "openlux" 标识`);
  }
});

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------
console.log('');
warnings.forEach((message) => console.log(`  警告  ${message}`));
failures.forEach((message) => console.log(`  失败  ${message}`));

if (failures.length) {
  console.log(`\n自检未通过：${failures.length} 项失败，${warnings.length} 项警告\n`);
  process.exit(1);
}

console.log(`  自检通过（${warnings.length} 项警告）\n`);
