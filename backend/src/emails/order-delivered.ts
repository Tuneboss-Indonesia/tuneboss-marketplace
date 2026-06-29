import { getBaseEmail } from "./base.js";
import type { PaymentDetails } from "./payment-success.js";

export function getOrderDeliveredEmail(name: string, details: PaymentDetails): string {
  const title = "Order Delivered - TuneBoss";
  const preheader = `Your order ${details.orderId} has been successfully delivered.`;

  const content = `
    <h2 class="title text-center">Hi ${name},</h2>
    <p class="text text-center">Your order has <strong>successfully arrived</strong>. We hope you love your new TuneBoss gear!</p>
    
    <div class="details-box">
      <div class="details-row">
        <div class="details-label">Order ID</div>
        <div class="details-value">${details.orderId}</div>
      </div>
      <div class="details-row">
        <div class="details-label">Date Received</div>
        <div class="details-value">${details.date}</div>
      </div>
    </div>
    
    <p class="text text-center">Please take a moment to leave a review and let us know what you think about our product.</p>
    
    <div class="text-center mt-6">
      <a href="https://tuneboss.co.id/account/history" class="btn">Leave a Review</a>
    </div>
  `;
  
  return getBaseEmail(title, preheader, content);
}
