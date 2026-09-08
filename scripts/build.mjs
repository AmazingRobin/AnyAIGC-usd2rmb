#!/usr/bin/env node
/**
 * 打包脚本：为每个目标浏览器生成一个可直接安装 / 上传的 zip。
 *
 *   node scripts/build.mjs              # 打包全部目标
 *   node scripts/build.mjs chrome       # 只打包 Chrome
 *
 * 产物在 dist/ 目录：
 *   dist/anyaigc-usd2rmb-chrome-v1.0.0.zip    Chrome / Edge / Opera / Brave / 360 / QQ
 *   dist/anyaigc-usd2rmb-firefox-v1.0.0.zip   Firefox
 *   dist/chrome/                              解压后的目录，供「加载已解压的扩展程序」使用
 *   dist/firefox/
 *
 * zip 使用 Node 内置的 zlib 手写 ZIP 容器，不引入任何第三方依赖 ——
 * 供应链面积为零，也不需要 npm install。
 */

import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

/** 每个目标浏览器用哪份 manifest。其余文件完全共用。 */
const TARGETS = {
  chrome: {
    manifest: 'src/manifest.chrome.json',
    label: 'Chrome / Edge / Opera / Brave / 360 / QQ 浏览器'
  },
  firefox: {
    manifest: 'src/manifest.firefox.json',
    label: 'Firefox'
  }
};

/** 除 manifest 外要打进包里的文件。manifest 由目标决定，单独处理。 */
const SHARED_FILES = [
  'src/content.js',
  'src/content.css',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
  'LICENSE',
  'PRIVACY.md'
];

// ---------------------------------------------------------------------------
// 最小 ZIP 写入器
//
// 只实现 ZIP 规范中扩展商店需要的那一小部分：deflate 压缩的本地文件头 +
// 中央目录 + 结束记录。不做 zip64（扩展体积远小于 4GB 上限）。
// ---------------------------------------------------------------------------

/** CRC-32 查表，ZIP 的每个条目都需要校验值。 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * DOS 时间格式只精确到 2 秒，且没有时区。这里固定用一个常量时间戳，
 * 让同样的输入始终产出字节一致的 zip（可复现构建，便于校验 sha256）。
 */
const DOS_TIME = 0x0000; // 00:00:00
const DOS_DATE = 0x2821; // 2020-01-01

function createZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  entries.forEach(({ name, data }) => {
    const nameBuffer = Buffer.from(name, 'utf8');
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const local = Buffer.alloc(30 + nameBuffer.length);
    local.writeUInt32LE(0x04034b50, 0); // 本地文件头签名
    local.writeUInt16LE(20, 4); // 解压所需版本 2.0
    local.writeUInt16LE(0x0800, 6); // 通用标志位：文件名为 UTF-8
    local.writeUInt16LE(8, 8); // 压缩方式：deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28); // 无 extra field
    nameBuffer.copy(local, 30);

    locals.push(local, compressed);

    const central = Buffer.alloc(46 + nameBuffer.length);
    central.writeUInt32LE(0x02014b50, 0); // 中央目录头签名
    central.writeUInt16LE(20, 4); // 制作版本
    central.writeUInt16LE(20, 6); // 解压所需版本
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // 磁盘号
    central.writeUInt16LE(0, 36); // 内部属性
    // 外部属性高 16 位放 Unix 权限（0644 普通文件）。JS 的 << 是有符号 32 位运算，
    // 会溢出到符号位变成负数，必须用 >>> 0 转回无符号。
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42); // 对应本地头的偏移
    nameBuffer.copy(central, 46);

    centrals.push(central);
    offset += local.length + compressed.length;
  });

  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // 结束记录签名
  end.writeUInt16LE(0, 4); // 当前磁盘号
  end.writeUInt16LE(0, 6); // 中央目录起始磁盘号
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // 无注释

  return Buffer.concat([...locals, centralDirectory, end]);
}

// ---------------------------------------------------------------------------
// 构建
// ---------------------------------------------------------------------------

function readVersion() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, TARGETS.chrome.manifest), 'utf8'));
  return manifest.version;
}

/**
 * 校验两份 manifest 的版本号一致。发布时两边版本不同步是很容易犯、
 * 又很难在商店审核前发现的错误，所以在构建期直接拦下来。
 */
function assertVersionsMatch() {
  const versions = Object.entries(TARGETS).map(([name, target]) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, target.manifest), 'utf8'));
    return [name, manifest.version];
  });
  const unique = new Set(versions.map(([, version]) => version));
  if (unique.size > 1) {
    const detail = versions.map(([name, version]) => `${name}=${version}`).join(', ');
    throw new Error(`各 manifest 版本号不一致：${detail}`);
  }
}

function buildTarget(name, version) {
  const target = TARGETS[name];
  const files = [
    // 打进包里时统一改名为 manifest.json —— 浏览器只认这个文件名。
    { name: 'manifest.json', source: target.manifest },
    ...SHARED_FILES.map((file) => ({ name: file, source: file }))
  ];

  const entries = files.map(({ name: entryName, source }) => {
    const full = path.join(ROOT, source);
    if (!fs.existsSync(full)) throw new Error(`缺少文件：${source}`);
    return { name: entryName, data: fs.readFileSync(full) };
  });

  // 同时输出解压目录，方便开发时直接「加载已解压的扩展程序」。
  const unpacked = path.join(DIST, name);
  fs.rmSync(unpacked, { recursive: true, force: true });
  entries.forEach(({ name: entryName, data }) => {
    const out = path.join(unpacked, entryName);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, data);
  });

  const zipPath = path.join(DIST, `anyaigc-usd2rmb-${name}-v${version}.zip`);
  const zip = createZip(entries);
  fs.writeFileSync(zipPath, zip);

  const sha256 = createHash('sha256').update(zip).digest('hex');
  return { zipPath, unpacked, size: zip.length, count: entries.length, sha256, label: target.label };
}

function main() {
  const requested = process.argv.slice(2);
  const names = requested.length ? requested : Object.keys(TARGETS);

  const unknown = names.filter((name) => !TARGETS[name]);
  if (unknown.length) {
    console.error(`未知的构建目标：${unknown.join(', ')}`);
    console.error(`可用目标：${Object.keys(TARGETS).join(', ')}`);
    process.exit(1);
  }

  assertVersionsMatch();
  const version = readVersion();
  fs.mkdirSync(DIST, { recursive: true });

  console.log(`\n打包 AnyAIGC 价格人民币换算 v${version}\n`);
  names.forEach((name) => {
    const result = buildTarget(name, version);
    const kb = (result.size / 1024).toFixed(1);
    console.log(`  ${result.label}`);
    console.log(`    zip    ${path.relative(ROOT, result.zipPath)}  (${kb} KB, ${result.count} 个文件)`);
    console.log(`    目录   ${path.relative(ROOT, result.unpacked)}/`);
    console.log(`    sha256 ${result.sha256}`);
    console.log('');
  });
}

main();
