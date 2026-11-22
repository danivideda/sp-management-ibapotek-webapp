import { createServerFn } from '@tanstack/react-start'
import { db } from '#/db'
import fs from 'fs'
import path from 'path'

/**
 * Extracts column names from CREATE TABLE `dobat` if present in the dump.
 */
function extractDobatColumns(content: string): string[] | null {
  const createMatch = content.match(/CREATE TABLE `dobat`\s*\(([\s\S]*?)\)\s*ENGINE/i)
  if (!createMatch) return null

  const colDefs = createMatch[1]
  const columns: string[] = []
  const colRegex = /`([^`]+)`\s+/g
  let m: RegExpExecArray | null
  while ((m = colRegex.exec(colDefs)) !== null) {
    columns.push(m[1])
  }
  return columns.length > 0 ? columns : null
}

/**
 * Basic SQL values parser that respects single-quoted strings.
 */
function parseSqlValues(valuesStr: string): string[][] {
  const rows: string[][] = []
  let i = 0
  const len = valuesStr.length

  while (i < len) {
    // Skip whitespace and commas
    while (i < len && /[\s,]/.test(valuesStr[i])) i++
    if (i >= len) break

    if (valuesStr[i] !== '(') break
    i++ // skip (

    const row: string[] = []
    let inString = false
    let current = ''
    let escape = false

    while (i < len) {
      const c = valuesStr[i]

      if (escape) {
        current += c
        escape = false
        i++
        continue
      }

      if (c === '\\' && inString) {
        escape = true
        i++
        continue
      }

      if (c === "'") {
        if (inString && valuesStr[i + 1] === "'") {
          // escaped quote ''
          current += "'"
          i += 2
          continue
        }
        inString = !inString
        i++
        continue
      }

      if (!inString && c === ',') {
        row.push(current.trim())
        current = ''
        i++
        continue
      }

      if (!inString && c === ')') {
        row.push(current.trim())
        rows.push(row)
        i++
        break
      }

      current += c
      i++
    }
  }

  return rows
}

function findCol(columns: string[] | null, names: string[]): number {
  if (!columns) return -1
  const lower = columns.map((c) => c.toLowerCase())
  for (const name of names) {
    const idx = lower.indexOf(name.toLowerCase())
    if (idx !== -1) return idx
  }
  return -1
}

export const importFromSqlDump = createServerFn({ method: 'POST' })
  .validator((data: { filePath?: string }) => data)
  .handler(async ({ data }) => {
    const dumpPath = data.filePath || path.join(process.cwd(), 'data', 'ibapotek.sql')
    if (!fs.existsSync(dumpPath)) {
      return { success: false, error: `File not found: ${dumpPath}` }
    }

    const content = fs.readFileSync(dumpPath, 'utf-8')

    const columns = extractDobatColumns(content)

    const insertMatch = content.match(/INSERT INTO `dobat` VALUES\s*([\s\S]*?);/i)
    if (!insertMatch) {
      return { success: false, error: 'No dobat INSERT found in dump' }
    }

    const rows = parseSqlValues(insertMatch[1])

    // Prefer named columns; fall back to old approximate indices only if CREATE TABLE missing
    const idxKode = findCol(columns, ['kode', 'kode_obat', 'kd_obat']) ?? 0
    const idxNama = findCol(columns, ['nama', 'nama_obat', 'nm_obat']) ?? 1
    const idxKategori = findCol(columns, ['kategori', 'kategori_obat', 'jenis']) ?? 2
    const idxStok = findCol(columns, ['stok', 'qty', 'jumlah']) ?? 3
    const idxStokMin = findCol(columns, ['stok_min', 'stokmin', 'min_stok', 'stok_minimum']) ?? 6
    const idxSatuan = findCol(columns, ['satuan_beli', 'satuan', 'unit']) ?? 4
    const idxHarga = findCol(columns, ['harga_beli', 'harga', 'hrg_beli']) ?? 5
    const idxSuplier = findCol(columns, ['suplier', 'supplier', 'suplier_nama', 'nama_suplier']) ?? 24
    const idxPabrik = findCol(columns, ['pabrik', 'pabrik_nama', 'nama_pabrik', 'produsen']) ?? 25
    const idxLokasi = findCol(columns, ['lokasi', 'lokasi_obat', 'rak']) ?? 29

    const insert = db.prepare(`
      INSERT OR REPLACE INTO obat (kode, nama, kategori, stok, stok_min, satuan_beli, harga_beli, suplier, pabrik, lokasi)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    let count = 0
    for (const row of rows) {
      if (row.length < 5) continue
      try {
        const kode = row[idxKode] || ''
        if (!kode) continue

        insert.run(
          kode,
          row[idxNama] || '',
          row[idxKategori] || null,
          parseFloat(row[idxStok]) || 0,
          parseFloat(row[idxStokMin]) || 0,
          row[idxSatuan] || null,
          parseFloat(row[idxHarga]) || 0,
          row[idxSuplier] || null,
          row[idxPabrik] || null,
          row[idxLokasi] || null,
        )
        count++
      } catch {
        // skip malformed row
      }
    }

    return {
      success: true,
      imported: count,
      columnsFound: columns ? columns.length : 0,
      mapped: {
        suplier: columns ? columns[idxSuplier] : `index ${idxSuplier}`,
        pabrik: columns ? columns[idxPabrik] : `index ${idxPabrik}`,
      },
    }
  })
