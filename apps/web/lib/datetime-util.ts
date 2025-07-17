export function formatLastActivity(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "Never"
  const date = new Date(dateInput)
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  return isToday
    ? date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("en-US")
}
