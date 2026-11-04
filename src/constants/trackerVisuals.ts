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
    // ── Health extras ──
  vaccine:        { emoji: '💉', icon: 'shield-checkmark-outline', color: '#e11d48', label: 'Vaccine',       gradient: ['#e11d48', '#fb7185'] },
  doctor_visit:   { emoji: '👨‍⚕️', icon: 'medical-outline',       color: '#00d2d3', label: 'Doctor Visit',   gradient: ['#00d2d3', '#54a0ff'] },
  teething:       { emoji: '🦷', icon: 'sad-outline',             color: '#ff6b6b', label: 'Teething',       gradient: ['#ff6b6b', '#ff9f43'] },
  allergy:        { emoji: '🤧', icon: 'warning-outline',         color: '#ee5a24', label: 'Allergy',        gradient: ['#ee5a24', '#ff6b6b'] },
  skin_condition: { emoji: '🔴', icon: 'sunny-outline',           color: '#f368e0', label: 'Skin',           gradient: ['#f368e0', '#ff9ff3'] },

  // ── Development extras ──
  speech:         { emoji: '💬', icon: 'chatbubble-outline',      color: '#54a0ff', label: 'Speech',         gradient: ['#54a0ff', '#5f27cd'] },

  // ── Emotional ──
  mood:           { emoji: '😊', icon: 'happy-outline',           color: '#ffd700', label: 'Mood',           gradient: ['#ffd700', '#ff9f43'] },
  crying:         { emoji: '😭', icon: 'sad-outline',             color: '#5f27cd', label: 'Crying',         gradient: ['#5f27cd', '#341f97'] },

  // ── Physical care ──
  nail_care:      { emoji: '💅', icon: 'cut-outline',             color: '#ff9ff3', label: 'Nail Care',      gradient: ['#ff9ff3', '#f368e0'] },
  oral_hygiene:   { emoji: '🦷', icon: 'tooth-outline',           color: '#54a0ff', label: 'Oral Care',      gradient: ['#54a0ff', '#5f27cd'] },
  sunscreen:      { emoji: '☀️', icon: 'sunny-outline',           color: '#ffd700', label: 'Sunscreen',      gradient: ['#ffd700', '#ff9f43'] },
  skin_care:      { emoji: '🧴', icon: 'water-outline',           color: '#f368e0', label: 'Skin Care',      gradient: ['#f368e0', '#ff9ff3'] },

  // ── Nutrition ──
  solid_food:     { emoji: '🥄', icon: 'restaurant-outline',      color: '#ff9f43', label: 'Solid Food',     gradient: ['#ff9f43', '#ffd700'] },
  water:          { emoji: '💧', icon: 'water-outline',           color: '#48dbfb', label: 'Water',          gradient: ['#48dbfb', '#0abde3'] },
  vitamin:        { emoji: '💊', icon: 'nutrition-outline',       color: '#1dd1a1', label: 'Vitamin',        gradient: ['#1dd1a1', '#10ac84'] },
  allergen_intro: { emoji: '🥜', icon: 'warning-outline',         color: '#ee5a24', label: 'Allergen',       gradient: ['#ee5a24', '#ff6b6b'] },

  // ── Safety ──
  accident:       { emoji: '⚠️', icon: 'alert-triangle-outline',  color: '#ee5a24', label: 'Accident',       gradient: ['#ee5a24', '#ff6b6b'] },
  car_seat:       { emoji: '🚗', icon: 'car-outline',             color: '#5f27cd', label: 'Car Seat',       gradient: ['#5f27cd', '#341f97'] },
  babyproofing:   { emoji: '🛡️', icon: 'shield-checkmark-outline',color: '#1dd1a1', label: 'Babyproofing',   gradient: ['#1dd1a1', '#10ac84'] },

  // ── Schedule ──
  bedtime:        { emoji: '🌙', icon: 'moon-outline',            color: '#5f27cd', label: 'Bedtime',        gradient: ['#5f27cd', '#341f97'] },
  screen_time:    { emoji: '📱', icon: 'phone-portrait-outline',  color: '#5f27cd', label: 'Screen Time',    gradient: ['#5f27cd', '#ff6b6b'] },

  // ── Parental ──
  photo:          { emoji: '📸', icon: 'camera-outline',          color: '#ff9ff3', label: 'Photo',          gradient: ['#ff9ff3', '#f368e0'] },
  journal:        { emoji: '📔', icon: 'journal-outline',         color: '#ffd700', label: 'Journal',        gradient: ['#ffd700', '#ff9f43'] },

  // ── Travel ──
  trip:           { emoji: '✈️', icon: 'airplane-outline',        color: '#54a0ff', label: 'Trip',           gradient: ['#54a0ff', '#5f27cd'] },
  daycare:        { emoji: '🏫', icon: 'school-outline',          color: '#ffd700', label: 'Daycare',        gradient: ['#ffd700', '#ff9f43'] },
  babysitter:     { emoji: '👤', icon: 'person-outline',          color: '#ff9ff3', label: 'Babysitter',     gradient: ['#ff9ff3', '#f368e0'] },

  // ── Special needs ──
  reflux:         { emoji: '😣', icon: 'arrow-up-outline',        color: '#ff6b6b', label: 'Reflux',         gradient: ['#ff6b6b', '#ee5a24'] },
  colic:          { emoji: '😭', icon: 'time-outline',            color: '#5f27cd', label: 'Colic',          gradient: ['#5f27cd', '#341f97'] },
  constipation:   { emoji: '😣', icon: 'remove-circle-outline',   color: '#ee5a24', label: 'Constipation',   gradient: ['#ee5a24', '#ff6b6b'] },
  diarrhea:       { emoji: '💩', icon: 'water-outline',           color: '#1dd1a1', label: 'Diarrhea',       gradient: ['#1dd1a1', '#48dbfb'] },

  // ── Household ──
  supply_inventory:{ emoji: '📦', icon: 'cube-outline',           color: '#8e44ad', label: 'Supplies',       gradient: ['#8e44ad', '#9b59b6'] },
  expenses:       { emoji: '💰', icon: 'cash-outline',            color: '#f39c12', label: 'Expenses',       gradient: ['#f39c12', '#e67e22'] },
  cleaning:       { emoji: '🧼', icon: 'sparkles-outline',        color: '#00b894', label: 'Cleaning',       gradient: ['#00b894', '#00cec9'] },
};

export const getTrackerVisual = (id?: string) =>
  TRACKER_VISUALS[id || ''] || TRACKER_VISUALS.default;