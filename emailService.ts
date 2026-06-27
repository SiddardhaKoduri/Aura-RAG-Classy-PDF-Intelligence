export interface SendEmailParams {
  to: string;
  username: string;
  otp: string;
}

export async function sendOtpEmail({ to, username, otp }: SendEmailParams): Promise<{ success: boolean; message: string }> {
  const provider = import.meta.env.VITE_EMAIL_PROVIDER || 'mock';

  if (provider === 'brevo') {
    const apiKey = import.meta.env.VITE_BREVO_API_KEY;
    if (!apiKey) {
      return { success: false, message: 'Brevo API key is not configured in .env file.' };
    }
    const senderEmail = import.meta.env.VITE_BREVO_SENDER_EMAIL || 'aura-rag@example.com';
    const senderName = import.meta.env.VITE_BREVO_SENDER_NAME || 'Aura RAG';

    try {
      const response = await fetch('/api-brevo/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'content-type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: to }],
          subject: `Your Aura RAG OTP Code: ${otp}`,
          htmlContent: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; background-color: #05080f; color: #ffffff; border-radius: 12px; max-width: 500px; border: 1px solid rgba(255,255,255,0.1);">
              <h2 style="color: #0071e3; margin-top: 0; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">AURA RAG</h2>
              <p style="font-size: 15px; line-height: 1.5; color: #8e8e93;">Hello <strong>${username}</strong>,</p>
              <p style="font-size: 15px; line-height: 1.5; color: #8e8e93;">You requested a one-time passcode (OTP) to log in to your account. Use the code below to complete your sign-in:</p>
              <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; text-align: center; margin: 30px 0; color: #ffffff; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); font-family: monospace;">
                ${otp}
              </div>
              <p style="font-size: 12px; color: #8e8e93; line-height: 1.4; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px; margin-top: 25px;">
                If you did not request this code, you can safely ignore this email. This passcode is valid for 10 minutes.
              </p>
            </div>
          `
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return { success: true, message: 'OTP email sent successfully via Brevo!' };
    } catch (error) {
      console.error('Brevo email send error:', error);
      return { success: false, message: `Failed to send email via Brevo: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  if (provider === 'resend') {
    const apiKey = import.meta.env.VITE_RESEND_API_KEY;
    if (!apiKey) {
      return { success: false, message: 'Resend API key is not configured in .env file.' };
    }
    const senderEmail = import.meta.env.VITE_RESEND_SENDER_EMAIL || 'onboarding@resend.dev';

    try {
      const response = await fetch('/api-resend/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `Aura RAG <${senderEmail}>`,
          to: [to],
          subject: `Your Aura RAG OTP Code: ${otp}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; background-color: #05080f; color: #ffffff; border-radius: 12px; max-width: 500px; border: 1px solid rgba(255,255,255,0.1);">
              <h2 style="color: #0071e3; margin-top: 0; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">AURA RAG</h2>
              <p style="font-size: 15px; line-height: 1.5; color: #8e8e93;">Hello <strong>${username}</strong>,</p>
              <p style="font-size: 15px; line-height: 1.5; color: #8e8e93;">You requested a one-time passcode (OTP) to log in to your account. Use the code below to complete your sign-in:</p>
              <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; text-align: center; margin: 30px 0; color: #ffffff; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); font-family: monospace;">
                ${otp}
              </div>
              <p style="font-size: 12px; color: #8e8e93; line-height: 1.4; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px; margin-top: 25px;">
                If you did not request this code, you can safely ignore this email. This passcode is valid for 10 minutes.
              </p>
            </div>
          `
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return { success: true, message: 'OTP email sent successfully via Resend!' };
    } catch (error) {
      console.error('Resend email send error:', error);
      return { success: false, message: `Failed to send email via Resend: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  // Fallback / Mock provider
  return { success: true, message: 'Mock mode: OTP displayed on screen.' };
}
