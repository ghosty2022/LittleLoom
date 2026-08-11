import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useCustomization } from '@/hooks/useCustomization';
import { useSweetAlert } from '@/hooks/useSweetAlert';
import { Ionicons } from '@expo/vector-icons';
import { useTracker } from '@/context/TrackerContext';
import { useBaby } from '@/context/BabyContext';

// ── Types ────────────────────────────────────────────────────────────────────
interface ReportSection {
  id: string;
  label: string;
  emoji: string;
  enabled: boolean;
}

interface TrackerEntry {
  id: string;
  trackerId: string;
  trackerName: string;
  trackerCategory: string;
  timestamp: string;
  data: Record<string, any>;
  photos?: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const escapeHtml = (str: string) =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const generateGrowthChartSVG = (entries: TrackerEntry[]) => {
  const growthEntries = entries.filter((e) => e.trackerId === 'growth');
  if (growthEntries.length < 2) return '';

  const sorted = [...growthEntries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const weights = sorted.map((e) => parseFloat(e.data.weight) || 0).filter((w) => w > 0);
  const heights = sorted.map((e) => parseFloat(e.data.height) || 0).filter((h) => h > 0);

  if (weights.length < 2 && heights.length < 2) return '';

  const maxW = Math.max(...weights, 20);
  const minW = Math.min(...weights, 0);
  const maxH = Math.max(...heights, 120);
  const minH = Math.min(...heights, 0);

  const W = 600;
  const H = 300;
  const pad = 40;

  const pointsW = weights
    .map((w, i) => {
      const x = pad + (i / (weights.length - 1)) * (W - pad * 2);
      const y = H - pad - ((w - minW) / (maxW - minW)) * (H - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  const pointsH = heights
    .map((h, i) => {
      const x = pad + (i / (heights.length - 1)) * (W - pad * 2);
      const y = H - pad - ((h - minH) / (maxH - minH)) * (H - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f8f9fa" rx="8"/>
      <text x="${W / 2}" y="20" text-anchor="middle" font-size="14" font-weight="bold" fill="#333">Growth Trends</text>
      ${weights.length >= 2 ? `<polyline points="${pointsW}" fill="none" stroke="#667eea" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><text x="${W - pad}" y="${pad}" text-anchor="end" font-size="11" fill="#667eea">Weight (kg)</text>` : ''}
      ${heights.length >= 2 ? `<polyline points="${pointsH}" fill="none" stroke="#00b894" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="5,5"/><text x="${W - pad}" y="${pad + 16}" text-anchor="end" font-size="11" fill="#00b894">Height (cm)</text>` : ''}
      <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="#ddd" stroke-width="1"/>
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${H - pad}" stroke="#ddd" stroke-width="1"/>
    </svg>
  `;
};

// ── Component ────────────────────────────────────────────────────────────────
export const PediatricianPDFExport: React.FC = () => {
  const { theme, glass, borderRadius, spacing } = useCustomization();
  const { sweetAlert } = useSweetAlert();
  const { currentBaby } = useBaby();
  const { entries, trackers } = useTracker();

  const [generating, setGenerating] = useState(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [sections, setSections] = useState<ReportSection[]>([
    { id: 'summary', label: 'Visit Summary', emoji: '📋', enabled: true },
    { id: 'growth', label: 'Growth Charts', emoji: '📈', enabled: true },
    { id: 'health', label: 'Health Events', emoji: '🏥', enabled: true },
    { id: 'medications', label: 'Medications', emoji: '💊', enabled: true },
    { id: 'symptoms', label: 'Symptoms', emoji: '🤒', enabled: true },
    { id: 'vaccines', label: 'Vaccinations', emoji: '💉', enabled: true },
    { id: 'feeding', label: 'Feeding & Nutrition', emoji: '🍼', enabled: true },
    { id: 'sleep', label: 'Sleep Patterns', emoji: '😴', enabled: true },
    { id: 'milestones', label: 'Milestones', emoji: '🧠', enabled: true },
    { id: 'photos', label: 'Photo Documentation', emoji: '📸', enabled: false },
  ]);

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const filteredEntries = useMemo(() => {
    const now = Date.now();
    const ranges: Record<string, number> = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
      all: Infinity,
    };
    const cutoff = now - ranges[dateRange];
    return entries.filter((e: TrackerEntry) => new Date(e.timestamp).getTime() > cutoff);
  }, [entries, dateRange]);

  const generateHTML = useCallback(() => {
    const baby = currentBaby;
    const babyName = baby?.name || 'Baby';
    const babyDob = baby?.dateOfBirth
      ? new Date(baby.dateOfBirth).toLocaleDateString()
      : 'N/A';
    const ageText = baby?.dateOfBirth
      ? (() => {
          const diff = Date.now() - new Date(baby.dateOfBirth).getTime();
          const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30.44));
          const years = Math.floor(months / 12);
          const remMonths = months % 12;
          return years > 0 ? `${years}y ${remMonths}m` : `${months}m`;
        })()
      : 'N/A';

    const enabledIds = new Set(sections.filter((s) => s.enabled).map((s) => s.id));

    // ── Section Builders ─────────────────────────────────────────────────────
    const buildSummary = () => {
      const recentVisits = filteredEntries.filter((e) => e.trackerId === 'doctor_visit');
      const recentMeds = filteredEntries.filter((e) => e.trackerId === 'medication');
      const recentSymptoms = filteredEntries.filter((e) => e.trackerId === 'symptom');

      return `
        <div class="section">
          <h2>📋 Visit Summary</h2>
          <div class="grid-2">
            <div class="card"><strong>Last Doctor Visit:</strong><br/>${recentVisits.length > 0 ? formatDate(recentVisits[recentVisits.length - 1].timestamp) : 'No visits recorded'}</div>
            <div class="card"><strong>Active Medications:</strong><br/>${recentMeds.length} entries</div>
            <div class="card"><strong>Recent Symptoms:</strong><br/>${recentSymptoms.length} logged</div>
            <div class="card"><strong>Total Entries:</strong><br/>${filteredEntries.length} tracked events</div>
          </div>
        </div>
      `;
    };

    const buildGrowth = () => {
      const growthEntries = filteredEntries.filter((e) => e.trackerId === 'growth');
      const latest = growthEntries[growthEntries.length - 1];
      const chartSvg = generateGrowthChartSVG(filteredEntries);

      return `
        <div class="section">
          <h2>📈 Growth & Development</h2>
          ${latest ? `
            <div class="grid-3">
              <div class="metric"><div class="metric-value">${latest.data.weight || '--'} kg</div><div class="metric-label">Weight</div></div>
              <div class="metric"><div class="metric-value">${latest.data.height || '--'} cm</div><div class="metric-label">Height</div></div>
              <div class="metric"><div class="metric-value">${latest.data.head || '--'} cm</div><div class="metric-label">Head</div></div>
            </div>
          ` : '<p class="muted">No growth measurements in selected period.</p>'}
          ${chartSvg ? `<div class="chart">${chartSvg}</div>` : ''}
        </div>
      `;
    };

    const buildEntriesTable = (trackerIds: string[], title: string, emoji: string) => {
      const items = filteredEntries.filter((e) => trackerIds.includes(e.trackerId));
      if (items.length === 0) return '';

      const rows = items
        .slice(-20)
        .reverse()
        .map((e) => {
          const dataSummary = Object.entries(e.data)
            .filter(([k]) => !['notes', 'photos'].includes(k))
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          const notes = e.data.notes ? `<br/><em>${escapeHtml(String(e.data.notes))}</em>` : '';
          return `
            <tr>
              <td>${formatDate(e.timestamp)}</td>
              <td><strong>${escapeHtml(e.trackerName)}</strong></td>
              <td>${escapeHtml(dataSummary)}${notes}</td>
            </tr>
          `;
        })
        .join('');

      return `
        <div class="section">
          <h2>${emoji} ${title}</h2>
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Details</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    };

    const buildPhotos = () => {
      const photoEntries = filteredEntries.filter((e) => e.photos && e.photos.length > 0);
      if (photoEntries.length === 0) return '';

      // Note: Real implementation would base64-encode images
      return `
        <div class="section">
          <h2>📸 Photo Documentation</h2>
          <p class="muted">${photoEntries.length} entries with photos. (Photos available in app)</p>
        </div>
      `;
    };

    // ── Assemble HTML ────────────────────────────────────────────────────────
    const sectionsHTML = [
      enabledIds.has('summary') ? buildSummary() : '',
      enabledIds.has('growth') ? buildGrowth() : '',
      enabledIds.has('health') ? buildEntriesTable(['doctor_visit', 'dental_visit', 'therapy'], 'Health Events', '🏥') : '',
      enabledIds.has('medications') ? buildEntriesTable(['medication'], 'Medications', '💊') : '',
      enabledIds.has('symptoms') ? buildEntriesTable(['symptom', 'temperature', 'allergy', 'skin_condition'], 'Symptoms & Conditions', '🤒') : '',
      enabledIds.has('vaccines') ? buildEntriesTable(['vaccine', 'immunization'], 'Vaccinations', '💉') : '',
      enabledIds.has('feeding') ? buildEntriesTable(['feed', 'solid_food', 'breastfeeding', 'bottle_weaning', 'snack', 'water', 'vitamin'], 'Feeding & Nutrition', '🍼') : '',
      enabledIds.has('sleep') ? buildEntriesTable(['sleep', 'nap', 'wake_time', 'bedtime', 'dream_feed'], 'Sleep Patterns', '😴') : '',
      enabledIds.has('milestones') ? buildEntriesTable(['milestone', 'fine_motor', 'gross_motor', 'speech', 'pretend_play'], 'Milestones', '🧠') : '',
      enabledIds.has('photos') ? buildPhotos() : '',
    ]
      .filter(Boolean)
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${babyName} - Pediatric Report</title>
  <style>
    @page { margin: 40px; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #2d3436;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #fff;
    }
    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 3px solid #667eea;
      margin-bottom: 30px;
    }
    .header h1 { margin: 0; font-size: 28px; color: #2d3436; }
    .header .subtitle { color: #636e72; font-size: 14px; margin-top: 6px; }
    .baby-info {
      display: flex;
      justify-content: center;
      gap: 30px;
      margin-top: 12px;
      flex-wrap: wrap;
    }
    .baby-info span { font-size: 13px; color: #636e72; }
    .baby-info strong { color: #2d3436; }
    .section { margin-bottom: 30px; page-break-inside: avoid; }
    .section h2 {
      font-size: 18px;
      color: #667eea;
      border-bottom: 2px solid #dfe6e9;
      padding-bottom: 8px;
      margin-bottom: 16px;
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .card {
      background: #f8f9fa;
      border-radius: 10px;
      padding: 14px;
      font-size: 13px;
      border: 1px solid #e9ecef;
    }
    .metric {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 10px;
      padding: 16px;
      text-align: center;
      color: white;
    }
    .metric-value { font-size: 24px; font-weight: 700; }
    .metric-label { font-size: 12px; opacity: 0.9; margin-top: 4px; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      text-align: left;
      padding: 10px;
      border-bottom: 1px solid #e9ecef;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #636e72;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    tr:hover { background: #f8f9fa; }
    .chart { margin-top: 16px; text-align: center; }
    .muted { color: #b2bec3; font-style: italic; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #dfe6e9;
      text-align: center;
      font-size: 11px;
      color: #b2bec3;
    }
    @media print {
      body { padding: 0; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏥 Pediatric Visit Report</h1>
    <div class="subtitle">Generated by LittleLoom on ${new Date().toLocaleDateString()}</div>
    <div class="baby-info">
      <span><strong>Name:</strong> ${escapeHtml(babyName)}</span>
      <span><strong>DOB:</strong> ${babyDob}</span>
      <span><strong>Age:</strong> ${ageText}</span>
    </div>
  </div>
  ${sectionsHTML}
  <div class="footer">
    <p>This report was generated from LittleLoom tracking data.</p>
    <p>Always consult your pediatrician for medical advice.</p>
  </div>
</body>
</html>
    `;
  }, [currentBaby, filteredEntries, sections]);

  const generatePDF = useCallback(async () => {
    const enabledCount = sections.filter((s) => s.enabled).length;
    if (enabledCount === 0) {
      sweetAlert.alert('No Sections', 'Please enable at least one report section.');
      return;
    }

    setGenerating(true);
    try {
      const html = generateHTML();
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      const babyName = currentBaby?.name || 'Baby';
      const newPath = `${FileSystem.documentDirectory}${babyName.replace(/\s+/g, '_')}_Pediatric_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      await FileSystem.moveAsync({ from: uri, to: newPath });

      sweetAlert.confirm('PDF Ready!', 'Open or share the report?', async () => {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(newPath, {
            mimeType: 'application/pdf',
            dialogTitle: `${babyName}'s Pediatric Report`,
          });
        }
      });
    } catch (err) {
      sweetAlert.alert('Error', 'Failed to generate PDF. Please try again.');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }, [generateHTML, sections, currentBaby, sweetAlert]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ padding: spacing.lg }}>
        {/* Header */}
        <View style={[styles.headerCard, { backgroundColor: glass.bg, borderRadius: borderRadius.xl }]}>
          <Ionicons name="document-text" size={40} color={theme.primary} />
          <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
            Pediatrician Report
          </Text>
          <Text style={[styles.headerSub, { color: theme.text.secondary }]}>
            Export a professional PDF for your next visit
          </Text>
        </View>

        {/* Date Range */}
        <Text style={[styles.sectionTitle, { color: theme.text.primary, marginTop: spacing.lg }]}>
          Date Range
        </Text>
        <View style={styles.rangeRow}>
          {(['7d', '30d', '90d', 'all'] as const).map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setDateRange(r)}
              style={[
                styles.rangeBtn,
                {
                  backgroundColor: dateRange === r ? theme.primary : glass.bg,
                  borderRadius: borderRadius.md,
                  borderWidth: 1,
                  borderColor: dateRange === r ? theme.primary : glass.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.rangeBtnText,
                  { color: dateRange === r ? '#FFF' : theme.text.primary },
                ]}
              >
                {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : r === '90d' ? '90 Days' : 'All Time'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sections */}
        <Text style={[styles.sectionTitle, { color: theme.text.primary, marginTop: spacing.lg }]}>
          Report Sections
        </Text>
        <View
          style={[
            styles.sectionsCard,
            { backgroundColor: glass.bg, borderRadius: borderRadius.lg, borderColor: glass.border },
          ]}
        >
          {sections.map((s) => (
            <View key={s.id} style={styles.sectionRow}>
              <View style={styles.sectionInfo}>
                <Text style={{ fontSize: 20 }}>{s.emoji}</Text>
                <Text style={[styles.sectionLabel, { color: theme.text.primary }]}>
                  {s.label}
                </Text>
              </View>
              <Switch
                value={s.enabled}
                onValueChange={() => toggleSection(s.id)}
                trackColor={{ false: '#767577', true: theme.primary + '80' }}
                thumbColor={s.enabled ? theme.primary : '#f4f3f4'}
              />
            </View>
          ))}
        </View>

        {/* Stats Preview */}
        <View
          style={[
            styles.statsCard,
            { backgroundColor: glass.bg, borderRadius: borderRadius.lg, marginTop: spacing.lg },
          ]}
        >
          <Text style={[styles.statsTitle, { color: theme.text.primary }]}>
            Preview
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: theme.primary }]}>
                {filteredEntries.length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                Entries
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: theme.primary }]}>
                {new Set(filteredEntries.map((e) => e.trackerId)).size}
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                Trackers
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: theme.primary }]}>
                {sections.filter((s) => s.enabled).length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                Sections
              </Text>
            </View>
          </View>
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          onPress={generatePDF}
          disabled={generating}
          style={[
            styles.generateBtn,
            {
              backgroundColor: generating ? theme.text.tertiary : theme.primary,
              borderRadius: borderRadius.xl,
              marginTop: spacing.xl,
            },
          ]}
        >
          {generating ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="download" size={22} color="#FFF" />
              <Text style={styles.generateBtnText}>Generate PDF Report</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: theme.text.tertiary }]}>
          Reports are generated locally on your device. No data leaves your phone.
        </Text>
      </View>
    </ScrollView>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  headerCard: {
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', marginTop: 12 },
  headerSub: { fontSize: 14, marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rangeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rangeBtnText: { fontSize: 13, fontWeight: '600' },
  sectionsCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  sectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionLabel: { fontSize: 15, fontWeight: '500' },
  statsCard: {
    padding: 16,
    borderWidth: 1,
  },
  statsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  generateBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  disclaimer: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 16,
    lineHeight: 18,
  },
});

export default PediatricianPDFExport;