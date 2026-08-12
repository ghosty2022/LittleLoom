import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
  Platform,
  TextInput,
  Modal,
  Pressable,
  Dimensions,
  Share,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useCustomization } from '@/hooks/useCustomization';
import { useSweetAlert } from '@/hooks/useSweetAlert';
import { Ionicons } from '@expo/vector-icons';
import { useTracker } from '@/context/TrackerContext';
import { useBaby } from '@/context/BabyContext';
import { useFamily } from '@/context/FamilyContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeInUp,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, differenceInMonths, differenceInYears, differenceInDays, subDays } from 'date-fns';

const { width: SCREEN_W } = Dimensions.get('window');

/* ── Types ── */
interface ReportSection {
  id: string;
  label: string;
  emoji: string;
  enabled: boolean;
  description: string;
}

interface TrackerEntry {
  id: string;
  trackerId: string;
  trackerName: string;
  trackerCategory: string;
  timestamp: string;
  data: Record<string, any>;
  photos?: string[];
  duration?: number;
  amount?: number;
}

type ReportTemplate = 'visit' | 'full' | 'growth' | 'emergency';

/* ── Helpers ── */
const formatDate = (iso: string | number) => {
  try {
    return format(new Date(iso), 'MMM d, yyyy h:mm a');
  } catch {
    return 'Invalid date';
  }
};

const escapeHtml = (str: string) =>
  str
    ?.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;') || '';

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/* ── Theme Hook (matches your HubScreen) ── */
const useReportTheme = () => {
  const { isDark, colors, fullThemeColors, borderRadiusValue } = useCustomization();
  return useMemo(() => ({
    primary: colors?.primary || '#667eea',
    secondary: colors?.secondary || '#764ba2',
    isDark: !!isDark,
    bg: fullThemeColors?.background || (isDark ? '#0a0a1a' : '#f8faff'),
    surface: fullThemeColors?.surface || (isDark ? 'rgba(30,30,45,0.8)' : 'rgba(255,255,255,0.9)'),
    card: fullThemeColors?.card || (isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)'),
    border: fullThemeColors?.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
    text: {
      primary: fullThemeColors?.text || (isDark ? '#ffffff' : '#1a1a1a'),
      secondary: fullThemeColors?.textSecondary || (isDark ? '#94a3b8' : '#64748b'),
      muted: fullThemeColors?.textMuted || (isDark ? '#64748b' : '#94a3b8'),
    },
    radius: borderRadiusValue || 16,
  }), [isDark, colors, fullThemeColors, borderRadiusValue]);
};

/* ── Glass Card ── */
const GlassCard = ({ children, style, onPress, active }: any) => {
  const theme = useReportTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={0.85} style={[s.glassCard, { borderRadius: theme.radius }, active && { borderColor: theme.primary, borderWidth: 2 }, style]}>
      <LinearGradient
        colors={theme.isDark ? ['rgba(45,45,60,0.9)', 'rgba(35,35,50,0.7)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.8)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[s.glassBorder, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' }]} />
      <View style={s.glassContent}>{children}</View>
    </Wrapper>
  );
};

/* ── Section Header ── */
const SectionHeader = ({ title, subtitle, icon }: any) => {
  const theme = useReportTheme();
  return (
    <View style={s.sectionHeader}>
      {icon && (
        <View style={[s.sectionIcon, { backgroundColor: `${theme.primary}12` }]}>
          <Ionicons name={icon} size={16} color={theme.primary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[s.sectionTitle, { color: theme.text.primary }]}>{title}</Text>
        {subtitle && <Text style={[s.sectionSubtitle, { color: theme.text.muted }]}>{subtitle}</Text>}
      </View>
    </View>
  );
};

/* ── Main Component ── */
export const PediatricianPDFExport: React.FC = () => {
  const theme = useReportTheme();
  const insets = useSafeAreaInsets();
  const { currentBaby, babies } = useBaby();
  const { entries } = useTracker();
  const { parent1, parent2, guardians } = useFamily();
  const sweetAlert = useSweetAlert();
  
  const [generating, setGenerating] = useState(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [template, setTemplate] = useState<ReportTemplate>('full');
  const [customNotes, setCustomNotes] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [reportHistory, setReportHistory] = useState<{ path: string; date: string; name: string }[]>([]);
  const [includePhotos, setIncludePhotos] = useState(false);
  
  const [sections, setSections] = useState<ReportSection[]>([
    { id: 'summary', label: 'Visit Summary', emoji: '📋', enabled: true, description: 'Overview of recent visits and stats' },
    { id: 'babyInfo', label: 'Child Profile', emoji: '👶', enabled: true, description: 'Name, age, blood type, allergies' },
    { id: 'family', label: 'Family Contacts', emoji: '👨‍👩‍👧', enabled: true, description: 'Parents and guardians info' },
    { id: 'growth', label: 'Growth Charts', emoji: '📈', enabled: true, description: 'Weight, height, head circumference trends' },
    { id: 'health', label: 'Health Events', emoji: '🏥', enabled: true, description: 'Doctor visits, symptoms, temperatures' },
    { id: 'medications', label: 'Medications', emoji: '💊', enabled: true, description: 'Current and recent medications' },
    { id: 'vaccines', label: 'Vaccinations', emoji: '💉', enabled: true, description: 'Immunization records' },
    { id: 'feeding', label: 'Feeding & Nutrition', emoji: '🍼', enabled: true, description: 'Feeding logs and patterns' },
    { id: 'sleep', label: 'Sleep Patterns', emoji: '😴', enabled: true, description: 'Sleep duration and quality analysis' },
    { id: 'milestones', label: 'Milestones', emoji: '🧠', enabled: true, description: 'Developmental achievements' },
    { id: 'notes', label: 'Custom Notes', emoji: '📝', enabled: true, description: 'Your notes for the pediatrician' },
  ]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });
  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 80], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const applyTemplate = (t: ReportTemplate) => {
    setTemplate(t);
    const presets: Record<ReportTemplate, string[]> = {
      visit: ['summary', 'babyInfo', 'family', 'health', 'medications', 'notes'],
      full: sections.map(s => s.id),
      growth: ['babyInfo', 'growth', 'feeding', 'sleep', 'milestones'],
      emergency: ['babyInfo', 'family', 'health', 'medications', 'symptoms', 'notes'],
    };
    setSections(prev => prev.map(s => ({ ...s, enabled: presets[t].includes(s.id) })));
  };

  const filteredEntries = useMemo(() => {
    if (dateRange === 'all') return entries;
    const days = { '7d': 7, '30d': 30, '90d': 90 };
    const cutoff = subDays(new Date(), days[dateRange]).getTime();
    return entries.filter((e: TrackerEntry) => new Date(e.timestamp).getTime() > cutoff);
  }, [entries, dateRange]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const todayEntries = filteredEntries.filter((e: TrackerEntry) => new Date(e.timestamp) >= today);
    return {
      total: filteredEntries.length,
      today: todayEntries.length,
      trackers: new Set(filteredEntries.map((e: TrackerEntry) => e.trackerId)).size,
      lastEntry: filteredEntries[0] ? formatDate(filteredEntries[0].timestamp) : 'None',
    };
  }, [filteredEntries]);

  /* ── PDF HTML Generator ── */
  const generateHTML = useCallback(() => {
    const baby = currentBaby;
    const babyName = baby?.name || 'Baby';
    const babyDob = baby?.birthDate ? format(new Date(baby.birthDate), 'MMM d, yyyy') : 'N/A';
    
    const ageText = baby?.birthDate ? (() => {
      const birth = new Date(baby.birthDate);
      const years = differenceInYears(new Date(), birth);
      const months = differenceInMonths(new Date(), birth) % 12;
      const days = differenceInDays(new Date(), birth) % 30;
      if (years > 0) return `${years} year${years !== 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''}`;
      if (months > 0) return `${months} month${months !== 1 ? 's' : ''}, ${days} day${days !== 1 ? 's' : ''}`;
      return `${days} day${days !== 1 ? 's' : ''}`;
    })() : 'N/A';

    const enabledIds = new Set(sections.filter(s => s.enabled).map(s => s.id));
    const rangeLabel = dateRange === '7d' ? 'Last 7 Days' : dateRange === '30d' ? 'Last 30 Days' : dateRange === '90d' ? 'Last 90 Days' : 'All Time';

    /* Family Info */
    const familyHTML = () => {
      const contacts: string[] = [];
      if (parent1) contacts.push(`<div class="contact-card"><strong>${escapeHtml(parent1.fullName || 'Parent 1')}</strong><br/>${parent1.relationship || 'Parent'}${parent1.phoneNumber ? `<br/>📞 ${escapeHtml(parent1.phoneNumber)}` : ''}${parent1.email ? `<br/>✉️ ${escapeHtml(parent1.email)}` : ''}</div>`);
      if (parent2) contacts.push(`<div class="contact-card"><strong>${escapeHtml(parent2.fullName || 'Parent 2')}</strong><br/>${parent2.relationship || 'Parent'}${parent2.phoneNumber ? `<br/>📞 ${escapeHtml(parent2.phoneNumber)}` : ''}${parent2.email ? `<br/>✉️ ${escapeHtml(parent2.email)}` : ''}</div>`);
      guardians?.forEach((g: any) => {
        contacts.push(`<div class="contact-card"><strong>${escapeHtml(g.fullName || 'Guardian')}</strong><br/>${escapeHtml(g.relationship || 'Guardian')}${g.phoneNumber ? `<br/>📞 ${escapeHtml(g.phoneNumber)}` : ''}${g.email ? `<br/>✉️ ${escapeHtml(g.email)}` : ''}</div>`);
      });
      return contacts.length ? `<div class="grid-2">${contacts.join('')}</div>` : '<p class="muted">No family contacts recorded.</p>';
    };

    /* Baby Profile */
    const babyProfileHTML = () => `
      <div class="grid-3">
        <div class="metric"><div class="metric-value">${escapeHtml(babyName)}</div><div class="metric-label">Name</div></div>
        <div class="metric"><div class="metric-value">${ageText}</div><div class="metric-label">Age</div></div>
        <div class="metric"><div class="metric-value">${babyDob}</div><div class="metric-label">Date of Birth</div></div>
      </div>
      ${baby?.gender ? `<p><strong>Gender:</strong> ${escapeHtml(baby.gender)}</p>` : ''}
      ${baby?.bloodType ? `<p><strong>Blood Type:</strong> ${escapeHtml(baby.bloodType)}</p>` : ''}
      ${baby?.allergies?.length ? `<div class="alert-box"><strong>⚠️ Allergies:</strong> ${escapeHtml(baby.allergies.join(', '))}</div>` : ''}
      ${baby?.medicalNotes ? `<div class="info-box"><strong>Medical Notes:</strong> ${escapeHtml(baby.medicalNotes)}</div>` : ''}
    `;

    /* Growth Chart SVG */
    const growthChartHTML = () => {
      const growthEntries = filteredEntries.filter((e: TrackerEntry) => e.trackerId === 'growth').sort((a: TrackerEntry, b: TrackerEntry) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      if (growthEntries.length < 2) return '<p class="muted">Not enough growth data for chart.</p>';

      const W = 700, H = 280, pad = 50;
      const makeSeries = (key: string, color: string) => {
        const vals = growthEntries.map((e: TrackerEntry) => parseFloat(e.data?.[key]) || 0).filter((v: number) => v > 0);
        if (vals.length < 2) return '';
        const max = Math.max(...vals, 1);
        const min = Math.min(...vals, 0);
        const points = vals.map((v: number, i: number) => {
          const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
          const y = H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2);
          return `${x},${y}`;
        }).join(' ');
        return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <text x="${W-pad}" y="${pad}" text-anchor="end" font-size="11" fill="${color}" font-weight="600">${key.charAt(0).toUpperCase() + key.slice(1)}</text>`;
      };

      return `
        <div class="chart-wrap">
          <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="background:#f8fafc;border-radius:12px;">
            <text x="${W/2}" y="24" text-anchor="middle" font-size="16" font-weight="bold" fill="#1e293b">Growth Trends</text>
            ${makeSeries('weight', '#667eea')}
            ${makeSeries('height', '#10b981')}
            ${makeSeries('head', '#f59e0b')}
            <line x1="${pad}" y1="${H-pad}" x2="${W-pad}" y2="${H-pad}" stroke="#e2e8f0" stroke-width="1"/>
            <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${H-pad}" stroke="#e2e8f0" stroke-width="1"/>
          </svg>
        </div>
        <div class="grid-3" style="margin-top:12px;">
          ${['weight','height','head'].map(k => {
            const last = [...growthEntries].reverse().find((e: TrackerEntry) => e.data?.[k]);
            return `<div class="card" style="text-align:center;"><strong style="color:#64748b;font-size:11px;text-transform:uppercase;">${k}</strong><br/><span style="font-size:20px;font-weight:800;color:#1e293b;">${last ? `${last.data[k]} ${last.data.unit || ''}` : '--'}</span></div>`;
          }).join('')}
        </div>
      `;
    };

    /* Generic Entry Table */
    const buildTable = (trackerIds: string[], title: string, emoji: string, columns: string[]) => {
      const items = filteredEntries.filter((e: TrackerEntry) => trackerIds.includes(e.trackerId));
      if (!items.length) return '';
      const rows = items.slice(0, 50).map((e: TrackerEntry) => {
        const data = e.data || {};
        const details = Object.entries(data).filter(([k]) => !['notes','photos','syncedAt'].includes(k)).map(([k,v]) => `${k}: ${v}`).join(', ');
        return `<tr>
          <td>${formatDate(e.timestamp)}</td>
          <td><strong>${escapeHtml(e.trackerName || e.trackerId)}</strong></td>
          <td>${escapeHtml(details)}${data.notes ? `<br/><em style="color:#64748b;">${escapeHtml(String(data.notes))}</em>` : ''}</td>
        </tr>`;
      }).join('');
      return `
        <div class="section">
          <h2>${emoji} ${title}</h2>
          <table><thead><tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody></table>
        </div>`;
    };

    /* Summary Section */
    const summaryHTML = () => {
      const recentVisits = filteredEntries.filter((e: TrackerEntry) => ['doctor_visit','dental_visit','therapy'].includes(e.trackerId));
      const recentMeds = filteredEntries.filter((e: TrackerEntry) => e.trackerId === 'medication');
      const recentSymptoms = filteredEntries.filter((e: TrackerEntry) => ['symptom','temperature','allergy'].includes(e.trackerId));
      const growth = filteredEntries.filter((e: TrackerEntry) => e.trackerId === 'growth');
      const lastGrowth = growth[growth.length - 1];
      
      return `
        <div class="section">
          <h2>📋 Visit Summary</h2>
          <p style="color:#64748b;font-size:13px;margin-bottom:16px;">Report period: <strong>${rangeLabel}</strong> | Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}</p>
          <div class="grid-2">
            <div class="card"><strong>Total Entries</strong><br/><span style="font-size:24px;font-weight:800;color:#667eea;">${filteredEntries.length}</span></div>
            <div class="card"><strong>Health Events</strong><br/><span style="font-size:24px;font-weight:800;color:#ef4444;">${recentVisits.length}</span></div>
            <div class="card"><strong>Medications Logged</strong><br/><span style="font-size:24px;font-weight:800;color:#f59e0b;">${recentMeds.length}</span></div>
            <div class="card"><strong>Symptoms Logged</strong><br/><span style="font-size:24px;font-weight:800;color:#8b5cf6;">${recentSymptoms.length}</span></div>
          </div>
          ${lastGrowth ? `
            <div style="margin-top:16px;padding:16px;background:linear-gradient(135deg,#667eea08,#764ba208);border-radius:12px;border:1px solid #e2e8f0;">
              <strong>Latest Growth:</strong> ${lastGrowth.data?.weight ? `Weight ${lastGrowth.data.weight}${lastGrowth.data.unit || 'kg'}` : ''} 
              ${lastGrowth.data?.height ? `| Height ${lastGrowth.data.height}${lastGrowth.data.unit || 'cm'}` : ''}
            </div>
          ` : ''}
        </div>
      `;
    };

    /* Custom Notes */
    const notesHTML = customNotes.trim() ? `
      <div class="section">
        <h2>📝 Notes for Pediatrician</h2>
        <div class="info-box" style="white-space:pre-wrap;">${escapeHtml(customNotes)}</div>
      </div>
    ` : '';

    /* Assemble */
    const sectionsHTML = [
      enabledIds.has('summary') ? summaryHTML() : '',
      enabledIds.has('babyInfo') ? `<div class="section"><h2>👶 Child Profile</h2>${babyProfileHTML()}</div>` : '',
      enabledIds.has('family') ? `<div class="section"><h2>👨‍👩‍👧 Family Contacts</h2>${familyHTML()}</div>` : '',
      enabledIds.has('growth') ? `<div class="section"><h2>📈 Growth & Development</h2>${growthChartHTML()}</div>` : '',
      enabledIds.has('health') ? buildTable(['doctor_visit','dental_visit','therapy','symptom','temperature','allergy','skin_condition'], 'Health Events', '🏥', ['Date','Type','Details']) : '',
      enabledIds.has('medications') ? buildTable(['medication'], 'Medications', '💊', ['Date','Name','Details']) : '',
      enabledIds.has('vaccines') ? buildTable(['vaccine','immunization'], 'Vaccinations', '💉', ['Date','Vaccine','Details']) : '',
      enabledIds.has('feeding') ? buildTable(['feed','solid_food','breastfeeding','bottle_weaning','snack','water','vitamin'], 'Feeding & Nutrition', '🍼', ['Date','Type','Details']) : '',
      enabledIds.has('sleep') ? buildTable(['sleep','nap','wake_time','bedtime','dream_feed'], 'Sleep Patterns', '😴', ['Date','Type','Details']) : '',
      enabledIds.has('milestones') ? buildTable(['milestone','fine_motor','gross_motor','speech','pretend_play'], 'Milestones', '🧠', ['Date','Milestone','Details']) : '',
      enabledIds.has('notes') ? notesHTML : '',
    ].filter(Boolean).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(babyName)} - Pediatric Report</title>
  <style>
    @page { margin: 32px; size: auto; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 24px; background: #fff; }
    .header { text-align: center; padding-bottom: 20px; border-bottom: 3px solid #667eea; margin-bottom: 28px; }
    .header h1 { margin: 0; font-size: 28px; color: #1e293b; letter-spacing: -0.5px; }
    .header .subtitle { color: #64748b; font-size: 13px; margin-top: 6px; font-weight: 500; }
    .baby-info { display: flex; justify-content: center; gap: 24px; margin-top: 14px; flex-wrap: wrap; }
    .baby-info span { font-size: 13px; color: #64748b; }
    .baby-info strong { color: #1e293b; }
    .section { margin-bottom: 28px; page-break-inside: avoid; }
    .section h2 { font-size: 17px; color: #667eea; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; font-weight: 800; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .card { background: #f8fafc; border-radius: 12px; padding: 16px; font-size: 13px; border: 1px solid #e2e8f0; }
    .metric { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 18px; text-align: center; color: white; }
    .metric-value { font-size: 22px; font-weight: 800; word-break: break-word; }
    .metric-label { font-size: 11px; opacity: 0.9; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    th { background: #f8fafc; font-weight: 700; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    tr:hover { background: #f8fafc; }
    .chart-wrap { margin-top: 12px; text-align: center; }
    .muted { color: #94a3b8; font-style: italic; }
    .alert-box { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px; border-radius: 10px; margin: 12px 0; font-size: 13px; }
    .info-box { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 12px; border-radius: 10px; margin: 12px 0; font-size: 13px; }
    .contact-card { background: #f8fafc; border-radius: 10px; padding: 14px; border: 1px solid #e2e8f0; font-size: 13px; line-height: 1.8; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
    @media print { body { padding: 0; } .section { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏥 Pediatric Visit Report</h1>
    <div class="subtitle">Generated by LittleLoom on ${format(new Date(), 'MMMM d, yyyy')}</div>
    <div class="baby-info">
      <span><strong>Patient:</strong> ${escapeHtml(babyName)}</span>
      <span><strong>DOB:</strong> ${babyDob}</span>
      <span><strong>Age:</strong> ${ageText}</span>
      ${baby?.gender ? `<span><strong>Gender:</strong> ${escapeHtml(baby.gender)}</span>` : ''}
    </div>
  </div>
  ${sectionsHTML}
  <div class="footer">
    <p>This report was generated from LittleLoom tracking data.</p>
    <p>Not a substitute for professional medical advice. Always consult your pediatrician.</p>
  </div>
</body>
</html>`;
  }, [currentBaby, filteredEntries, sections, dateRange, customNotes, parent1, parent2, guardians]);

  /* ── Generate PDF ── */
  const generatePDF = useCallback(async () => {
    const enabledCount = sections.filter(s => s.enabled).length;
    if (!enabledCount) {
      sweetAlert?.alert?.('No Sections', 'Please enable at least one report section.');
      return;
    }
    if (!currentBaby) {
      sweetAlert?.alert?.('No Baby Selected', 'Please select a baby profile first.');
      return;
    }

    setGenerating(true);
    try {
      const html = generateHTML();
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      
      const safeName = (currentBaby.name || 'Baby').replace(/\s+/g, '_');
      const fileName = `${safeName}_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      const newPath = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.moveAsync({ from: uri, to: newPath });
      
      setReportHistory(prev => [{ path: newPath, date: format(new Date(), 'MMM d, h:mm a'), name: fileName }, ...prev].slice(0, 10));
      
      sweetAlert?.confirm?.('Report Ready!', 'Your pediatric report has been generated. Share it now?', async () => {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(newPath, {
            mimeType: 'application/pdf',
            dialogTitle: `${currentBaby.name}'s Pediatric Report`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          await Share.share({ title: `${currentBaby.name}'s Report`, url: newPath });
        }
      });
    } catch (err) {
      console.error('PDF Error:', err);
      sweetAlert?.alert?.('Generation Failed', 'Could not create PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [generateHTML, sections, currentBaby, sweetAlert]);

  const shareExisting = async (path: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: 'application/pdf' });
    }
  };

  const deleteReport = async (path: string) => {
    try { await FileSystem.deleteAsync(path); } catch {}
    setReportHistory(prev => prev.filter(r => r.path !== path));
  };

  if (!currentBaby) {
    return (
      <View style={[s.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center', padding: 40 }]}>
        <Ionicons name="document-text-outline" size={64} color={theme.text.muted} />
        <Text style={[s.emptyTitle, { color: theme.text.primary, marginTop: 16 }]}>No Baby Profile</Text>
        <Text style={[s.emptySub, { color: theme.text.muted, textAlign: 'center', marginTop: 8 }]}>
          Select a baby profile to generate pediatric reports.
        </Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      {/* Sticky Header */}
      <Animated.View style={[s.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={theme.isDark ? 40 : 80} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[s.stickyTitle, { color: theme.text.primary }]}>{currentBaby.name}'s Report</Text>
        <Text style={[s.stickySubtitle, { color: theme.text.muted }]}>Pediatric Export</Text>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <Animated.View entering={FadeInUp.springify()}>
          <GlassCard style={s.heroCard}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={s.heroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="document-text" size={40} color="#fff" />
              <Text style={s.heroTitle}>Pediatrician Report</Text>
              <Text style={s.heroSub}>Professional PDF export for visits, referrals, and records</Text>
              
              <View style={s.heroStats}>
                <View style={s.heroStat}>
                  <Text style={s.heroStatNum}>{stats.total}</Text>
                  <Text style={s.heroStatLabel}>Entries</Text>
                </View>
                <View style={s.heroStatDivider} />
                <View style={s.heroStat}>
                  <Text style={s.heroStatNum}>{stats.trackers}</Text>
                  <Text style={s.heroStatLabel}>Trackers</Text>
                </View>
                <View style={s.heroStatDivider} />
                <View style={s.heroStat}>
                  <Text style={s.heroStatNum}>{stats.today}</Text>
                  <Text style={s.heroStatLabel}>Today</Text>
                </View>
              </View>
            </LinearGradient>
          </GlassCard>
        </Animated.View>

        {/* Template Selector */}
        <Animated.View entering={FadeInUp.delay(60).springify()}>
          <SectionHeader title="Report Template" icon="layers-outline" subtitle="Choose a starting preset" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.templateScroll}>
            {([
              { id: 'full', label: 'Full Report', icon: 'document-text', desc: 'Everything' },
              { id: 'visit', label: 'Visit Summary', icon: 'medical', desc: 'Essentials only' },
              { id: 'growth', label: 'Growth Focus', icon: 'trending-up', desc: 'Charts & metrics' },
              { id: 'emergency', label: 'Emergency', icon: 'warning', desc: 'Health & contacts' },
            ] as const).map(t => (
              <TouchableOpacity
                key={t.id}
                onPress={() => applyTemplate(t.id as ReportTemplate)}
                style={[
                  s.templateChip,
                  template === t.id && { borderColor: theme.primary, backgroundColor: `${theme.primary}15` }
                ]}
              >
                <Ionicons name={t.icon as any} size={20} color={template === t.id ? theme.primary : theme.text.muted} />
                <Text style={[s.templateLabel, { color: template === t.id ? theme.primary : theme.text.primary }]}>{t.label}</Text>
                <Text style={[s.templateDesc, { color: theme.text.muted }]}>{t.desc}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Date Range */}
        <Animated.View entering={FadeInUp.delay(100).springify()}>
          <SectionHeader title="Date Range" icon="calendar-outline" />
          <View style={s.rangeRow}>
            {(['7d', '30d', '90d', 'all'] as const).map(r => (
              <TouchableOpacity
                key={r}
                onPress={() => setDateRange(r)}
                style={[
                  s.rangeBtn,
                  dateRange === r && { backgroundColor: theme.primary, borderColor: theme.primary }
                ]}
              >
                <Text style={[s.rangeBtnText, { color: dateRange === r ? '#fff' : theme.text.primary }]}>
                  {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : r === '90d' ? '90 Days' : 'All Time'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Sections */}
        <Animated.View entering={FadeInUp.delay(140).springify()}>
          <SectionHeader title="Report Sections" icon="list-outline" subtitle="Toggle what to include" />
          <GlassCard style={s.sectionsCard}>
            {sections.map((sec, idx) => (
              <View key={sec.id} style={[s.sectionRow, idx !== sections.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                <View style={s.sectionRowLeft}>
                  <Text style={s.sectionEmoji}>{sec.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.sectionRowLabel, { color: theme.text.primary }]}>{sec.label}</Text>
                    <Text style={[s.sectionRowDesc, { color: theme.text.muted }]}>{sec.description}</Text>
                  </View>
                </View>
                <Switch
                  value={sec.enabled}
                  onValueChange={() => toggleSection(sec.id)}
                  trackColor={{ false: '#767577', true: `${theme.primary}80` }}
                  thumbColor={sec.enabled ? theme.primary : '#f4f3f4'}
                />
              </View>
            ))}
          </GlassCard>
        </Animated.View>

        {/* Custom Notes */}
        <Animated.View entering={FadeInUp.delay(180).springify()}>
          <SectionHeader title="Notes for Doctor" icon="create-outline" subtitle="Optional concerns or questions" />
          <GlassCard style={s.notesCard}>
            <TextInput
              value={customNotes}
              onChangeText={setCustomNotes}
              placeholder="e.g., Baby has been fussy after feeds, rash on neck..."
              placeholderTextColor={theme.text.muted}
              multiline
              numberOfLines={4}
              style={[s.notesInput, { color: theme.text.primary }]}
              textAlignVertical="top"
            />
          </GlassCard>
        </Animated.View>

        {/* Preview Toggle */}
        <Animated.View entering={FadeInUp.delay(220).springify()}>
          <TouchableOpacity onPress={() => setShowPreview(!showPreview)} style={s.previewToggle}>
            <Ionicons name={showPreview ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.primary} />
            <Text style={[s.previewToggleText, { color: theme.primary }]}>
              {showPreview ? 'Hide Preview' : 'Show Report Preview'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {showPreview && (
          <Animated.View entering={FadeInUp.springify()}>
            <GlassCard style={s.previewCard}>
              <Text style={[s.previewTitle, { color: theme.text.primary }]}>Report Preview</Text>
              <View style={s.previewMeta}>
                <Text style={[s.previewMetaText, { color: theme.text.muted }]}>📋 {sections.filter(s => s.enabled).length} sections</Text>
                <Text style={[s.previewMetaText, { color: theme.text.muted }]}>📅 {dateRange === 'all' ? 'All time' : `Last ${dateRange.replace('d',' days')}`}</Text>
                <Text style={[s.previewMetaText, { color: theme.text.muted }]}>👤 {currentBaby.name}</Text>
              </View>
              <View style={[s.previewBar, { backgroundColor: `${theme.primary}12` }]}>
                <View style={[s.previewBarFill, { width: `${Math.min(100, (filteredEntries.length / 50) * 100)}%`, backgroundColor: theme.primary }]} />
              </View>
              <Text style={[s.previewBarLabel, { color: theme.text.muted }]}>
                {filteredEntries.length} entries will be analyzed
              </Text>
            </GlassCard>
          </Animated.View>
        )}

        {/* Generate Button */}
        <Animated.View entering={FadeInUp.delay(260).springify()}>
          <TouchableOpacity
            onPress={generatePDF}
            disabled={generating}
            style={[s.generateBtn, { backgroundColor: generating ? theme.text.muted : theme.primary }]}
          >
            {generating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={22} color="#fff" />
                <Text style={s.generateBtnText}>Generate PDF Report</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={[s.disclaimer, { color: theme.text.muted }]}>
            Reports are generated locally on your device. No data leaves your phone.
          </Text>
        </Animated.View>

        {/* Report History */}
        {reportHistory.length > 0 && (
          <Animated.View entering={FadeInUp.delay(300).springify()}>
            <SectionHeader title="Recent Reports" icon="time-outline" />
            {reportHistory.map((report, i) => (
              <GlassCard key={report.path} style={s.historyCard}>
                <View style={s.historyLeft}>
                  <View style={[s.historyIconWrap, { backgroundColor: `${theme.primary}12` }]}>
                    <Ionicons name="document" size={20} color={theme.primary} />
                  </View>
                  <View>
                    <Text style={[s.historyName, { color: theme.text.primary }]} numberOfLines={1}>{report.name}</Text>
                    <Text style={[s.historyDate, { color: theme.text.muted }]}>{report.date}</Text>
                  </View>
                </View>
                <View style={s.historyActions}>
                  <TouchableOpacity onPress={() => shareExisting(report.path)} style={s.historyActionBtn}>
                    <Ionicons name="share-outline" size={18} color={theme.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteReport(report.path)} style={s.historyActionBtn}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </GlassCard>
            ))}
          </Animated.View>
        )}

        <View style={{ height: insets.bottom + 20 }} />
      </Animated.ScrollView>
    </View>
  );
};

/* ── Styles ── */
const s = StyleSheet.create({
  container: { flex: 1 },
  
  /* Sticky Header */
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  stickyTitle: { fontSize: 17, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  /* Glass Card Base */
  glassCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  glassContent: { flex: 1 },

  /* Section Header */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 20,
    gap: 10,
  },
  sectionIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  /* Hero */
  heroCard: { marginHorizontal: 16, marginBottom: 20, overflow: 'hidden' },
  heroGradient: { padding: 24, alignItems: 'center', borderRadius: 16 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 12 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4, textAlign: 'center' },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 20 },
  heroStat: { alignItems: 'center', minWidth: 60 },
  heroStatNum: { fontSize: 24, fontWeight: '800', color: '#fff' },
  heroStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginTop: 2 },
  heroStatDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.3)' },

  /* Templates */
  templateScroll: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  templateChip: {
    width: 110,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.06)',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  templateLabel: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  templateDesc: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  /* Date Range */
  rangeRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 16 },
  rangeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'rgba(255,255,255,0.6)' },
  rangeBtnText: { fontSize: 13, fontWeight: '700' },

  /* Sections */
  sectionsCard: { paddingVertical: 4 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  sectionRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 12 },
  sectionEmoji: { fontSize: 20 },
  sectionRowLabel: { fontSize: 15, fontWeight: '700' },
  sectionRowDesc: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  /* Notes */
  notesCard: { padding: 12 },
  notesInput: { fontSize: 14, lineHeight: 20, minHeight: 80, fontWeight: '500' },

  /* Preview */
  previewToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginVertical: 8 },
  previewToggleText: { fontSize: 14, fontWeight: '700' },
  previewCard: { padding: 16 },
  previewTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  previewMeta: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  previewMetaText: { fontSize: 12, fontWeight: '600' },
  previewBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  previewBarFill: { height: '100%', borderRadius: 3 },
  previewBarLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  /* Generate */
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  disclaimer: { textAlign: 'center', fontSize: 12, marginTop: 14, lineHeight: 18, marginHorizontal: 30 },

  /* History */
  historyCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, marginBottom: 10 },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  historyIconWrap: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  historyName: { fontSize: 14, fontWeight: '700', maxWidth: 180 },
  historyDate: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  historyActions: { flexDirection: 'row', gap: 8 },
  historyActionBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.04)' },

  /* Empty */
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySub: { fontSize: 14, lineHeight: 20 },
});

export default PediatricianPDFExport;