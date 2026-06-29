import { getBaseEmail } from "./base.js";
import type { PaymentDetails } from "./payment-success.js";

export function getOrderShippedEmail(name: string, details: PaymentDetails & { courier: string }): string {
  const title = "Order Shipped - TuneBoss";
  const preheader = `Great news! Your order ${details.orderId} is now in transit.`;

  const content = `
    <h2 class="title text-center">Hi ${name},</h2>
    <p class="text text-center">Great news! Your order is now <strong>in transit</strong>. You can track your shipment using the button below.</p>
    
    <div class="details-box">
      <div class="details-row">
        <div class="details-label">Order ID</div>
        <div class="details-value">${details.orderId}</div>
      </div>
      <div class="details-row">
        <div class="details-label">Courier</div>
        <div class="details-value">${details.courier}</div>
      </div>
    </div>
    
    <p class="text text-center">We will notify you again once your order has been delivered.</p>
    
    <div class="text-center mt-6">
      <a href="https://tuneboss.co.id/tracking" class="btn">Track Order</a>
    </div>
  `;
  
  return getBaseEmail(title, preheader, content);
}
