const vietnamTimezoneOffset = "+07:00";

export function parseAssignmentDeadline(dueDate: string | null | undefined, dueTime: string | null | undefined) {
  const date = dueDate?.trim();

  if (!date) {
    return null;
  }

  const time = dueTime?.trim() || "23:59";
  const deadline = new Date(`${date}T${time}:00${vietnamTimezoneOffset}`);

  if (Number.isNaN(deadline.getTime())) {
    throw new Error("Deadline must be a valid date and time.");
  }

  return deadline;
}
