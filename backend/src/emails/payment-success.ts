import { getBaseEmail } from "./base.js";

export interface OrderItem {
  name: string;
  quantity: number;
  price: string;
}

export interface PaymentDetails {
  orderId: string;
  date: string;
  total: string;
  method: string;
  items?: OrderItem[];
}

export function getPaymentSuccessEmail(name: string, details: PaymentDetails): string {
  const title = "Payment Successful - TuneBoss";
  const preheader = `Payment for order ${details.orderId} has been successfully confirmed.`;
  
  let itemsHtml = "";
  if (details.items && details.items.length > 0) {
    itemsHtml = `
      <table class="invoice-table">
        <thead>
          <tr>
            <th>Product</th>
            <th style="text-align: right;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${details.items.map(item => `
            <tr>
              <td>
                <div class="item-name">${item.name}</div>
                <div class="item-meta">Qty: ${item.quantity}</div>
              </td>
              <td class="item-price">${item.price}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  const content = `
    <h2 class="title text-center">Hi ${name},</h2>
    <p class="text text-center">Thank you for your order. We have received your payment and your order is currently being processed.</p>
    
    <div class="details-box">
      <div class="details-row">
        <div class="details-label">Order ID</div>
        <div class="details-value">${details.orderId}</div>
      </div>
      <div class="details-row">
        <div class="details-label">Date</div>
        <div class="details-value">${details.date}</div>
      </div>
      <div class="details-row">
        <div class="details-label">Payment Method</div>
        <div class="details-value">${details.method}</div>
      </div>
    </div>
    
    ${itemsHtml}
    
    <table class="invoice-summary">
      <tr class="invoice-total">
        <td class="summary-label">Total</td>
        <td>${details.total}</td>
      </tr>
    </table>
    
    <div class="text-center mt-6">
      <a href="https://tuneboss.co.id/orders/${details.orderId}" class="btn">View Order Details</a>
    </div>
  `;
  
  return getBaseEmail(title, preheader, content);
}
