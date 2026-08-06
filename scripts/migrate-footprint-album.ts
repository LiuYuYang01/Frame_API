/**
 * 一次性迁移脚本：将 footprint.images（旧 JSON 照片数组）回填为 footprint.album_id（关联相册）
 *
 * 背景：
 *   重构后 footprint 不再单独存照片 URL，改为关联 album_id。
 *   旧数据里 images 字段存的是照片 URL 数组，本脚本通过 photo.url 反查所属相册，
 *   把第一个匹配到的相册 id 回填到 footprint.album_id。
 *
 * 用法（在 Frame_API 目录下执行）：
 *   npx ts-node scripts/migrate-footprint-album.ts
 *   若要连生产库，先设置环境变量：set NODE_ENV=production && npx ts-node scripts/migrate-footprint-album.ts
 *
 * 注意：
 *   1. 跑前请先备份 footprint 表：CREATE TABLE footprint_backup_xxx AS SELECT * FROM footprint;
 *   2. 本脚本只回填 album_id，不会删除 images 字段。确认无误后需手动 ALTER TABLE 删除 images。
 *   3. 一张照片可能属于多个相册，脚本取「第一个匹配到的」，对模糊情况请到 Admin 后台复核。
 *   4. 若旧 images 里是缩略图 URL 而 photo.url 存的是原图，会匹配不上，需先做 URL 归一化。
 */

import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

// 优先加载生产环境配置（如果传了 NODE_ENV），否则用 .env
const envFile = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
dotenv.config({ path: path.resolve(__dirname, '..', envFile) });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') }); // 兜底

// 旧 footprint 表里 images 字段对应的行结构
interface OldFootprintRow {
  id: number;
  title: string;
  images: string | string[] | null;
}

interface AlbumIdRow {
  album_id: number;
}

async function main() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USERNAME || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || '',
    synchronize: false, // 迁移脚本绝不能开 synchronize
    logging: false,
  });

  await dataSource.initialize();
  console.log('✅ 数据库连接成功，开始迁移...\n');

  // 0. 检查 album_id 列是否已存在
  const columns: { Field: string }[] = await dataSource.query('SHOW COLUMNS FROM footprint');
  const hasAlbumId = columns.some((c) => c.Field === 'album_id');
  if (!hasAlbumId) {
    console.log('⚠️  footprint 表还没有 album_id 列，先执行：');
    console.log('   ALTER TABLE footprint ADD COLUMN album_id INT NULL COMMENT \'关联相册ID\';');
    await dataSource.destroy();
    return;
  }

  // 1. 拉所有有旧 images 的足迹
  const rows: OldFootprintRow[] = await dataSource.query(
    'SELECT id, title, images FROM footprint WHERE images IS NOT NULL',
  );
  console.log(`📊 共 ${rows.length} 条足迹待迁移\n`);

  let matched = 0;
  let unmatched = 0;
  let skipped = 0;
  const unmatchedDetails: { id: number; title: string; urlCount: number }[] = [];

  for (const row of rows) {
    // 解析 images（可能是 JSON 字符串、已经是数组、或为空）
    let urls: string[] = [];
    if (Array.isArray(row.images)) {
      urls = row.images;
    } else if (typeof row.images === 'string') {
      const trimmed = row.images.trim();
      if (!trimmed) {
        skipped++;
        continue;
      }
      try {
        const parsed = JSON.parse(trimmed);
        urls = Array.isArray(parsed) ? parsed : [];
      } catch {
        // 不是 JSON，可能是逗号分隔的 URL
        urls = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    urls = urls.filter(Boolean);
    if (urls.length === 0) {
      skipped++;
      continue;
    }

    // 2. 通过 photo.url 反查所属相册（取第一张能匹配到的照片的第一个相册）
    const result: AlbumIdRow[] = await dataSource.query(
      `SELECT DISTINCT ap.album_id
       FROM photo p
       JOIN album_photo ap ON ap.photo_id = p.id
       WHERE p.url IN (?)
       LIMIT 1`,
      [urls],
    );

    if (result.length === 0) {
      unmatched++;
      unmatchedDetails.push({ id: row.id, title: row.title, urlCount: urls.length });
      continue;
    }

    // 3. 回填 album_id
    await dataSource.query('UPDATE footprint SET album_id = ? WHERE id = ?', [
      result[0].album_id,
      row.id,
    ]);
    console.log(`✓ 足迹 #${row.id}「${row.title}」→ 相册 ${result[0].album_id}`);
    matched++;
  }

  console.log('\n──────── 迁移结果 ────────');
  console.log(`✅ 成功匹配并回填：${matched} 条`);
  console.log(`❌ 未匹配到相册：${unmatched} 条`);
  console.log(`⏭  跳过（images 为空或解析失败）：${skipped} 条`);

  if (unmatchedDetails.length > 0) {
    console.log('\n⚠️  以下足迹未匹配到相册，需到 Admin 后台手动关联（旧 images 已保留）：');
    for (const d of unmatchedDetails) {
      console.log(`   - #${d.id}「${d.title}」（${d.urlCount} 张照片）`);
    }
  }

  console.log('\n📌 下一步：');
  console.log('   1. 抽查几条回填后的 footprint，确认 album_id 对应的相册里确实包含原照片');
  console.log('   2. 处理未匹配的足迹（Admin → 足迹管理 → 编辑 → 手动选相册）');
  console.log('   3. 全部处理完且确认无误后，执行：ALTER TABLE footprint DROP COLUMN images;');

  await dataSource.destroy();
  console.log('\n✅ 迁移结束，数据库连接已关闭');
}

main().catch((err) => {
  console.error('❌ 迁移失败:', err);
  process.exit(1);
});
