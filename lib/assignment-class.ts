/**
 * Suy ra lớp của một bài giao từ danh sách lớp của từng học viên nhận bài.
 *
 * Form giao bài chỉ chọn học viên chứ không chọn lớp, nên `Assignment.classId`
 * được suy ra: chỉ gắn khi CẢ NHÓM cùng chung đúng một lớp. Nhóm trải trên
 * nhiều lớp (hoặc chung tới 2 lớp) thì để null — nghĩa là "bài chung", và bảng
 * xếp hạng của lớp nào cũng tính nó.
 */
export function resolveAssignmentClassId(studentClassIds: string[][]): string | null {
  if (studentClassIds.length === 0) {
    return null;
  }

  const shared = studentClassIds.reduce<string[] | null>((common, classIds) => {
    if (common === null) {
      return [...new Set(classIds)];
    }

    return common.filter((classId) => classIds.includes(classId));
  }, null);

  return shared !== null && shared.length === 1 ? shared[0] : null;
}
