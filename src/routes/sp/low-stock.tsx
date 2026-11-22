import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getLowStockObat, addToDraft } from '#/server/sp'

export const Route = createFileRoute('/sp/low-stock')({
  component: LowStockPage,
})

function LowStockPage() {
  const queryClient = useQueryClient()
  const { data: obat = [], isLoading } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => getLowStockObat(),
  })

  const addMutation = useMutation({
    mutationFn: addToDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft'] })
    },
  })

  if (isLoading) return <div className="p-6">Memuat data stok rendah...</div>

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">Obat di Bawah Stok Minimum</h1>
      <p className="mb-4 text-sm text-gray-600">
        Pilih obat untuk ditambahkan ke draft Surat Pemesanan.
      </p>

      {obat.length === 0 ? (
        <div className="rounded border border-dashed p-8 text-center text-gray-500">
          Tidak ada obat di bawah stok minimum (atau data belum diimpor).
        </div>
      ) : (
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
                      className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                    >
                      Tambah ke SP
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
