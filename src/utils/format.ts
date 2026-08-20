export function formatCurrency(amount: number): string {
  return `₱${amount.toFixed(2)}`
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-PH')
}
