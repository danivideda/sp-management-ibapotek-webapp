import { createServerFn } from '@tanstack/react-start'
import { db } from '#/db'
import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

/**
 * Extracts real column names from CREATE TABLE `dobat` (only column definitions, not keys/indexes).
 */
function extractDobatColumns(content: string): string[] | null {
  const createMatch = content.match(/CREATE TABLE `dobat`\s*\(([\s\S]*?)\)\s*ENGINE/i)
  if (!createMatch) return null

  const colDefs = createMatch[1]
  const columns: string[] = []
  const colRegex = /`([^`]+)`\s+[a-zA-Z]/g
  let m: RegExpExecArray | null
  while ((m = colRegex.exec(colDefs)) !== null) {
    columns.push(m[1])
  }
  return columns.length > 0 ? columns : null
}

/**
 * Extract full INSERT INTO `dobat` ... ; statements (handles ; inside strings).
 */
function extractInsertStatements(content: string): string[] {
  const results: string[] = []
  const insertRegex = /INSERT INTO `dobat`\s+VALUES\s*/gi
  let match: RegExpExecArray | null

  while ((match = insertRegex.exec(content)) !== null) {
    let i = match.index
    const len = content.length
    let inString = false
    let escape = false

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
        results.push(content.slice(match.index, i + 1))
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

/**
 * Minimal adaptation of MySQL INSERT to SQLite-compatible SQL.
 * Removes backticks and leaves the VALUES as-is (SQLite is flexible).
 */
function adaptInsertForSqlite(stmt: string): string {
  return stmt.replace(/INSERT INTO `dobat`/gi, 'INSERT INTO dobat')
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

    const insertStatements = extractInsertStatements(content)
    if (insertStatements.length === 0) {
      return { success: false, error: 'No dobat INSERT found in dump' }
    }

    // Temporary in-memory SQLite — let SQLite parse the data
    const tempDb = new Database(':memory:')
    const colList = columns.map((c) => `"${c}" TEXT`).join(', ')
    tempDb.exec(`CREATE TABLE dobat (${colList})`)

    let executed = 0
    for (const stmt of insertStatements) {
      try {
        const adapted = adaptInsertForSqlite(stmt)
        tempDb.exec(adapted)
        executed++
      } catch (e) {
        // continue with other statements if one fails
        console.error('Failed to exec insert statement:', e)
      }
    }

    // Query by column name
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

    const selectSql = `
      SELECT
        "${columns[idxKode]}" as kode,
        ${idxNama >= 0 ? `"${columns[idxNama]}"` : "''"} as nama,
        ${idxKategori >= 0 ? `"${columns[idxKategori]}"` : 'NULL'} as kategori,
        ${idxStok >= 0 ? `"${columns[idxStok]}"` : '0'} as stok,
        ${idxStokMin >= 0 ? `"${columns[idxStokMin]}"` : '0'} as stok_min,
        ${idxSatuan >= 0 ? `"${columns[idxSatuan]}"` : 'NULL'} as satuan_beli,
        ${idxHarga >= 0 ? `"${columns[idxHarga]}"` : '0'} as harga_beli,
        ${idxSuplier >= 0 ? `"${columns[idxSuplier]}"` : 'NULL'} as suplier,
        ${idxPabrik >= 0 ? `"${columns[idxPabrik]}"` : 'NULL'} as pabrik,
        ${idxLokasi >= 0 ? `"${columns[idxLokasi]}"` : 'NULL'} as lokasi
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

    // Debug helper: look up the specific problem row if present
    let ok000211Debug: { kode?: string; suplier?: string | null; columns?: string[] } | null = null
    try {
      const debugRow = tempDb
        .prepare(`SELECT * FROM dobat WHERE "${columns[idxKode]}" = 'OK000211'`)
        .get() as Record<string, unknown> | undefined
      if (debugRow) {
        ok000211Debug = {
          kode: String(debugRow[columns[idxKode]] ?? ''),
          suplier: idxSuplier >= 0 ? (debugRow[columns[idxSuplier]] as string | null) : null,
          columns,
        }
      }
    } catch {
      // ignore
    }

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
      insertStatementsExecuted: executed,
      mapped: {
        suplier: idxSuplier >= 0 ? columns[idxSuplier] : 'not found',
        pabrik: idxPabrik >= 0 ? columns[idxPabrik] : 'not found',
        kode: columns[idxKode],
      },
      debugOk000211: ok000211Debug,
    }
  })
