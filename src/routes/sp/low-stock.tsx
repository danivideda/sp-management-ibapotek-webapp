import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getLowStockObat, addToDraft } from '#/server/sp'
import { useState } from 'react'

export const Route = createFileRoute('/sp/low-stock')({
  component: LowStockPage,
})

function LowStockPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const pageSize = 20

  const { data, isLoading } = useQuery({
    queryKey: ['low-stock', page, pageSize],
    queryFn: () => getLowStockObat({ data: { page, pageSize } }),
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

  if (isLoading) return <div className="p-6">Memuat data stok rendah...</div>

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">Obat di Bawah Stok Minimum</h1>
      <p className="mb-4 text-sm text-gray-600">
        Pilih obat untuk ditambahkan ke draft Surat Pemesanan. Menampilkan {total} obat.
      </p>

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
                  <th className="px-3 py-2 text-left">Kode</th>
                  <th className="px-3 py-2 text-left">Nama</th>
                  <th className="px-3 py-2 text-left">Stok</th>
                  <th className="px-3 py-2 text-left">Min</th>
                  <th className="px-3 py-2 text-left">Pabrik</th>
                  <th className="px-3 py-2 text-left">Supplier</th>
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
