import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getLowStockObat, getLowStockSuppliers, addToDraft } from '#/server/sp'
import { useState } from 'react'

export const Route = createFileRoute('/sp/low-stock')({
  component: LowStockPage,
})

type SortColumn = 'kode' | 'nama' | 'stok' | 'stok_min' | 'pabrik' | 'suplier'

function LowStockPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortColumn>('nama')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [supplierFilter, setSupplierFilter] = useState<string>('')
  const pageSize = 20

  const { data, isLoading } = useQuery({
    queryKey: ['low-stock', page, pageSize, sortBy, sortOrder, supplierFilter],
    queryFn: () =>
      getLowStockObat({
        data: {
          page,
          pageSize,
          sortBy,
          sortOrder,
          supplier: supplierFilter || undefined,
        },
      }),
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ['low-stock-suppliers'],
    queryFn: () => getLowStockSuppliers(),
  })

  const obat = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const addMutation = useMutation({
    mutationFn: (payload: {
      kode: string
      nama: string
      pabrik: string | null
      suplier: string | null
    }) => addToDraft({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft'] })
      alert('Berhasil ditambahkan ke draft SP. Silakan buka halaman Buat SP.')
    },
    onError: (err) => {
      console.error(err)
      alert('Gagal menambahkan ke draft')
    },
  })

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
    setPage(1)
  }

  const handleSupplierChange = (value: string) => {
    setSupplierFilter(value)
    setPage(1)
  }

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortBy !== column) return <span className="ml-1 text-gray-400">↕</span>
    return <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
  }

  if (isLoading) return <div className="p-6">Memuat data stok rendah...</div>

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">Obat di Bawah Stok Minimum</h1>
      <p className="mb-4 text-sm text-gray-600">
        Pilih obat untuk ditambahkan ke draft Surat Pemesanan. Menampilkan {total} obat.
      </p>

      <div className="mb-4 flex items-center gap-4">
        <label className="text-sm font-medium">Filter by Supplier:</label>
        <select
          value={supplierFilter}
          onChange={(e) => handleSupplierChange(e.target.value)}
          className="rounded border px-3 py-1.5 text-sm"
        >
          <option value="">Semua Supplier</option>
          {suppliers.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {obat.length === 0 ? (
        <div className="rounded border border-dashed p-8 text-center text-gray-500">
          Tidak ada obat di bawah stok minimum (atau data belum diimpor).
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="cursor-pointer px-3 py-2 text-left hover:bg-gray-100"
                    onClick={() => handleSort('kode')}
                  >
                    Kode <SortIcon column="kode" />
                  </th>
                  <th
                    className="cursor-pointer px-3 py-2 text-left hover:bg-gray-100"
                    onClick={() => handleSort('nama')}
                  >
                    Nama <SortIcon column="nama" />
                  </th>
                  <th
                    className="cursor-pointer px-3 py-2 text-left hover:bg-gray-100"
                    onClick={() => handleSort('stok')}
                  >
                    Stok <SortIcon column="stok" />
                  </th>
                  <th
                    className="cursor-pointer px-3 py-2 text-left hover:bg-gray-100"
                    onClick={() => handleSort('stok_min')}
                  >
                    Min <SortIcon column="stok_min" />
                  </th>
                  <th
                    className="cursor-pointer px-3 py-2 text-left hover:bg-gray-100"
                    onClick={() => handleSort('pabrik')}
                  >
                    Pabrik <SortIcon column="pabrik" />
                  </th>
                  <th
                    className="cursor-pointer px-3 py-2 text-left hover:bg-gray-100"
                    onClick={() => handleSort('suplier')}
                  >
                    Supplier <SortIcon column="suplier" />
                  </th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {obat.map((o) => (
                  <tr key={o.kode} className="border-t">
                    <td className="px-3 py-2">{o.kode}</td>
                    <td className="px-3 py-2">{o.nama}</td>
                    <td className="px-3 py-2">{o.stok}</td>
                    <td className="px-3 py-2">{o.stok_min}</td>
                    <td className="px-3 py-2">{o.pabrik || '-'}</td>
                    <td className="px-3 py-2">{o.suplier || '-'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() =>
                          addMutation.mutate({
                            kode: o.kode,
                            nama: o.nama,
                            pabrik: o.pabrik,
                            suplier: o.suplier,
                          })
                        }
                        disabled={addMutation.isPending}
                        className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {addMutation.isPending ? 'Menambahkan...' : 'Tambah ke SP'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <div className="text-gray-600">
                Halaman {page} dari {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded border px-3 py-1 disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded border px-3 py-1 disabled:opacity-50"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
