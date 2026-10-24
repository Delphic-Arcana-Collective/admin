function shanghaiDay(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function createdToday(iso: string): boolean {
  const created = shanghaiDay(iso);
  const today = shanghaiDay(new Date().toISOString());
  return created !== null && created === today;
}
