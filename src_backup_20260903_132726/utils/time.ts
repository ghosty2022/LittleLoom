// utils/time.ts -- Shared time/date formatting utilities

/**
 * Format a timestamp as a short time string (e.g., "2:30 PM")
 */
export const formatTimeShort = (timestamp: number | Date): string =>
  new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * Format a timestamp as a human-friendly date string
 * Returns: "Today", "Yesterday", weekday name, or "Mon 12"
 */
export const formatDateShort = (timestamp: number | Date): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entryDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - entryDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/**
 * Format a timestamp as a full date-time string
 */
export const formatDateTimeShort = (timestamp: number | Date): string => {
  const date = new Date(timestamp);
  return `${formatDateShort(timestamp)} at ${formatTimeShort(date)}`;
};