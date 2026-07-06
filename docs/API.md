# TuneBoss Marketplace API

Base URL: `{{apiUrl}}` (local default: `http://localhost:8000/api`).

Auth uses the `tuneboss_session` cookie. In Postman, keep cookies enabled after login/register.

## Public

- `GET /health`
- `GET /ready`
- `GET /products`
- `GET /products/:slugOrId`
- `GET /products/:slugOrId/reviews`
- `GET /categories`
- `GET /tracking/:orderId`

## Auth

- `POST /auth/register` `{ "name", "email", "password" }`
- `POST /auth/login` `{ "email", "password" }`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /auth/email-verification/request` `{ "email" }`
- `POST /auth/email-verification/verify` `{ "email", "otp" }`
- `POST /auth/forgot-password` `{ "email" }`
- `POST /auth/forgot-password/verify` `{ "email", "otp" }`
- `POST /auth/reset-password` `{ "email", "otp", "password" }`

## Customer

- `GET /account`
- `PATCH /account` `{ "name", "phone" }`
- `PATCH /account/password` `{ "currentPassword", "newPassword" }`
- `GET /addresses`
- `POST /addresses` `{ "recipientName", "phone", "addressLine", "city", "province", "postalCode", "isDefault" }`
- `PATCH /addresses/:id`
- `DELETE /addresses/:id`
- `POST /shipping/quote` `{ "addressId", "shippingMethod": "REGULAR", "items": [{ "id", "quantity" }] }`
- `POST /orders` `{ "addressId", "shippingMethod": "REGULAR", "items": [{ "id", "quantity" }] }`
- `GET /orders`
- `GET /orders/:id`
- `POST /orders/:id/cancel`
- `POST /products/:slugOrId/reviews` `{ "rating", "quote" }`

## Payment

- `POST /payments/xendit/invoice` `{ "orderId" }`
- `POST /webhooks/xendit` Xendit callback with `x-callback-token`.

## Admin

- `GET /admin/summary`
- `GET /admin/customers`
- `GET /admin/orders`
- `GET /admin/orders/:id`
- `GET /admin/orders/:id/payment-events`
- `POST /admin/orders/expire-pending`
- `PATCH /admin/orders/:id/status`
- `PATCH /admin/orders/:id/fulfillment`
- `GET /admin/products`
- `GET /admin/products/low-stock`
- `GET /admin/products/:id`
- `POST /admin/products`
- `PATCH /admin/products/:id`
- `PATCH /admin/products/:id/stock`
- `GET /admin/audit-logs`

## Shipping

Current shipping is backend-owned flat rate:

- Method: `REGULAR`
- Cost: `25000`
- Free shipping when subtotal is at least `2000000`

Replace this with a courier API when real carrier rates are required.
