// Địa chỉ web thật, dùng để dựng link phụ huynh. Một chỗ duy nhất, để trang giáo
// viên, nút gửi tay và cron không sinh ra ba kiểu link khác nhau.
//
// Thứ tự ưu tiên có chủ ý:
//   1. NEXT_PUBLIC_APP_URL — tự đặt, đúng nhất (kể cả khi sau này có tên miền riêng).
//   2. VERCEL_PROJECT_PRODUCTION_URL — tên miền CÔNG KHAI của project.
//   3. VERCEL_URL — địa chỉ riêng của từng bản deploy. ĐÂY LÀ BẪY: nó nằm sau lớp
//      bảo vệ đăng nhập của Vercel, phụ huynh mở ra chỉ thấy màn hình đòi đăng nhập.
//      Chỉ dùng làm lưới cuối cùng.
export function resolveAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (productionUrl) {
    return `https://${productionUrl.replace(/\/+$/, "")}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}
