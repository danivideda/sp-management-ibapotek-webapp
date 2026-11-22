import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getDraftItems,
  createSpFromDraft,
  deleteDraftItem,
  deleteDraftBySupplier,
  clearAllDraft,
} from '#/server/sp'
import { useState } from 'react'

export const Route = createFileRoute('/sp/create')({
  component: CreateSpPage,
})

function CreateSpPage() {
  const queryClient = useQueryClient()
  const { data: draft = [], isLoading, refetch } = useQuery({
    queryKey: ['draft'],
    queryFn: () => getDraftItems(),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const createMutation = useMutation({
    mutationFn: (payload: {
      suplier: string
      items: Array<{ kode: string; nama: string; qty: number }>
      pabrik?: string | null
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

  const deleteItemMutation = useMutation({
    mutationFn: (id: number) => deleteDraftItem({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft'] })
    },
    onError: () => alert('Gagal menghapus item'),
  })

  const deleteBySupplierMutation = useMutation({
    mutationFn: (suplier: string) => deleteDraftBySupplier({ data: { suplier } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft'] })
    },
    onError: () => alert('Gagal menghapus item supplier'),
  })

  const clearAllMutation = useMutation({
    mutationFn: () => clearAllDraft(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft'] })
    },
    onError: () => alert('Gagal mengosongkan draft'),
  })

  // Group by supplier
  const grouped = draft.reduce((acc: Record<string, any[]>, item: any) => {
    const key = item.suplier || 'Tanpa Supplier'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  if (isLoading) return <div className="p-6">Memuat draft...</div>

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Buat Surat Pemesanan</h1>
        {Object.keys(grouped).length > 0 && (
          <button
            onClick={() => {
              if (confirm('Hapus semua item dari draft?')) {
                clearAllMutation.mutate()
              }
            }}
            disabled={clearAllMutation.isPending}
            className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            {clearAllMutation.isPending ? 'Menghapus...' : 'Clear All Draft'}
          </button>
        )}
      </div>
      <p className="mb-6 text-sm text-gray-600">
        Item dikelompokkan berdasarkan Supplier. Anda dapat mengubah supplier sebelum membuat SP.
      </p>
      <button
        onClick={() => refetch()}
        className="mb-4 rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300"
      >
        Refresh Draft
      </button>

      {Object.keys(grouped).length === 0 ? (
        <div className="rounded border border-dashed p-8 text-center text-gray-500">
          Draft kosong. Tambahkan obat dari halaman Stok Rendah.
        </div>
      ) : (
        Object.entries(grouped).map(([suplier, items]) => (
          <GroupCard
            key={suplier}
            suplier={suplier}
            items={items}
            onCreate={(finalSuplier) =>
              createMutation.mutate({
                suplier: finalSuplier,
                items: items.map((i: any) => ({ kode: i.kode_obat, nama: i.nama, qty: i.qty })),
                pabrik: items[0]?.pabrik ?? null,
              })
            }
            onDeleteItem={(id) => deleteItemMutation.mutate(id)}
            onDeleteAll={() => {
              if (confirm(`Hapus semua item untuk supplier "${suplier}"?`)) {
                deleteBySupplierMutation.mutate(suplier)
              }
            }}
            isDeletingItem={deleteItemMutation.isPending}
            isDeletingAll={deleteBySupplierMutation.isPending}
          />
        ))
      )}
    </div>
  )
}

function GroupCard({
  suplier,
  items,
  onCreate,
  onDeleteItem,
  onDeleteAll,
  isDeletingItem,
  isDeletingAll,
}: {
  suplier: string
  items: any[]
  onCreate: (suplier: string) => void
  onDeleteItem: (id: number) => void
  onDeleteAll: () => void
  isDeletingItem: boolean
  isDeletingAll: boolean
}) {
  const [editSuplier, setEditSuplier] = useState(suplier === 'Tanpa Supplier' ? '' : suplier)

  return (
    <div className="mb-6 rounded-lg border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Supplier: {suplier}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm">Supplier:</label>
          <input
            value={editSuplier}
            onChange={(e) => setEditSuplier(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
            placeholder="Ubah supplier"
          />
          <button
            onClick={() => onCreate(editSuplier || suplier)}
            className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
          >
            Buat SP untuk Supplier ini
          </button>
          <button
            onClick={onDeleteAll}
            disabled={isDeletingAll}
            className="rounded bg-orange-600 px-3 py-1 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {isDeletingAll ? 'Menghapus...' : 'Hapus Semua'}
          </button>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="pb-1">Kode</th>
            <th className="pb-1">Nama</th>
            <th className="pb-1">Qty</th>
            <th className="pb-1 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t">
              <td className="py-1">{item.kode_obat}</td>
              <td className="py-1">{item.nama}</td>
              <td className="py-1">{item.qty}</td>
              <td className="py-1 text-right">
                <button
                  onClick={() => onDeleteItem(item.id)}
                  disabled={isDeletingItem}
                  className="rounded bg-red-500 px-2 py-0.5 text-xs text-white hover:bg-red-600 disabled:opacity-50"
                >
                  Hapus
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
