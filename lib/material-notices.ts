export type MaterialNoticeStatus = "success" | "error";

export function materialNoticePath(status: MaterialNoticeStatus, message: string) {
  const params = new URLSearchParams({
    materialsStatus: status,
    materialsMessage: message
  });

  return `/teacher/materials?${params.toString()}`;
}
