import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { importFromSqlDump } from '#/server/import'
import { useState } from 'react'

export const Route = createFileRoute('/sp/import')({
  component: ImportPage,
})

function ImportPage() {
  const [result, setResult] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: () => importFromSqlDump({ data: {} }),
    onSuccess: (res) => {
      if (res.success) setResult(`Berhasil impor ${res.imported} obat`)
      else setResult(`Gagal: ${res.error}`)
    },
  })

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">Impor Data dari iB Apotek</h1>
      <p className="mb-4 text-sm text-gray-600">
        Letakkan file dump SQL Anda di <code>data/ibapotek.sql</code>, lalu klik tombol di bawah.
        Hanya tabel <code>dobat</code> yang diimpor ke SQLite lokal.
      </p>
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {mutation.isPending ? 'Mengimpor...' : 'Impor dobat dari SQL dump'}
      </button>
      {result && <p className="mt-4 text-sm">{result}</p>}
    </div>
  )
}
