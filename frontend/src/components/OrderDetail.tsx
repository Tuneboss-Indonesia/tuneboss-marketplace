import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../hooks/useApi'
import { QueryProvider } from './QueryProvider'

type OrderItem = { id: string; name: string; quantity: number; unitPrice: number }
type Order = {
  courier: string
  createdAt: string
  deliveredAt?: string | null
  id: string
  items: OrderItem[]
  paymentExpiresAt?: string | null
  paymentInvoiceStatus?: string
  paymentInvoiceUrl?: string
  shippedAt?: string | null
  status: string
  total: number
  trackingNumber: string
}
type OrderResponse = { order: Order }

const API = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000/api'
const currency = new Intl.NumberFormat('id-ID', { currency: 'IDR', style: 'currency', maximumFractionDigits: 0 })
const actionButton = 'px-5 py-2.5 text-xs font-bold uppercase tracking-widest cursor-pointer'

function OrderDetail({ id }: { id: string }) {
  const qc = useQueryClient()
  const { data, isLoading, error } = useApi<OrderResponse>(`/orders/${id}`)
  const order = data?.order
  const cancelOrder = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/orders/${id}/cancel`, { method: 'POST', credentials: 'include' })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Gagal membatalkan pesanan.')
      return r.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/orders/${id}`] }),
  })
  const createInvoice = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/payments/xendit/invoice`, {
        body: JSON.stringify({ orderId: id }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.message || 'Gagal membuat invoice.')
      return body as { invoice_url?: string }
    },
    onSuccess: (body) => { if (body.invoice_url) window.location.href = body.invoice_url },
  })

  if (isLoading) return <div className="p-8 text-center text-sm text-foreground/60">Memuat pesanan...</div>
  if (error || !order) return <div className="p-8 text-center text-sm text-red-500">Pesanan tidak ditemukan.</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border border-primary/20 p-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Order ID</p>
          <h2 className="mt-2 break-all text-xl font-bold text-foreground">{order.id}</h2>
          <p className="mt-2 text-sm text-foreground/60">{new Date(order.createdAt).toLocaleString('id-ID')}</p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-foreground/50">Status</p>
          <p className="mt-2 text-lg font-bold uppercase text-primary">{order.status}</p>
          <p className="mt-1 text-sm text-foreground/60">{currency.format(order.total)}</p>
        </div>
      </div>

      <div className="border border-primary/20 p-5">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-foreground">Item Pesanan</h3>
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-4 border-b border-primary/10 pb-3 text-sm last:border-0 last:pb-0">
              <span>{item.quantity}x {item.name}</span>
              <span className="font-bold">{currency.format(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
        </div>
      </div>

      {(order.courier || order.trackingNumber || order.shippedAt || order.deliveredAt) && (
        <div className="border border-primary/20 p-5 text-sm text-foreground/70">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-foreground">Pengiriman</h3>
          {order.courier && <p>Kurir: <strong>{order.courier}</strong></p>}
          {order.trackingNumber && <p>Resi: <strong>{order.trackingNumber}</strong></p>}
          {order.shippedAt && <p>Dikirim: {new Date(order.shippedAt).toLocaleString('id-ID')}</p>}
          {order.deliveredAt && <p>Diterima: {new Date(order.deliveredAt).toLocaleString('id-ID')}</p>}
        </div>
      )}

      {order.paymentInvoiceUrl && order.status === 'pending' && <a className={actionButton} href={order.paymentInvoiceUrl} style={{ background: 'var(--primary)', color: '#fff', display: 'inline-block', textDecoration: 'none' }}>Buka Invoice</a>}
      <div className="flex flex-wrap gap-3">
        {order.status === 'pending' && (
          <>
            <button disabled={createInvoice.isPending} onClick={() => createInvoice.mutate()} className={actionButton} style={{ background: 'var(--primary)', color: '#fff', border: 0, opacity: createInvoice.isPending ? 0.6 : 1 }}>Bayar Sekarang</button>
            <button disabled={cancelOrder.isPending} onClick={() => { if (confirm('Batalkan pesanan ini?')) cancelOrder.mutate() }} className={actionButton} style={{ border: '1px solid #ef4444', color: '#ef4444', background: 'transparent', opacity: cancelOrder.isPending ? 0.6 : 1 }}>Batalkan Pesanan</button>
          </>
        )}
        <a href="/account/history" className={actionButton} style={{ border: '1px solid rgba(var(--primary), 0.2)', color: 'var(--foreground)', textDecoration: 'none' }}>Kembali</a>
      </div>
    </div>
  )
}

export default function OrderDetailWrapper({ id }: { id: string }) {
  return <QueryProvider><OrderDetail id={id} /></QueryProvider>
}
