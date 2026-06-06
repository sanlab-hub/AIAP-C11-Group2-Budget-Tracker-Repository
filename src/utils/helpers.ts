export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function monthStart(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

export function monthEnd(date = new Date()): string {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return end.toISOString().slice(0, 10);
}

export function monthLabel(isoMonth: string): string {
  const [y, m] = isoMonth.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function prevMonth(isoMonth: string): string {
  const [y, m] = isoMonth.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function nextMonth(isoMonth: string): string {
  const [y, m] = isoMonth.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function nMonthsAgoStart(n: number, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth() - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function isoMonth(dateStr: string): string {
  const [y, m] = dateStr.split('-');
  return `${y}-${m}`;
}

export const DEFAULT_CATEGORIES = [
  { name: 'Food',           color: '#f59e0b', icon: 'utensils',        type: 'expense' as const },
  { name: 'Travel',         color: '#0ea5e9', icon: 'plane',           type: 'expense' as const },
  { name: 'Shopping',       color: '#ec4899', icon: 'shopping-bag',    type: 'expense' as const },
  { name: 'Bills',          color: '#f97316', icon: 'file-text',       type: 'expense' as const },
  { name: 'Entertainment',  color: '#a855f7', icon: 'tv',              type: 'expense' as const },
  { name: 'Health',         color: '#22c55e', icon: 'heart',           type: 'expense' as const },
  { name: 'Education',      color: '#6366f1', icon: 'book-open',       type: 'expense' as const },
  { name: 'Miscellaneous',  color: '#6b7280', icon: 'more-horizontal', type: 'expense' as const },
  { name: 'Salary',         color: '#16a34a', icon: 'briefcase',       type: 'income' as const },
  { name: 'Freelance',      color: '#0891b2', icon: 'laptop',          type: 'income' as const },
];

export const CATEGORY_COLORS = [
  '#f59e0b', '#ef4444', '#f97316', '#84cc16',
  '#22c55e', '#0ea5e9', '#6366f1', '#a855f7',
  '#ec4899', '#14b8a6', '#0891b2', '#6b7280',
];
