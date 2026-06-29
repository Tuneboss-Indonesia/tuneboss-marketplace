export const BRAND_COLOR = "#c95b04";
export const BRAND_COLOR_HOVER = "#ea6a05";

export function getBaseEmail(title: string, preheader: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title}</title>
  <style>
    /* Reset styles */
    body, p, h1, h2, h3, h4, h5, h6 { margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #18181b; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; width: 100%; }
    img { max-width: 100%; height: auto; display: block; }
    a { color: ${BRAND_COLOR}; text-decoration: none; }
    
    /* Layout */
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); margin-top: 40px; margin-bottom: 40px; }
    .header { background-color: #18181b; padding: 30px 40px; text-align: center; border-bottom: 3px solid ${BRAND_COLOR}; }
    .header-logo { color: ${BRAND_COLOR}; font-size: 28px; font-weight: 900; letter-spacing: 4px; margin: 0; text-transform: uppercase; }
    .content { padding: 40px; }
    .footer { background-color: #f4f4f5; padding: 30px 40px; text-align: center; font-size: 13px; color: #71717a; border-top: 1px solid #e4e4e7; }
    
    /* Elements */
    .btn { display: inline-block; background-color: ${BRAND_COLOR}; color: #ffffff !important; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin-top: 16px; margin-bottom: 8px; text-decoration: none; }
    .btn:hover { background-color: ${BRAND_COLOR_HOVER}; }
    .title { font-size: 22px; font-weight: 700; margin-bottom: 16px; color: #18181b; line-height: 1.3; }
    .text { font-size: 15px; line-height: 1.6; color: #3f3f46; margin-bottom: 20px; }
    .text-sm { font-size: 14px; line-height: 1.5; color: #52525b; margin-bottom: 16px; }
    
    /* Utilities */
    .text-center { text-align: center; }
    .mt-4 { margin-top: 16px; }
    .mt-6 { margin-top: 24px; }
    .mb-2 { margin-bottom: 8px; }
    .mb-4 { margin-bottom: 16px; }
    .mb-8 { margin-bottom: 32px; }
    .font-bold { font-weight: 700; color: #18181b; }
    .divider { height: 1px; background-color: #e4e4e7; margin: 32px 0; border: none; }
    
    /* OTP Box */
    .otp-box { background-color: #f4f4f5; border: 2px dashed #d4d4d8; border-radius: 8px; padding: 24px; text-align: center; margin: 32px 0; }
    .otp-code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 38px; font-weight: 700; letter-spacing: 12px; color: ${BRAND_COLOR}; margin: 0; padding-left: 12px; /* compensate for tracking */ }
    
    /* Invoice details */
    .invoice-table { width: 100%; margin-bottom: 24px; }
    .invoice-table th { text-align: left; padding: 12px 0; border-bottom: 1px solid #e4e4e7; font-size: 13px; color: #71717a; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .invoice-table td { padding: 16px 0; border-bottom: 1px solid #f4f4f5; font-size: 15px; color: #3f3f46; }
    .invoice-table .item-name { font-weight: 600; color: #18181b; margin-bottom: 4px; }
    .invoice-table .item-meta { font-size: 13px; color: #71717a; }
    .invoice-table .item-price { text-align: right; font-weight: 600; color: #18181b; }
    .invoice-summary { width: 100%; margin-top: 16px; }
    .invoice-summary td { padding: 12px 0; text-align: right; font-size: 15px; color: #3f3f46; }
    .invoice-summary .summary-label { padding-right: 24px; color: #71717a; }
    .invoice-total { border-top: 2px solid #e4e4e7 !important; }
    .invoice-total td { font-weight: 700 !important; color: ${BRAND_COLOR} !important; font-size: 18px !important; padding-top: 16px !important; }

    /* Dark Mode Support */
    @media (prefers-color-scheme: dark) {
      body, .bg-wrapper { background-color: #09090b !important; }
      .container { background-color: #18181b !important; border: 1px solid #27272a !important; box-shadow: none !important; }
      .title, .font-bold, .invoice-table .item-name, .invoice-table .item-price { color: #f4f4f5 !important; }
      .text, .text-sm, .details-value, .invoice-table td, .invoice-summary td { color: #d4d4d8 !important; }
      .details-label, .invoice-table th, .summary-label { color: #a1a1aa !important; }
      .details-box, .otp-box { background-color: #27272a !important; border-color: #3f3f46 !important; }
      .footer { background-color: #09090b !important; border-top-color: #27272a !important; }
      .invoice-table th, .invoice-table td { border-bottom-color: #27272a !important; }
      .invoice-total { border-top-color: #3f3f46 !important; }
      .divider { background-color: #3f3f46 !important; }
    }

    /* Order Details Box */
    .details-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .details-row { display: table; width: 100%; margin-bottom: 12px; }
    .details-row:last-child { margin-bottom: 0; }
    .details-label { display: table-cell; width: 40%; font-size: 14px; color: #64748b; }
    .details-value { display: table-cell; width: 60%; font-size: 14px; font-weight: 600; color: #0f172a; text-align: right; }
    
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .container { border-radius: 0; margin-top: 0; margin-bottom: 0; }
      .content { padding: 30px 20px; }
      .otp-code { font-size: 32px; letter-spacing: 8px; }
    }
  </style>
</head>
<body>
  <!-- Preheader -->
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; opacity: 0; font-size: 0; color: transparent;">
    ${preheader}
  </div>

  <table class="bg-wrapper" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <div class="container">
          <!-- Header -->
          <div class="header">
            <a href="https://tuneboss.co.id" target="_blank" style="text-decoration: none;">
              <img src="https://tuneboss.co.id/tuneboss-logo.png" alt="TuneBoss" width="180" style="display: block; margin: 0 auto; max-width: 100%; height: auto; border: 0;" />
            </a>
          </div>
          
          <!-- Content -->
          <div class="content">
            ${content}
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p class="mb-4">&copy; ${new Date().getFullYear()} TUNEBOSS.CO.ID. All Rights Reserved.</p>
            <p style="margin-bottom: 16px;">This is an automated email. Please do not reply.</p>
            <div>
              <a href="https://tuneboss.co.id" style="color: #71717a; text-decoration: underline;">Website</a> &nbsp;&bull;&nbsp;
              <a href="https://tuneboss.co.id/privacy" style="color: #71717a; text-decoration: underline;">Privacy Policy</a> &nbsp;&bull;&nbsp;
              <a href="https://tuneboss.co.id/terms" style="color: #71717a; text-decoration: underline;">Terms of Service</a>
            </div>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
