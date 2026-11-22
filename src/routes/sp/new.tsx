import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sp/new')({
  component: NewSpPage,
})

function NewSpPage() {
  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">Buat Surat Pemesanan Baru</h1>
      <p className="text-gray-600">Form untuk membuat SP baru akan segera hadir.</p>
    </div>
  )
}
