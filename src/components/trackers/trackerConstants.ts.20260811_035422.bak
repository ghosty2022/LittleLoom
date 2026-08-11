import { TrackerCategory, FieldType } from '../../types/trackers';

export const TRACKER_CATEGORIES: { 
  id: TrackerCategory; 
  emoji: string; 
  label: string; 
  color: string; 
  priority: number;
  description: string;
}[] = [
  { id: 'essential', emoji: '⭐', label: 'Essential Daily', color: '#667eea', priority: 1, description: 'Daily routines & care' },
  { id: 'health', emoji: '🏥', label: 'Health & Medical', color: '#e74c3c', priority: 2, description: 'Medical records & health' },
  { id: 'development', emoji: '🧠', label: 'Development', color: '#9b59b6', priority: 3, description: 'Milestones & learning' },
  { id: 'emotional', emoji: '❤️', label: 'Emotional & Social', color: '#e84393', priority: 4, description: 'Mood & social skills' },
  { id: 'physical', emoji: '💅', label: 'Physical Care', color: '#00b894', priority: 5, description: 'Hygiene & grooming' },
  { id: 'nutrition', emoji: '🍎', label: 'Nutrition', color: '#fdcb6e', priority: 6, description: 'Feeding & diet' },
  { id: 'safety', emoji: '🛡️', label: 'Safety', color: '#d63031', priority: 7, description: 'Safety incidents & checks' },
  { id: 'schedule', emoji: '⏰', label: 'Schedule & Routine', color: '#0984e3', priority: 8, description: 'Sleep & daily schedule' },
  { id: 'parental', emoji: '👨‍👩‍👧', label: 'Parental Care', color: '#6c5ce7', priority: 9, description: 'Notes & memories' },
  { id: 'travel', emoji: '✈️', label: 'Travel & Outings', color: '#00cec9', priority: 10, description: 'Trips & activities' },
  { id: 'special_needs', emoji: '♿', label: 'Special Needs', color: '#e17055', priority: 11, description: 'Special care tracking' },
  { id: 'custom', emoji: '✨', label: 'Custom Trackers', color: '#fd79a8', priority: 12, description: 'Your custom trackers' },
];

export const CATEGORY_CONFIG: Record<TrackerCategory, { emoji: string; label: string; color: string; priority: number; description: string }> = 
  TRACKER_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: cat }), {} as any);

export const TRACKER_FIELD_TYPES: { type: FieldType; label: string; icon: string }[] = [
  { type: 'text', label: 'Short Text', icon: 'text-outline' },
  { type: 'textarea', label: 'Long Text', icon: 'reader-outline' },
  { type: 'number', label: 'Number', icon: 'calculator-outline' },
  { type: 'select', label: 'Single Choice', icon: 'radio-button-on-outline' },
  { type: 'multiselect', label: 'Multiple Choice', icon: 'checkbox-outline' },
  { type: 'toggle', label: 'Yes/No Toggle', icon: 'toggle-outline' },
  { type: 'duration', label: 'Duration', icon: 'time-outline' },
  { type: 'rating', label: 'Star Rating', icon: 'star-outline' },
  { type: 'slider', label: 'Slider', icon: 'options-outline' },
  { type: 'temperature', label: 'Temperature', icon: 'thermometer-outline' },
  { type: 'photo', label: 'Photo', icon: 'camera-outline' },
  { type: 'mood_emoji', label: 'Mood Emoji', icon: 'happy-outline' },
];

export const MOOD_EMOJIS = ['😭', '😟', '😐', '🙂', '😄'];

export const DURATION_PRESETS = ['5m', '10m', '15m', '20m', '30m', '45m', '1h', '1.5h', '2h', '3h+'];

export const TRACKER_EMOJIS = [
  '📝', '💊', '🍼', '😴', '🛁', '📏', '🌡️', '💩', '🤱', '🏆', 
  '🎵', '📚', '🌳', '👋', '💬', '❤️', '😭', '😌', '💅', '🦷', 
  '👂', '👃', '🥄', '💧', '✈️', '🚗', '🏫', '👤', '😣', '😰', 
  '💨', '🔴', '🎯', '🎨', '🧩', '⚽', '🎸', '📸', '🎥', '🎙️', 
  '⭐', '🔥', '❄️', '💎', '🌈', '🍀', '🦋', '🦄', '🚀', '💡',
];

export const TRACKER_PICKER_KEYS = {
  RECENT_TRACKERS: '@littleloom_recent_trackers_v2',
  FAVORITE_TRACKERS: '@littleloom_favorite_trackers_v2',
};
