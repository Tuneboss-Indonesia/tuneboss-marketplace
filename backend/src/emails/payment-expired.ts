import { getBaseEmail } from "./base.js";
import type { PaymentDetails } from "./payment-success.js";

export function getPaymentExpiredEmail(name: string, details: PaymentDetails): string {
  const title = "Payment Expired - TuneBoss";
  const preheader = `The payment time for order ${details.orderId} has expired.`;

  const content = `
    <h2 class="title text-center">Hi ${name},</h2>
    <p class="text text-center">The payment deadline for your order has <strong>expired</strong>. This order has now been automatically cancelled.</p>
    
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
    
    <p class="text">Don't worry, you can create a new order for the same products if you still want to proceed.</p>
    
    <div class="text-center mt-6">
      <a href="https://tuneboss.id" class="btn">Create New Order</a>
    </div>
  `;
  
  return getBaseEmail(title, preheader, content);
}
