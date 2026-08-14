/** @type {import('next').NextConfig} */

// Header bảo mật áp cho MỌI đường dẫn.
//
// Cố tình KHÔNG đặt Content-Security-Policy đầy đủ (chặn script/style): Next
// chèn script inline và trang đăng nhập chạy shader three.js, siết vội là trắng
// trang. CSP ở đây chỉ giữ 3 chỉ thị không đụng tới việc render.
const securityHeaders = [
  // Không cho nhúng site vào iframe của trang khác (chống clickjacking: phủ một
  // trang giả lên trên rồi lừa bấm). X-Frame-Options cho trình duyệt cũ,
  // frame-ancestors trong CSP bên dưới cho trình duyệt mới.
  { key: "X-Frame-Options", value: "DENY" },
  // Trình duyệt phải tin content-type server khai, không tự "đoán" kiểu file.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Sang trang ngoài chỉ gửi tên miền, không gửi đường dẫn đầy đủ (đường dẫn có
  // thể chứa id bài làm, id học viên).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Micro để MỞ vì bài Speaking cần ghi âm; camera và định vị thì khoá hẳn.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
  // Luôn vào bằng HTTPS trong 2 năm tới.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: [
      "frame-ancestors 'none'",
      // Chặn thẻ <base> lạ bị chèn vào để đổi gốc của mọi đường dẫn tương đối.
      "base-uri 'self'",
      // Form chỉ được gửi về chính site này (đăng nhập Google là chuyển hướng,
      // không phải form submit, nên không ảnh hưởng).
      "form-action 'self'"
    ].join("; ")
  }
];

const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
