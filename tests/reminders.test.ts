import { describe, expect, it } from "vitest";
import {
  buildReminderEmail,
  findDueReminders,
  formatDeadlineLabel,
  groupRemindersByStudent,
  type ReminderCandidate,
} from "../lib/reminders";

const now = new Date("2026-07-25T05:00:00.000Z"); // 12h trưa VN ngày 25/07
const hours = (n: number) => new Date(now.getTime() + n * 60 * 60 * 1000);

function candidate(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    recipientId: "r1",
    studentEmail: "minh@example.com",
    studentName: "Minh",
    assignmentTitle: "Cambridge 20 Test 1 — Reading",
    skills: ["reading"],
    deadline: hours(5),
    status: "assigned",
    reminderSentAt: null,
    ...overrides,
  };
}

describe("findDueReminders", () => {
  it("nhắc bài chưa nộp, chưa nhắc, hết hạn trong 24h", () => {
    const due = findDueReminders([candidate()], now);
    expect(due).toHaveLength(1);
    expect(due[0].recipientId).toBe("r1");
  });

  it("bỏ qua bài không có deadline", () => {
    expect(findDueReminders([candidate({ deadline: null })], now)).toHaveLength(0);
  });

  it("bỏ qua bài đã quá hạn", () => {
    expect(findDueReminders([candidate({ deadline: hours(-1) })], now)).toHaveLength(0);
  });

  it("bỏ qua bài còn hạn xa hơn 24h", () => {
    expect(findDueReminders([candidate({ deadline: hours(25) })], now)).toHaveLength(0);
  });

  it("bỏ qua bài đã nộp", () => {
    expect(findDueReminders([candidate({ status: "submitted" })], now)).toHaveLength(0);
    expect(findDueReminders([candidate({ status: "reviewed" })], now)).toHaveLength(0);
  });

  it("vẫn nhắc bài đang làm dở", () => {
    expect(findDueReminders([candidate({ status: "in_progress" })], now)).toHaveLength(1);
  });

  it("bỏ qua bài đã từng nhắc", () => {
    expect(findDueReminders([candidate({ reminderSentAt: hours(-24) })], now)).toHaveLength(0);
  });

  it("biên: deadline đúng now + 24h thì vẫn nhắc", () => {
    expect(findDueReminders([candidate({ deadline: hours(24) })], now)).toHaveLength(1);
  });

  it("biên: deadline đúng bằng now thì không nhắc", () => {
    expect(findDueReminders([candidate({ deadline: now })], now)).toHaveLength(0);
  });
});

describe("groupRemindersByStudent", () => {
  it("gộp nhiều bài của cùng một em thành một mail, sắp theo hạn gần trước", () => {
    const grouped = groupRemindersByStudent([
      candidate({ recipientId: "r2", deadline: hours(20), assignmentTitle: "Listening Test 4" }),
      candidate({ recipientId: "r1", deadline: hours(6), assignmentTitle: "Reading Test 1" }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].email).toBe("minh@example.com");
    expect(grouped[0].items.map((item) => item.assignmentTitle)).toEqual([
      "Reading Test 1",
      "Listening Test 4",
    ]);
    expect(grouped[0].recipientIds).toEqual(["r1", "r2"]);
  });

  it("hai em khác nhau ra hai mail", () => {
    const grouped = groupRemindersByStudent([
      candidate({ recipientId: "r1", studentEmail: "a@example.com", studentName: "An" }),
      candidate({ recipientId: "r2", studentEmail: "b@example.com", studentName: "Bình" }),
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped.map((item) => item.email).sort()).toEqual(["a@example.com", "b@example.com"]);
  });

  it("danh sách rỗng ra mảng rỗng", () => {
    expect(groupRemindersByStudent([])).toEqual([]);
  });
});

describe("formatDeadlineLabel", () => {
  it("dùng chữ 'hôm nay' cho hạn trong cùng ngày VN", () => {
    // 16:59 UTC = 23:59 giờ VN cùng ngày 25/07
    expect(formatDeadlineLabel(new Date("2026-07-25T16:59:00.000Z"), now)).toBe("23:59 hôm nay");
  });

  it("dùng chữ 'ngày mai' cho hạn ngày VN kế tiếp", () => {
    // 11:00 UTC ngày 26/07 = 18:00 giờ VN ngày 26/07
    expect(formatDeadlineLabel(new Date("2026-07-26T11:00:00.000Z"), now)).toBe("18:00 ngày mai");
  });

  it("dùng ngày/tháng cho hạn xa hơn", () => {
    expect(formatDeadlineLabel(new Date("2026-07-28T11:00:00.000Z"), now)).toBe("18:00 ngày 28/07");
  });
});

describe("buildReminderEmail", () => {
  it("tiêu đề số ít nêu tên bài", () => {
    const [reminder] = groupRemindersByStudent([candidate()]);
    const mail = buildReminderEmail(reminder, "https://lop.example.com", now);

    expect(mail.subject).toBe('Nhắc bài: "Cambridge 20 Test 1 — Reading" sắp hết hạn');
  });

  it("tiêu đề số nhiều đếm số bài", () => {
    const [reminder] = groupRemindersByStudent([
      candidate({ recipientId: "r1" }),
      candidate({ recipientId: "r2", assignmentTitle: "Listening Test 4", skills: ["listening"] }),
    ]);
    const mail = buildReminderEmail(reminder, "https://lop.example.com", now);

    expect(mail.subject).toBe("Nhắc bài: 2 bài IELTS sắp hết hạn");
  });

  it("thân mail có tên em, tên bài, nhãn kỹ năng tiếng Việt và link vào làm bài", () => {
    const [reminder] = groupRemindersByStudent([candidate()]);
    const mail = buildReminderEmail(reminder, "https://lop.example.com", now);

    expect(mail.text).toContain("Chào Minh,");
    expect(mail.text).toContain("Cambridge 20 Test 1 — Reading");
    expect(mail.text).toContain("(Đọc)");
    expect(mail.text).toContain("https://lop.example.com/student");
    expect(mail.html).toContain("https://lop.example.com/student");
  });

  it("bỏ dấu / thừa ở cuối appUrl không làm link lỗi", () => {
    const [reminder] = groupRemindersByStudent([candidate()]);
    const mail = buildReminderEmail(reminder, "https://lop.example.com/", now);

    expect(mail.text).toContain("https://lop.example.com/student");
    expect(mail.text).not.toContain("//student");
  });

  it("escape HTML trong tên bài để không phá cấu trúc mail", () => {
    const [reminder] = groupRemindersByStudent([
      candidate({ assignmentTitle: 'Bài <b>"khó"</b> & dài' }),
    ]);
    const mail = buildReminderEmail(reminder, "https://lop.example.com", now);

    expect(mail.html).toContain("&lt;b&gt;");
    expect(mail.html).not.toContain("<b>");
    expect(mail.html).toContain("&amp;");
    // text thuần giữ nguyên, không escape
    expect(mail.text).toContain('Bài <b>"khó"</b> & dài');
  });
});
