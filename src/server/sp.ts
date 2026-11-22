import { createServerFn } from '@tanstack/react-start'
import { db, type ObatRow } from '#/db'

const ALLOWED_SORT_COLUMNS = ['kode', 'nama', 'stok', 'stok_min', 'pabrik', 'suplier'] as const
type SortColumn = (typeof ALLOWED_SORT_COLUMNS)[number]

export const getLowStockObat = createServerFn({ method: 'GET' })
  .validator(
    (
      data:
        | {
            page?: number
            pageSize?: number
            sortBy?: string
            sortOrder?: 'asc' | 'desc'
            supplier?: string
          }
        | undefined,
    ) => data ?? {},
  )
  .handler(async ({ data }) => {
    const page = Math.max(1, data.page ?? 1)
    const pageSize = Math.min(100, Math.max(10, data.pageSize ?? 20))
    const offset = (page - 1) * pageSize

    const sortBy: SortColumn = ALLOWED_SORT_COLUMNS.includes(data.sortBy as SortColumn)
      ? (data.sortBy as SortColumn)
      : 'nama'
    const sortOrder = data.sortOrder === 'desc' ? 'DESC' : 'ASC'

    let whereClause = `WHERE CAST(stok AS REAL) < CAST(stok_min AS REAL)`
    const params: (string | number)[] = []

    if (data.supplier) {
      if (data.supplier === 'Tanpa Supplier') {
        whereClause += ` AND (suplier IS NULL OR suplier = '')`
      } else {
        whereClause += ` AND suplier = ?`
        params.push(data.supplier)
      }
    }

    const totalStmt = db.prepare(`SELECT COUNT(*) as count FROM obat ${whereClause}`)
    const total = totalStmt.get(...params) as { count: number }

    const rowsStmt = db.prepare<[], ObatRow>(`
      SELECT * FROM obat
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `)
    const rows = rowsStmt.all(...params, pageSize, offset)

    return {
      items: rows,
      page,
      pageSize,
      total: total.count,
      totalPages: Math.ceil(total.count / pageSize),
    }
  })

export const getLowStockSuppliers = createServerFn({ method: 'GET' }).handler(async () => {
  const rows = db
    .prepare(
      `
      SELECT DISTINCT suplier FROM obat
      WHERE CAST(stok AS REAL) < CAST(stok_min AS REAL)
      ORDER BY suplier
    `,
    )
    .all() as { suplier: string | null }[]

  const suppliers = rows.map((r) => r.suplier || 'Tanpa Supplier')
  return [...new Set(suppliers)].sort((a, b) => a.localeCompare(b))
})

export const addToDraft = createServerFn({ method: 'POST' })
  .validator((data: { kode: string; nama: string; pabrik: string | null; suplier: string | null }) => data)
  .handler(async ({ data }) => {
    db.prepare(`
      INSERT INTO sp_draft (kode_obat, nama, pabrik, suplier)
      VALUES (?, ?, ?, ?)
    `).run(data.kode, data.nama, data.pabrik, data.suplier)
    return { success: true }
  })

export const getDraftItems = createServerFn({ method: 'GET' }).handler(async () => {
  return db.prepare(`SELECT * FROM sp_draft ORDER BY suplier, nama`).all()
})

export const deleteDraftItem = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    db.prepare(`DELETE FROM sp_draft WHERE id = ?`).run(data.id)
    return { success: true }
  })

export const deleteDraftBySupplier = createServerFn({ method: 'POST' })
  .validator((data: { suplier: string }) => data)
  .handler(async ({ data }) => {
    if (data.suplier === 'Tanpa Supplier') {
      db.prepare(`DELETE FROM sp_draft WHERE suplier IS NULL OR suplier = ''`).run()
    } else {
      db.prepare(`DELETE FROM sp_draft WHERE suplier = ?`).run(data.suplier)
    }
    return { success: true }
  })

export const clearAllDraft = createServerFn({ method: 'POST' }).handler(async () => {
  db.prepare(`DELETE FROM sp_draft`).run()
  return { success: true }
})

export const createSpFromDraft = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      suplier: string
      items: Array<{ kode: string; nama: string; qty: number }>
      pabrik?: string | null
    }) => data,
  )
  .handler(async ({ data }) => {
    const id = crypto.randomUUID()
    const number = `SP-${Date.now()}`
    db.prepare(`
      INSERT INTO surat_pemesanan (id, number, date, pabrik, suplier, status)
      VALUES (?, ?, date('now'), ?, ?, 'draft')
    `).run(id, number, data.pabrik ?? null, data.suplier)

    const insertItem = db.prepare(`
      INSERT INTO sp_items (sp_id, kode_obat, nama, qty, unit, price)
      VALUES (?, ?, ?, ?, 'Pcs', 0)
    `)
    for (const item of data.items) {
      insertItem.run(id, item.kode, item.nama, item.qty)
    }

    // Clear draft for this supplier
    if (data.suplier === 'Tanpa Supplier') {
      db.prepare(`DELETE FROM sp_draft WHERE suplier IS NULL OR suplier = ''`).run()
    } else {
      db.prepare(`DELETE FROM sp_draft WHERE suplier = ?`).run(data.suplier)
    }

    return { id, number }
  })
