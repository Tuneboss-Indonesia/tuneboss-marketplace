import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../hooks/useApi'
import { QueryProvider } from './QueryProvider'

type SummaryResponse = {
  summary: {
    activeProducts: number
    cancelledOrders: number
    fulfilledOrders: number
    lowStockProducts: number
    paidOrders: number
    pendingOrders: number
    revenue: number
    totalCustomers: number
    totalOrders: number
    totalProducts: number
  }
}
type Product = { id: string; name: string; sku: string; stock: number; priceValue: number }
type LowStockResponse = { products: Product[]; threshold: number }
type ExpireResponse = { expired: Array<{ id: string }> }

const API = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000/api'
const currency = new Intl.NumberFormat('id-ID', { currency: 'IDR', style: 'currency', maximumFractionDigits: 0 })

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-primary/20 bg-background p-5">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-foreground/50">{label}</p>
      <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
    </div>
  )
}

function AdminDashboard() {
  const qc = useQueryClient()
  const summary = useApi<SummaryResponse>('/admin/summary')
  const lowStock = useApi<LowStockResponse>('/admin/products/low-stock?threshold=5&limit=8')
  const expirePending = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/admin/orders/expire-pending`, { credentials: 'include', method: 'POST' })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.message || 'Gagal membersihkan pending order.')
      return body as ExpireResponse
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/admin/summary'] })
      qc.invalidateQueries({ queryKey: ['/admin/products/low-stock?threshold=5&limit=8'] })
    },
  })

  if (summary.error) return <div className="border border-red-500/30 p-6 text-sm text-red-500">Akses admin diperlukan atau dashboard gagal dimuat.</div>
  if (summary.isLoading) return <div className="p-8 text-center text-sm text-foreground/60">Memuat dashboard admin...</div>

  const s = summary.data?.summary
  if (!s) return null

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Revenue" value={currency.format(s.revenue)} />
        <Card label="Pending Orders" value={s.pendingOrders} />
        <Card label="Paid Orders" value={s.paidOrders} />
        <Card label="Low Stock" value={s.lowStockProducts} />
        <Card label="Total Orders" value={s.totalOrders} />
        <Card label="Customers" value={s.totalCustomers} />
        <Card label="Products" value={s.totalProducts} />
        <Card label="Fulfilled" value={s.fulfilledOrders} />
      </div>

      <div className="flex flex-col gap-3 border border-primary/20 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-widest text-foreground">Expired Pending Cleanup</h2>
          <p className="mt-1 text-sm text-foreground/60">Webhook Xendit tetap utama; tombol ini fallback manual untuk pending order yang stuck.</p>
        </div>
        <button
          className="bg-primary px-5 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-60"
          disabled={expirePending.isPending}
          onClick={() => expirePending.mutate()}
          type="button"
        >
          {expirePending.isPending ? 'Membersihkan...' : 'Expire Pending'}
        </button>
      </div>
      {expirePending.data && <p className="text-sm text-foreground/60">Expired: {expirePending.data.expired.length} order.</p>}
      {expirePending.error && <p className="text-sm text-red-500">{expirePending.error.message}</p>}

      <section className="border border-primary/20 p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold uppercase tracking-widest text-foreground">Low Stock</h2>
          <span className="text-xs font-bold uppercase tracking-widest text-foreground/50">Threshold {lowStock.data?.threshold ?? 5}</span>
        </div>
        <div className="space-y-3">
          {(lowStock.data?.products ?? []).length === 0 ? (
            <p className="text-sm text-foreground/60">Tidak ada produk low stock.</p>
          ) : lowStock.data?.products.map((product) => (
            <div key={product.id} className="flex items-center justify-between gap-4 border-b border-primary/10 pb-3 text-sm last:border-0 last:pb-0">
              <div>
                <p className="font-bold text-foreground">{product.name}</p>
                <p className="text-xs text-foreground/50">{product.sku}</p>
              </div>
              <p className="font-bold text-primary">Stock {product.stock}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default function AdminDashboardWrapper() {
  return <QueryProvider><AdminDashboard /></QueryProvider>
}
