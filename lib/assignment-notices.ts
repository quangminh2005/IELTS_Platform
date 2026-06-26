export type AssignmentNoticeStatus = "success" | "error";

export function assignmentNoticePath(status: AssignmentNoticeStatus, message: string) {
  const params = new URLSearchParams({
    assignmentsStatus: status,
    assignmentsMessage: message
  });

  return `/teacher/assignments?${params.toString()}`;
}
