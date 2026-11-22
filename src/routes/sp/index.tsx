import { createFileRoute, Link } from '@tanstack/react-router'
import { SuratPemesanan } from '#/types/sp'

export const Route = createFileRoute('/sp/')({
  component: SpListPage,
})

function SpListPage() {
  // Placeholder data — will be replaced with real store / server function
  const orders: SuratPemesanan[] = []

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Surat Pemesanan</h1>
        <Link
          to="/sp/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Buat SP Baru
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-gray-500">
          Belum ada Surat Pemesanan. Mulai dengan membuat yang baru atau impor data dari iB Apotek.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="min-w-full divide-y">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nomor</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {orders.map((sp) => (
                <tr key={sp.id}>
                  <td className="px-4 py-3 text-sm">{sp.number}</td>
                  <td className="px-4 py-3 text-sm">{sp.date}</td>
                  <td className="px-4 py-3 text-sm">{sp.supplier}</td>
                  <td className="px-4 py-3 text-sm">{sp.status}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    <Link to="/sp/$id" params={{ id: sp.id }} className="text-blue-600 hover:underline">
                      Detail
                    </Link>
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
