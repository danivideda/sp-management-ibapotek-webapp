import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'data', 'sp-management.db')

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
}

export const db = new Database(DB_PATH)

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS obat (
    kode TEXT PRIMARY KEY,
    nama TEXT,
    kategori TEXT,
    stok REAL DEFAULT 0,
    stok_min REAL DEFAULT 0,
    satuan_beli TEXT,
    harga_beli REAL,
    suplier TEXT,
    pabrik TEXT,
    lokasi TEXT
  );

  CREATE TABLE IF NOT EXISTS sp_draft (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode_obat TEXT NOT NULL,
    nama TEXT,
    qty REAL DEFAULT 1,
    pabrik TEXT,
    suplier TEXT,
    added_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS surat_pemesanan (
    id TEXT PRIMARY KEY,
    number TEXT,
    date TEXT,
    pabrik TEXT,
    suplier TEXT,
    status TEXT DEFAULT 'draft',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sp_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sp_id TEXT NOT NULL,
    kode_obat TEXT,
    nama TEXT,
    qty REAL,
    unit TEXT,
    price REAL,
    FOREIGN KEY (sp_id) REFERENCES surat_pemesanan(id)
  );
`)

export type ObatRow = {
  kode: string
  nama: string
  kategori: string | null
  stok: number
  stok_min: number
  satuan_beli: string | null
  harga_beli: number | null
  suplier: string | null
  pabrik: string | null
  lokasi: string | null
}
