// Chốt nguồn file ghi âm mà máy chủ được phép tải về.
//
// VÌ SAO CẦN: `Answer.value` của câu Speaking chính là chuỗi client gửi lên ở ô
// `q_<questionId>` — trình duyệt điền URL blob vào đó, nhưng học viên gửi POST
// tay thì đặt được URL BẤT KỲ. Khi giáo viên bấm "Phiên âm", máy chủ đi fetch
// đúng URL ấy: đó là đường để bắt máy chủ gọi hộ vào mạng nội bộ (SSRF), ví dụ
// endpoint metadata của nhà cung cấp hay một service chỉ nghe ở localhost.
//
// Chỉ nhận đúng thứ đường dẫn mà luồng nộp bài thật sinh ra: file trên Vercel
// Blob, qua HTTPS. Đã đối chiếu dữ liệu thật trên prod — mọi bản ghi đều có dạng
// https://<mã-kho>.public.blob.vercel-storage.com/<tên-file>.
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export function isAllowedAudioUrl(value: string): boolean {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false; // chuỗi rỗng hoặc không phải URL
  }

  // Chỉ HTTPS. Chặn luôn file:/gopher:/http: — http còn mở đường cho kẻ đứng giữa
  // đổi nội dung, mà blob thật thì luôn phục vụ qua https.
  if (url.protocol !== "https:") {
    return false;
  }

  // "https://a.public.blob.vercel-storage.com@evil.tld/x" — phần trước dấu @ chỉ
  // là user/mật khẩu, host thật là evil.tld. URL parser đã tách đúng nên
  // url.hostname bên dưới tự khắc chặn; kiểm thêm ở đây cho tường minh vì đây là
  // mẹo đánh lừa người đọc code chứ không đánh lừa máy.
  if (url.username || url.password) {
    return false;
  }

  // So theo hostname (KHÔNG phải toàn chuỗi URL): nhét tên miền thật vào path hay
  // query đều vô tác dụng. Dấu chấm đầu hậu tố bắt buộc phải có mã kho đứng trước,
  // nên "public.blob.vercel-storage.com.evil.tld" cũng trượt.
  const host = url.hostname.toLowerCase();

  return host.endsWith(BLOB_HOST_SUFFIX) && host.length > BLOB_HOST_SUFFIX.length;
}
