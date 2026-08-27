import { VN_OFFSET_MS } from "@/lib/streak";

// Lịch chuyên cần: mỗi ô là một ngày, sáng khi học viên có NỘP BÀI hoặc CÓ LÀM
// QUIZ TỪ VỰNG trong ngày đó.
//
// Chỉ hai mức sáng/tắt, không chia độ đậm nhạt: một học viên hiếm khi nộp quá 2
// bài một ngày, ba mức màu chỉ là nhiễu.
//
// Module thuần: không đụng Prisma, không đụng React.

export type AttendanceMonth = {
  year: number;
  month: number; // 1–12
  // Số ô trống trước ngày 1 khi xếp lưới tuần bắt đầu Thứ 2.
  leadingBlanks: number;
  days: Array<{ day: number; active: boolean }>;
};

// Khoá ngày "YYYY-MM-DD" theo giờ Việt Nam. Cộng offset rồi đọc theo UTC để có
// giờ địa phương VN — cùng cách lib/streak.ts đang làm với tuần.
export function vnDateKey(date: Date): string {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildAttendanceMonth(input: {
  submittedAt: Date[];
  vocabDays: Date[];
  month: Date;
}): AttendanceMonth {
  const shifted = new Date(input.month.getTime() + VN_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1; // 1–12

  // Ngày 0 của tháng sau = ngày cuối của tháng này.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // getUTCDay: 0=CN, 1=T2... Lưới bắt đầu Thứ 2 nên CN phải là cột thứ 7.
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const leadingBlanks = (firstWeekday + 6) % 7;

  const activeKeys = new Set<string>();
  for (const date of input.submittedAt) {
    activeKeys.add(vnDateKey(date));
  }
  for (const date of input.vocabDays) {
    activeKeys.add(vnDateKey(date));
  }

  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { day, active: activeKeys.has(key) };
  });

  return { year, month, leadingBlanks, days };
}
