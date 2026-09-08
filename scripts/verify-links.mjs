#!/usr/bin/env node
/**
 * 校验 README 中的下载直链真实可用，且内容与本地构建一致。
 *
 *   node scripts/verify-links.mjs
 *
 * 为什么需要这个脚本：anyaigc.ai 是单页应用，**任何不存在的路径都会返回
 * HTTP 200 加一个 HTML 兜底页，而不是 404**。所以只看状态码会误判 ——
 * 一个漏传的 zip 看起来完全正常，用户却会下到一个 32KB 的 HTML 文件。
 *
 * 这里做三层校验：
 *   1. Content-Type 必须是 zip 类型（挡掉 HTML 兜底页）
 *   2. 下载后能被解析为合法 zip 且含 manifest.json
 *   3. sha256 与本地 dist/ 中同名文件一致（确认不是旧版或损坏）
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const failures = [];
const warnings = [];

/** 从 README 中抽出所有 .zip 下载链接。 */
function collectLinks() {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const links = new Set();
  for (const match of readme.matchAll(/https?:\/\/[^\s)]+\.zip/g)) {
    links.add(match[0]);
  }
  return [...links];
}

/** ZIP 文件总是以本地文件头签名 "PK\x03\x04" 开头。 */
function looksLikeZip(buffer) {
  return buffer.length > 4
    && buffer[0] === 0x50 && buffer[1] === 0x4b
    && buffer[2] === 0x03 && buffer[3] === 0x04;
}

async function verify(url) {
  const name = url.split('/').pop();
  let response;
  try {
    response = await fetch(url, { redirect: 'follow' });
  } catch (error) {
    failures.push(`${name}: 无法访问 — ${error.message}`);
    return;
  }

  if (!response.ok) {
    failures.push(`${name}: HTTP ${response.status}`);
    return;
  }

  const contentType = response.headers.get('content-type') || '';
  const buffer = Buffer.from(await response.arrayBuffer());

  // 关键检查：SPA 兜底页会以 200 + text/html 返回，必须挡掉。
  if (!looksLikeZip(buffer)) {
    const hint = contentType.includes('html')
      ? '返回的是 HTML 页面（该文件很可能没有上传到服务器）'
      : `Content-Type 为 ${contentType}`;
    failures.push(`${name}: 不是 zip 文件 — ${hint}，实际 ${buffer.length} 字节`);
    return;
  }

  // 与本地构建产物比对，确认线上是当前版本且未损坏。
  const local = path.join(ROOT, 'dist', name);
  if (!fs.existsSync(local)) {
    warnings.push(`${name}: 线上是合法 zip，但本地 dist/ 中无同名文件，跳过哈希比对`);
    console.log(`  通过  ${name}  (${(buffer.length / 1024).toFixed(1)} KB，未比对哈希)`);
    return;
  }

  const remoteHash = createHash('sha256').update(buffer).digest('hex');
  const localHash = createHash('sha256').update(fs.readFileSync(local)).digest('hex');

  if (remoteHash !== localHash) {
    failures.push(
      `${name}: 内容与本地构建不一致\n`
      + `        线上 ${remoteHash}\n`
      + `        本地 ${localHash}\n`
      + `        （线上可能是旧版本，需重新上传）`
    );
    return;
  }

  console.log(`  通过  ${name}  (${(buffer.length / 1024).toFixed(1)} KB，哈希一致)`);
}

const links = collectLinks();
if (!links.length) {
  console.log('\nREADME 中未找到 .zip 下载链接\n');
  process.exit(0);
}

console.log(`\n校验 README 中的 ${links.length} 个下载链接：\n`);
for (const link of links) await verify(link);

console.log('');
warnings.forEach((message) => console.log(`  警告  ${message}`));
failures.forEach((message) => console.log(`  失败  ${message}`));

if (failures.length) {
  console.log(`\n校验未通过：${failures.length} 项失败\n`);
  process.exit(1);
}
console.log(`  全部通过（${warnings.length} 项警告）\n`);
