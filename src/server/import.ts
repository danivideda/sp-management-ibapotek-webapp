import { createServerFn } from '@tanstack/react-start'
import { db } from '#/db'
import fs from 'fs'
import path from 'path'

/**
 * Simple parser that extracts INSERT statements for `dobat` from a MariaDB dump
 * and inserts into the local SQLite `obat` table.
 * Place your dump at data/ibapotek.sql (or pass path).
 */
export const importFromSqlDump = createServerFn({ method: 'POST' })
  .validator((data: { filePath?: string }) => data)
  .handler(async ({ data }) => {
    const dumpPath = data.filePath || path.join(process.cwd(), 'data', 'ibapotek.sql')
    if (!fs.existsSync(dumpPath)) {
      return { success: false, error: `File not found: ${dumpPath}` }
    }

    const content = fs.readFileSync(dumpPath, 'utf-8')
    const insertMatch = content.match(/INSERT INTO `dobat` VALUES\s*([\s\S]*?);/)
    if (!insertMatch) {
      return { success: false, error: 'No dobat INSERT found in dump' }
    }

    // Very basic CSV-like parser for the VALUES (this is simplified; real dumps can be complex)
    const valuesStr = insertMatch[1]
    const rows = valuesStr
      .split('),(')
      .map((r) => r.replace(/^\(/, '').replace(/\)$/, ''))
      .map((r) => r.split(",").map((v) => v.trim().replace(/^'|'$/g, '')))

    const insert = db.prepare(`
      INSERT OR REPLACE INTO obat (kode, nama, kategori, stok, stok_min, satuan_beli, harga_beli, suplier, pabrik, lokasi)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    let count = 0
    for (const row of rows) {
      if (row.length < 10) continue
      try {
        insert.run(
          row[0], // kode
          row[1], // nama
          row[2], // kategori
          parseFloat(row[3]) || 0, // stok
          parseFloat(row[6]) || 0, // stok_min
          row[4], // satuan_beli
          parseFloat(row[5]) || 0, // harga_beli
          row[24] || null, // suplier (approx index)
          row[25] || null, // pabrik
          row[29] || null  // lokasi
        )
        count++
      } catch {
        // skip malformed
      }
    }

    return { success: true, imported: count }
  })
