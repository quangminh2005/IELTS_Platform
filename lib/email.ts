import nodemailer, { type Transporter } from "nodemailer";

// Gửi mail bằng chính Gmail của giáo viên (App Password) vì web chưa có tên miền
// riêng — Resend và các dịch vụ tương tự đòi tên miền đã xác thực mới cho gửi tới
// địa chỉ bất kỳ. Cách này còn lợi: học sinh thấy mail đến từ đúng địa chỉ của
// cô/thầy, và bấm Trả lời thì thư về hộp thư đó. Hạn mức Gmail 500 mail/ngày.
// Khi nào có tên miền riêng thì chỉ cần thay file này.

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function isEmailConfigured(): boolean {
  return Boolean(readEnv("GMAIL_USER") && readEnv("GMAIL_APP_PASSWORD"));
}

let transporter: Transporter | null = null;

function getTransporter(user: string, pass: string): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }

  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<void> {
  const user = readEnv("GMAIL_USER");
  const pass = readEnv("GMAIL_APP_PASSWORD");

  if (!user || !pass) {
    throw new Error("Chưa cấu hình GMAIL_USER / GMAIL_APP_PASSWORD.");
  }

  await getTransporter(user, pass).sendMail({ from: user, to, subject, text, html });
}
