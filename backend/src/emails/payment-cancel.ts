import { getBaseEmail } from "./base.js";
import type { PaymentDetails } from "./payment-success.js";

export function getPaymentCancelEmail(name: string, details: PaymentDetails): string {
  const title = "Payment Cancelled - TuneBoss";
  const preheader = `Your order ${details.orderId} has been cancelled.`;

  const content = `
    <h2 class="title text-center">Hi ${name},</h2>
    <p class="text text-center">Your order with the details below has been <strong>cancelled</strong>:</p>
    
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
        <div class="details-label">Total</div>
        <div class="details-value">${details.total}</div>
      </div>
    </div>
    
    <p class="text">If you change your mind or want to order other products, please visit the TuneBoss Marketplace website.</p>
    
    <div class="text-center mt-6">
      <a href="https://tuneboss.id" class="btn">Shop Again</a>
    </div>
  `;
  
  return getBaseEmail(title, preheader, content);
}
