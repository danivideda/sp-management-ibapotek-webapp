export type SpStatus = 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled'

export interface SpItem {
  id: string
  name: string
  quantity: number
  unit: string
  price: number
  note?: string
}

export interface SuratPemesanan {
  id: string
  number: string
  date: string
  supplier: string
  status: SpStatus
  items: SpItem[]
  notes?: string
  createdAt: string
  updatedAt: string
}
