import type { Ionicons } from '@expo/vector-icons';

export const TRACKER_VISUALS: Record<
  string,
  { emoji: string; icon: keyof typeof Ionicons.glyphMap; color: string; label: string; gradient: [string, string] }
> = {
  feed:      { emoji: '🍼', icon: 'restaurant-outline',   color: '#f59e0b', label: 'Feeding',    gradient: ['#f59e0b', '#fbbf24'] },
  sleep:     { emoji: '😴', icon: 'moon-outline',         color: '#8b5cf6', label: 'Sleep',      gradient: ['#8b5cf6', '#a78bfa'] },
  diaper:    { emoji: '🧷', icon: 'shirt-outline',        color: '#3b82f6', label: 'Diaper',     gradient: ['#3b82f6', '#60a5fa'] },
  potty:     { emoji: '🚽', icon: 'water-outline',        color: '#06b6d4', label: 'Potty',      gradient: ['#06b6d4', '#22d3ee'] },
  growth:    { emoji: '📏', icon: 'trending-up-outline',  color: '#10b981', label: 'Growth',     gradient: ['#10b981', '#34d399'] },
  medication:{ emoji: '💊', icon: 'medical-outline',      color: '#ef4444', label: 'Medication', gradient: ['#ef4444', '#f87171'] },
  milestone: { emoji: '🏆', icon: 'trophy-outline',       color: '#fbbf24', label: 'Milestone',  gradient: ['#fbbf24', '#fcd34d'] },
  note:      { emoji: '📝', icon: 'document-text-outline',color: '#6b7280', label: 'Note',       gradient: ['#6b7280', '#9ca3af'] },
  pump:      { emoji: '🔄', icon: 'swap-horizontal-outline', color: '#8b5cf6', label: 'Pump',    gradient: ['#8b5cf6', '#a78bfa'] },
  pumping:   { emoji: '🔄', icon: 'swap-horizontal-outline', color: '#8b5cf6', label: 'Pumping', gradient: ['#8b5cf6', '#a78bfa'] },
  bath:      { emoji: '🛁', icon: 'water-outline',        color: '#3b82f6', label: 'Bath',       gradient: ['#3b82f6', '#60a5fa'] },
  play:      { emoji: '🎮', icon: 'game-controller-outline', color: '#ec4899', label: 'Play',    gradient: ['#ec4899', '#f472b6'] },
  walk:      { emoji: '🚶', icon: 'walk-outline',         color: '#10b981', label: 'Walk',       gradient: ['#10b981', '#34d399'] },
  temperature:{ emoji: '🌡️', icon: 'thermometer-outline', color: '#f97316', label: 'Temp',      gradient: ['#f97316', '#fb923c'] },
  symptom:   { emoji: '🤒', icon: 'pulse-outline',        color: '#ef4444', label: 'Symptom',    gradient: ['#ef4444', '#f87171'] },
  tummy_time:{ emoji: '🤸', icon: 'fitness-outline',      color: '#10b981', label: 'Tummy Time', gradient: ['#10b981', '#34d399'] },
  reading:   { emoji: '📚', icon: 'book-outline',         color: '#6366f1', label: 'Reading',    gradient: ['#6366f1', '#818cf8'] },
  default:   { emoji: '•',  icon: 'ellipse-outline',      color: '#9ca3af', label: 'Activity',   gradient: ['#9ca3af', '#cbd5e1'] },
};

export const getTrackerVisual = (id?: string) =>
  TRACKER_VISUALS[id || ''] || TRACKER_VISUALS.default;