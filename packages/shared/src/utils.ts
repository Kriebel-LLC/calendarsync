export function assertNever(value: never): never {
  throw new Error("Illegal value: " + value);
}

// Seconds since Jan 1st, 1970
export function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function getDateDaysAgo(daysAgo: number): Date {
  // Get the current date
  const currentDate = new Date();

  currentDate.setDate(currentDate.getDate() - daysAgo);

  return currentDate;
}
