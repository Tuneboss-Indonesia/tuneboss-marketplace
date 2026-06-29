import { getBaseEmail } from "./base.js";

export function getOtpVerificationEmail(name: string, otpCode: string): string {
  const title = "Email Verification - TuneBoss";
  const preheader = `Your email verification code is ${otpCode}. Use this code to verify your account.`;
  
  const content = `
    <h2 class="title text-center">Hi ${name},</h2>
    <p class="text text-center">Thank you for registering at <strong>TuneBoss Marketplace</strong>. To complete your registration and activate your account, please use the following 6-digit OTP code:</p>
    
    <div class="otp-box">
      <p class="otp-code">${otpCode}</p>
    </div>
    
    <p class="text text-center" style="font-size: 14px; color: #71717a;">
      This code is valid for <strong>15 minutes</strong>. Please do not share this code with anyone for your account security.
    </p>
    
    <p class="text-sm mt-6 text-center">
      If you did not create an account at TuneBoss Marketplace, you can safely ignore this email.
    </p>
  `;
  
  return getBaseEmail(title, preheader, content);
}
