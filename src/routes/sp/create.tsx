import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDraftItems, createSpFromDraft } from '#/server/sp'
import { useState } from 'react'

export const Route = createFileRoute('/sp/create')({
  component: CreateSpPage,
})

function CreateSpPage() {
  const queryClient = useQueryClient()
  const { data: draft = [] } = useQuery({
    queryKey: ['draft'],
    queryFn: () => getDraftItems(),
  })

  const createMutation = useMutation({
    mutationFn: (payload: {
      pabrik: string
      suplier: string
      items: Array<{ kode: string; nama: string; qty: number }>
    }) => createSpFromDraft({ data: payload }),
    onSuccess: (res) => {
      alert(`SP berhasil dibuat: ${res.number}`)
      queryClient.invalidateQueries({ queryKey: ['draft'] })
    },
    onError: (err) => {
      console.error(err)
      alert('Gagal membuat SP')
    },
  })

  // Group by pabrik
  const grouped = draft.reduce((acc: Record<string, any[]>, item: any) => {
    const key = item.pabrik || 'Tanpa Pabrik'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">Buat Surat Pemesanan</h1>
      <p className="mb-6 text-sm text-gray-600">
        Item dikelompokkan berdasarkan Pabrik. Anda dapat mengubah supplier sebelum membuat SP.
      </p>

      {Object.keys(grouped).length === 0 ? (
        <div className="rounded border border-dashed p-8 text-center text-gray-500">
          Draft kosong. Tambahkan obat dari halaman Stok Rendah.
        </div>
      ) : (
        Object.entries(grouped).map(([pabrik, items]) => (
          <GroupCard
            key={pabrik}
            pabrik={pabrik}
            items={items}
            onCreate={(suplier) =>
              createMutation.mutate({
                pabrik,
                suplier,
                items: items.map((i: any) => ({ kode: i.kode_obat, nama: i.nama, qty: i.qty })),
              })
            }
          />
        ))
      )}
    </div>
  )
}

function GroupCard({ pabrik, items, onCreate }: { pabrik: string; items: any[]; onCreate: (suplier: string) => void }) {
  const [suplier, setSuplier] = useState(items[0]?.suplier || '')

  return (
    <div className="mb-6 rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">Pabrik: {pabrik}</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm">Supplier:</label>
          <input
            value={suplier}
            onChange={(e) => setSuplier(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
            placeholder="Ubah supplier"
          />
          <button
            onClick={() => onCreate(suplier)}
            className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
          >
            Buat SP untuk Pabrik ini
          </button>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="pb-1">Kode</th>
            <th className="pb-1">Nama</th>
            <th className="pb-1">Qty</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t">
              <td className="py-1">{item.kode_obat}</td>
              <td className="py-1">{item.nama}</td>
              <td className="py-1">{item.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
