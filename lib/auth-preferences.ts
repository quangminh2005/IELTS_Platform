// Ghi nhớ lựa chọn đăng nhập trên từng máy (localStorage), không đụng tới server.
export const PREFERRED_ROLE_KEY = "ielts-platform:preferred-role";
export const REMEMBERED_TEACHER_EMAIL_KEY = "ielts-platform:teacher-email";

export type PreferredRole = "student" | "teacher";

export const LOGIN_PATH_BY_ROLE: Record<PreferredRole, string> = {
  student: "/login/student",
  teacher: "/login/teacher"
};

function isPreferredRole(value: string | null): value is PreferredRole {
  return value === "student" || value === "teacher";
}

// Trình duyệt có thể chặn localStorage (chế độ riêng tư, cookie bị khoá) — luôn bọc try/catch.
export function readPreferredRole(): PreferredRole | null {
  try {
    const saved = localStorage.getItem(PREFERRED_ROLE_KEY);

    return isPreferredRole(saved) ? saved : null;
  } catch (_) {
    return null;
  }
}

export function savePreferredRole(role: PreferredRole) {
  try {
    localStorage.setItem(PREFERRED_ROLE_KEY, role);
  } catch (_) {
    // Không nhớ được thì lần sau hỏi lại, không cần báo lỗi.
  }
}

export function clearPreferredRole() {
  try {
    localStorage.removeItem(PREFERRED_ROLE_KEY);
  } catch (_) {
    // Bỏ qua.
  }
}

export function readRememberedTeacherEmail(): string {
  try {
    return localStorage.getItem(REMEMBERED_TEACHER_EMAIL_KEY) ?? "";
  } catch (_) {
    return "";
  }
}

export function saveRememberedTeacherEmail(email: string) {
  try {
    localStorage.setItem(REMEMBERED_TEACHER_EMAIL_KEY, email);
  } catch (_) {
    // Bỏ qua.
  }
}

export function clearRememberedTeacherEmail() {
  try {
    localStorage.removeItem(REMEMBERED_TEACHER_EMAIL_KEY);
  } catch (_) {
    // Bỏ qua.
  }
}
