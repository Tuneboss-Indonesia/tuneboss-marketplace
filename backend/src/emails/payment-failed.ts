import { getBaseEmail } from "./base.js";
import type { PaymentDetails } from "./payment-success.js";

export function getPaymentFailedEmail(name: string, details: PaymentDetails): string {
  const title = "Payment Failed - TuneBoss";
  const preheader = `Payment for order ${details.orderId} failed to process.`;

  const content = `
    <h2 class="title text-center">Hi ${name},</h2>
    <p class="text text-center">We're sorry, but the payment for your order <strong>failed to process</strong>. The transaction could not be completed at this time.</p>
    
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
    
    <p class="text">Please ensure you have sufficient balance/limit and the entered information is correct. You can try to make the payment again by returning to your cart.</p>
    
    <div class="text-center mt-6">
      <a href="https://tuneboss.id/cart" class="btn">Return to Cart</a>
    </div>
  `;
  
  return getBaseEmail(title, preheader, content);
}
