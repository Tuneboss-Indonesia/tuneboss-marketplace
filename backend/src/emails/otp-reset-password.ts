import { getBaseEmail } from "./base.js";

export function getOtpResetPasswordEmail(name: string, otp: string): string {
  const title = "Reset Password - TuneBoss";
  const preheader = `Your OTP code to reset your password is ${otp}`;
  
  const content = `
    <h2 class="title text-center">Hi ${name},</h2>
    <p class="text text-center">We received a request to reset the password for your TuneBoss account. Use the following alphanumeric OTP code to continue:</p>
    
    <div class="otp-box">
      <div class="otp-code">${otp}</div>
    </div>
    
    <p class="text text-center" style="font-size: 14px; color: #71717a;">
      This code is valid for 15 minutes. If you didn't request a password reset, ignore this email and your account will remain secure.
    </p>
  `;
  
  return getBaseEmail(title, preheader, content);
}
