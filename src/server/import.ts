import { createServerFn } from '@tanstack/react-start'
import { db } from '#/db'
import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

/**
 * Extracts real column names from CREATE TABLE `dobat` (only column definitions, not keys/indexes).
 * Matches `colname` followed by a type identifier.
 */
function extractDobatColumns(content: string): string[] | null {
  const createMatch = content.match(/CREATE TABLE `dobat`\s*\(([\s\S]*?)\)\s*ENGINE/i)
  if (!createMatch) return null

  const colDefs = createMatch[1]
  const columns: string[] = []
  // Match `name` followed by whitespace and a type word (varchar, int, decimal, text, etc.)
  const colRegex = /`([^`]+)`\s+[a-zA-Z]/g
  let m: RegExpExecArray | null
  while ((m = colRegex.exec(colDefs)) !== null) {
    columns.push(m[1])
  }
  return columns.length > 0 ? columns : null
}

/**
 * Parse SQL VALUES clause into rows of string values.
 * Respects single-quoted strings and basic escapes.
 */
function parseSqlValues(valuesStr: string): string[][] {
  const rows: string[][] = []
  let i = 0
  const len = valuesStr.length

  while (i < len) {
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

/**
 * Find the start of all INSERT INTO `dobat` VALUES sections and extract their values strings
 * more carefully (stop at ; outside of strings).
 */
function extractInsertValues(content: string): string[] {
  const results: string[] = []
  const insertRegex = /INSERT INTO `dobat` VALUES\s*/gi
  let match: RegExpExecArray | null

  while ((match = insertRegex.exec(content)) !== null) {
    let i = match.index + match[0].length
    const len = content.length
    let inString = false
    let escape = false
    const start = i

    while (i < len) {
      const c = content[i]

      if (escape) {
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
        if (inString && content[i + 1] === "'") {
          i += 2
          continue
        }
        inString = !inString
        i++
        continue
      }

      if (!inString && c === ';') {
        results.push(content.slice(start, i))
        break
      }

      i++
    }
  }

  return results
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
    if (!columns || columns.length === 0) {
      return { success: false, error: 'Could not extract columns from CREATE TABLE `dobat`' }
    }

    const insertValueBlocks = extractInsertValues(content)
    if (insertValueBlocks.length === 0) {
      return { success: false, error: 'No dobat INSERT found in dump' }
    }

    // Load into a temporary in-memory SQLite database so we can query by column name
    const tempDb = new Database(':memory:')
    const colList = columns.map((c) => `"${c}" TEXT`).join(', ')
    tempDb.exec(`CREATE TABLE dobat (${colList})`)

    const placeholders = columns.map(() => '?').join(', ')
    const insertTemp = tempDb.prepare(`INSERT INTO dobat VALUES (${placeholders})`)

    let parsedRows = 0
    for (const valuesStr of insertValueBlocks) {
      const rows = parseSqlValues(valuesStr)
      for (const row of rows) {
        if (row.length !== columns.length) {
          // skip misaligned rows
          continue
        }
        // Convert literal 'NULL' to null
        const values = row.map((v) => (v.toUpperCase() === 'NULL' ? null : v))
        try {
          insertTemp.run(...values)
          parsedRows++
        } catch {
          // skip
        }
      }
    }

    // Now query the needed columns by name from the temp table
    const idxKode = findCol(columns, ['kode', 'kode_obat', 'kd_obat'])
    const idxNama = findCol(columns, ['nama', 'nama_obat', 'nm_obat'])
    const idxKategori = findCol(columns, ['kategori', 'kategori_obat', 'jenis'])
    const idxStok = findCol(columns, ['stok', 'qty', 'jumlah'])
    const idxStokMin = findCol(columns, ['stok_min', 'stokmin', 'min_stok', 'stok_minimum'])
    const idxSatuan = findCol(columns, ['satuan_beli', 'satuan', 'unit'])
    const idxHarga = findCol(columns, ['harga_beli', 'harga', 'hrg_beli'])
    const idxSuplier = findCol(columns, ['suplier', 'supplier', 'suplier_nama', 'nama_suplier'])
    const idxPabrik = findCol(columns, ['pabrik', 'pabrik_nama', 'nama_pabrik', 'produsen'])
    const idxLokasi = findCol(columns, ['lokasi', 'lokasi_obat', 'rak'])

    if (idxKode === -1) {
      tempDb.close()
      return { success: false, error: 'Column "kode" not found in dobat' }
    }

    const selectCols = [
      columns[idxKode],
      idxNama >= 0 ? columns[idxNama] : "''",
      idxKategori >= 0 ? columns[idxKategori] : 'NULL',
      idxStok >= 0 ? columns[idxStok] : '0',
      idxStokMin >= 0 ? columns[idxStokMin] : '0',
      idxSatuan >= 0 ? columns[idxSatuan] : 'NULL',
      idxHarga >= 0 ? columns[idxHarga] : '0',
      idxSuplier >= 0 ? columns[idxSuplier] : 'NULL',
      idxPabrik >= 0 ? columns[idxPabrik] : 'NULL',
      idxLokasi >= 0 ? columns[idxLokasi] : 'NULL',
    ]

    const selectSql = `
      SELECT
        "${selectCols[0]}" as kode,
        ${idxNama >= 0 ? `"${selectCols[1]}"` : "''"} as nama,
        ${idxKategori >= 0 ? `"${selectCols[2]}"` : 'NULL'} as kategori,
        ${idxStok >= 0 ? `"${selectCols[3]}"` : '0'} as stok,
        ${idxStokMin >= 0 ? `"${selectCols[4]}"` : '0'} as stok_min,
        ${idxSatuan >= 0 ? `"${selectCols[5]}"` : 'NULL'} as satuan_beli,
        ${idxHarga >= 0 ? `"${selectCols[6]}"` : '0'} as harga_beli,
        ${idxSuplier >= 0 ? `"${selectCols[7]}"` : 'NULL'} as suplier,
        ${idxPabrik >= 0 ? `"${selectCols[8]}"` : 'NULL'} as pabrik,
        ${idxLokasi >= 0 ? `"${selectCols[9]}"` : 'NULL'} as lokasi
      FROM dobat
      WHERE "${columns[idxKode]}" IS NOT NULL AND "${columns[idxKode]}" != ''
    `

    const sourceRows = tempDb.prepare(selectSql).all() as Array<{
      kode: string
      nama: string
      kategori: string | null
      stok: string | null
      stok_min: string | null
      satuan_beli: string | null
      harga_beli: string | null
      suplier: string | null
      pabrik: string | null
      lokasi: string | null
    }>

    tempDb.close()

    const insert = db.prepare(`
      INSERT OR REPLACE INTO obat (kode, nama, kategori, stok, stok_min, satuan_beli, harga_beli, suplier, pabrik, lokasi)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    let count = 0
    for (const row of sourceRows) {
      try {
        insert.run(
          row.kode,
          row.nama || '',
          row.kategori,
          parseFloat(row.stok || '0') || 0,
          parseFloat(row.stok_min || '0') || 0,
          row.satuan_beli,
          parseFloat(row.harga_beli || '0') || 0,
          row.suplier,
          row.pabrik,
          row.lokasi,
        )
        count++
      } catch {
        // skip
      }
    }

    return {
      success: true,
      imported: count,
      columnsFound: columns.length,
      parsedRows,
      mapped: {
        suplier: idxSuplier >= 0 ? columns[idxSuplier] : 'not found',
        pabrik: idxPabrik >= 0 ? columns[idxPabrik] : 'not found',
        kode: columns[idxKode],
      },
    }
  })
