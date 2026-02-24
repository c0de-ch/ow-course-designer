import nodemailer from "nodemailer";

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
}

const fromAddress =
  process.env.SMTP_FROM ?? "OW Course Designer <noreply@example.com>";

export async function sendVerificationCode(
  to: string,
  code: string
): Promise<void> {
  const transport = getTransport();
  await transport.sendMail({
    from: fromAddress,
    to,
    subject: "Your verification code — OW Course Designer",
    text: `Your verification code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not request this, ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 16px">Verify your email</h2>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#f3f4f6;border-radius:8px;margin:16px 0">${code}</div>
        <p style="color:#6b7280;font-size:14px">This code expires in 15 minutes.</p>
        <p style="color:#6b7280;font-size:14px">If you did not request this, ignore this email.</p>
      </div>
    `,
  });
}

export async function sendAdminNewUserNotification(
  userName: string | null,
  userEmail: string
): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;

  const transport = getTransport();
  await transport.sendMail({
    from: fromAddress,
    to: adminEmail,
    subject: `New user registered — ${userEmail}`,
    text: `A new user has registered on OW Course Designer.\n\nName: ${userName ?? "(not provided)"}\nEmail: ${userEmail}\nTime: ${new Date().toISOString()}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 16px">New user registered</h2>
        <table style="border-collapse:collapse">
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Name</td><td>${userName ?? "<em>not provided</em>"}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Email</td><td>${userEmail}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Time</td><td>${new Date().toISOString()}</td></tr>
        </table>
      </div>
    `,
  });
}
