import { useApi } from '../hooks/useApi'
import { QueryProvider } from './QueryProvider'

type OrderItem = { id: string; name: string; quantity: number; unitPrice: number }
type Order = { id: string; status: string; total: number; createdAt: string; updatedAt: string; items: OrderItem[] }
type OrdersResponse = { orders: Order[] }

const currency = new Intl.NumberFormat('id-ID', { currency: 'IDR', style: 'currency', maximumFractionDigits: 0 })

const statusMeta: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'rgba(234,179,8,0.1)', text: '#a16207', label: 'Menunggu Pembayaran' },
  paid: { bg: 'rgba(59,130,246,0.1)', text: '#1d4ed8', label: 'Dibayar' },
  fulfilled: { bg: 'rgba(34,197,94,0.1)', text: '#15803d', label: 'Selesai' },
  cancelled: { bg: 'rgba(239,68,68,0.1)', text: '#b91c1c', label: 'Dibatalkan' },
}

const noteFor = (s: string) => ({ pending: 'Menunggu pembayaran', paid: 'Pembayaran diterima, pesanan diproses', fulfilled: 'Pesanan selesai', cancelled: 'Pesanan dibatalkan' }[s] ?? s)

const border = '1px solid rgba(var(--primary), 0.2)'
const actionButton = 'px-5 py-2.5 text-xs font-bold uppercase tracking-widest cursor-pointer'

function OrderCard({ order }: { order: Order }) {
  const meta = statusMeta[order.status] ?? statusMeta.pending
  const isCancelled = order.status === 'cancelled'
  const canReview = order.status === 'fulfilled'
  const openTracking = () => {
    sessionStorage.setItem('tuneboss-tracking-id', order.id)
    window.location.href = '/tracking'
  }

  return (
    <div
      style={{ border, padding: '20px', background: 'var(--background)', opacity: isCancelled ? 0.6 : 1, filter: isCancelled ? 'grayscale(1)' : undefined }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{order.id}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold uppercase tracking-widest" style={{ background: meta.bg, color: meta.text }}>{meta.label}</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: 0 }}>{new Date(order.createdAt).toLocaleString('id-ID')}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '14px', color: 'var(--muted-foreground)', margin: '0 0 4px' }}>Total Amount</p>
          <p style={{ fontWeight: 700, color: 'var(--foreground)', margin: 0, textDecoration: isCancelled ? 'line-through' : undefined }}>{currency.format(order.total)}</p>
        </div>
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid rgba(127,127,127,0.15)', marginBottom: '16px' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {order.items.map((item) => <p key={item.id} style={{ fontSize: '14px', fontWeight: 500, color: 'var(--foreground)', margin: 0 }}>{item.quantity}x {item.name}</p>)}
          <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '4px 0 0' }}>{noteFor(order.status)}</p>
        </div>
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid rgba(127,127,127,0.15)', margin: '16px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
            <button type="button" onClick={openTracking} className={actionButton} style={{ border: '1px solid rgba(var(--primary), 0.2)', background: 'transparent', color: 'var(--foreground)' }}>Lacak Pesanan</button>
        {(order.status === 'pending' || canReview) && (
          <>
            {order.status === 'pending' ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); window.location.href = `/checkout/${order.id}?status=pending` }} className={actionButton} style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>Bayar Sekarang</button>
            ) : (
              <button type="button" onClick={(e) => { e.stopPropagation(); alert('Review feature coming soon') }} className={actionButton} style={{ border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)' }}>Beri Review</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function OrderHistoryList() {
  const { data, isLoading, error } = useApi<OrdersResponse>('/orders')

  if (isLoading) return <div style={{ textAlign: 'center', padding: '32px', color: 'var(--muted-foreground)' }}>Memuat riwayat pesanan...</div>
  if (error) return <div style={{ textAlign: 'center', padding: '32px', color: '#ef4444' }}>Gagal memuat riwayat pesanan.</div>

  const orders = data?.orders ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {orders.length === 0 ? (
        <div style={{ border, padding: '32px', textAlign: 'center', fontSize: '14px', color: 'var(--muted-foreground)' }}>Belum ada riwayat pesanan.</div>
      ) : orders.map((order) => <OrderCard key={order.id} order={order} />)}
    </div>
  )
}

export default function OrderHistoryWrapper() {
  return <QueryProvider><OrderHistoryList /></QueryProvider>
}
