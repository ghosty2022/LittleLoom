import { Dimensions, Switch, Text, TouchableOpacity, View, StatusBar, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn, useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming } from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';

import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { showAlert } from '@/utils/alert';

type Props = NativeStackScreenProps<RootStackParamList, 'BackupRestore'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  success: '#43e97b',
  warning: '#fee140',
  danger: '#ff4757',
  info: '#4facfe',
  purple: '#9b59b6',
  orange: '#e67e22',
};

interface EncryptModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  isDark: boolean;
  primaryColor: string;
  secondaryColor: string;
}

const EncryptModal = ({
  visible, onClose, onConfirm, isDark, primaryColor, secondaryColor }: EncryptModalProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleConfirm = () => {
    if (password.length < 6) {
      sweetAlert.alert('Password Too Short', 'Password must be at least 6 characters', 'warning');
      return;
    }
    if (password !== confirmPassword) {

showAlert("Passwords Don't Match", 'Please make sure both passwords match');
      return;
    }
    onConfirm(password);
    setPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <BlurView intensity={isDark ? 60 : 90} style={styles.modalBlur} tint={isDark ? 'dark' : 'light'}>
          <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Ionicons name="lock-closed" size={32} color={primaryColor} />
              <Text style={[styles.modalTitle, isDark && styles.textLight]}>Encrypt Backup</Text>
              <Text style={[styles.modalSubtitle, isDark && styles.textSecondaryLight]}>
                Set a password to protect your backup file
              </Text>
            </View>

            <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
              <Ionicons name="key-outline" size={20} color={primaryColor} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isDark && styles.textLight]}
                placeholder="Password (min 6 chars)"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={primaryColor} />
              </TouchableOpacity>
            </View>

            <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
              <Ionicons name="key-outline" size={20} color={primaryColor} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isDark && styles.textLight]}
                placeholder="Confirm Password"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleConfirm}>
                <LinearGradient
                  colors={[primaryColor, secondaryColor]}
                  style={styles.modalConfirmGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.modalConfirmText}>Encrypt & Backup</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

interface PasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  isDark: boolean;
  primaryColor: string;
  secondaryColor: string;
  title?: string;
  subtitle?: string;
}

const PasswordModal = ({ visible, onClose, onConfirm, isDark, primaryColor, secondaryColor, title, subtitle }: PasswordModalProps) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleConfirm = () => {
    if (!password) {
      sweetAlert.alert('Password Required', 'Please enter the backup password', 'warning');
      return;
    }
    onConfirm(password);
    setPassword('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <BlurView intensity={isDark ? 60 : 90} style={styles.modalBlur} tint={isDark ? 'dark' : 'light'}>
          <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Ionicons name="lock-closed" size={32} color={primaryColor} />
              <Text style={[styles.modalTitle, isDark && styles.textLight]}>{title || 'Enter Password'}</Text>
              <Text style={[styles.modalSubtitle, isDark && styles.textSecondaryLight]}>
                {subtitle || 'This backup is encrypted'}
              </Text>
            </View>

            <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
              <Ionicons name="key-outline" size={20} color={primaryColor} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isDark && styles.textLight]}
                placeholder="Backup Password"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onSubmitEditing={handleConfirm}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={primaryColor} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleConfirm}>
                <LinearGradient
                  colors={[primaryColor, secondaryColor]}
                  style={styles.modalConfirmGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.modalConfirmText}>Continue</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

interface AutoBackupModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (settings: AutoBackupSettings) => void;
  settings: AutoBackupSettings;
  isDark: boolean;
  primaryColor: string;
  secondaryColor: string;
}

const AutoBackupModal = ({ visible, onClose, onSave, settings, isDark, primaryColor, secondaryColor }: AutoBackupModalProps) => {
  const [localSettings, setLocalSettings] = useState<AutoBackupSettings>(settings);
  const [showPassword, setShowPassword] = useState(false);

  const frequencies = [
    { label: 'Daily', value: 'daily' as const },
    { label: 'Weekly', value: 'weekly' as const },
    { label: 'Monthly', value: 'monthly' as const },
  ];

  const keepCounts = [3, 5, 10, 20];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <BlurView intensity={isDark ? 60 : 90} style={styles.modalBlur} tint={isDark ? 'dark' : 'light'}>
          <View style={[styles.modalContent, isDark && styles.modalContentDark, { maxHeight: '80%' }]}>
            <AutoHideScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Ionicons name="time-outline" size={32} color={primaryColor} />
                <Text style={[styles.modalTitle, isDark && styles.textLight]}>Auto Backup</Text>
                <Text style={[styles.modalSubtitle, isDark && styles.textSecondaryLight]}>
                  Schedule automatic backups of your data
                </Text>
              </View>

              {/* Enable Toggle */}
              <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, isDark && styles.textLight]}>Enable Auto Backup</Text>
                  <Text style={[styles.settingDesc, isDark && styles.textSecondaryLight]}>
                    Automatically backup your data
                  </Text>
                </View>
                <Switch
                  value={localSettings.enabled}
                  onValueChange={(v) => setLocalSettings({ ...localSettings, enabled: v })}
                  trackColor={{ false: '#767577', true: primaryColor }}
                  thumbColor={localSettings.enabled ? '#fff' : '#f4f3f4'}
                />
              </View>

              {localSettings.enabled && (
                <>
                  {/* Frequency */}
                  <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
                    <Text style={[styles.settingLabel, isDark && styles.textLight]}>Frequency</Text>
                    <View style={styles.frequencyButtons}>
                      {frequencies.map((f) => (
                        <TouchableOpacity
                          key={f.value}
                          style={[
                            styles.freqButton,
                            localSettings.frequency === f.value && { backgroundColor: primaryColor },
                          ]}
                          onPress={() => setLocalSettings({ ...localSettings, frequency: f.value })}
                        >
                          <Text
                            style={[
                              styles.freqButtonText,
                              localSettings.frequency === f.value && styles.freqButtonTextActive,
                            ]}
                          >
                            {f.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Keep Count */}
                  <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
                    <Text style={[styles.settingLabel, isDark && styles.textLight]}>Keep Backups</Text>
                    <View style={styles.keepCountButtons}>
                      {keepCounts.map((count) => (
                        <TouchableOpacity
                          key={count}
                          style={[
                            styles.keepButton,
                            localSettings.keepCount === count && { backgroundColor: primaryColor },
                          ]}
                          onPress={() => setLocalSettings({ ...localSettings, keepCount: count })}
                        >
                          <Text
                            style={[
                              styles.keepButtonText,
                              localSettings.keepCount === count && styles.keepButtonTextActive,
                            ]}
                          >
                            {count}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Encryption Toggle */}
                  <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
                    <View style={styles.settingInfo}>
                      <Text style={[styles.settingLabel, isDark && styles.textLight]}>Encrypt Backups</Text>
                      <Text style={[styles.settingDesc, isDark && styles.textSecondaryLight]}>
                        Password-protect your backups
                      </Text>
                    </View>
                    <Switch
                      value={localSettings.encryptBackups}
                      onValueChange={(v) => setLocalSettings({ ...localSettings, encryptBackups: v })}
                      trackColor={{ false: '#767577', true: primaryColor }}
                      thumbColor={localSettings.encryptBackups ? '#fff' : '#f4f3f4'}
                    />
                  </View>

                  {localSettings.encryptBackups && (
                    <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                      <Ionicons name="key-outline" size={20} color={primaryColor} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, isDark && styles.textLight]}
                        placeholder="Backup Password"
                        placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                        value={localSettings.encryptionPassword || ''}
                        onChangeText={(v) => setLocalSettings({ ...localSettings, encryptionPassword: v })}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={primaryColor} />
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmButton}
                  onPress={() => onSave(localSettings)}
                >
                  <LinearGradient
                    colors={[primaryColor, secondaryColor]}
                    style={styles.modalConfirmGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.modalConfirmText}>Save Settings</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </AutoHideScrollView>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

export default function BackupRestoreScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const {
    darkMode: isDark,
    themeColors,
    triggerHaptic,
    shouldReduceMotion,
  } = useCustomization();

  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [stats, setStats] = useState({ keys: 0, size: '0 B', babies: 0 });
  const [preview, setPreview] = useState<BackupPreview | null>(null);

  const [localBackups, setLocalBackups] = useState<LocalBackupInfo[]>([]);
  const [showLocalBackups, setShowLocalBackups] = useState(false);

  const [showEncryptModal, setShowEncryptModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAutoBackupModal, setShowAutoBackupModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'create' | 'restore' | 'preview' | null>(null);
  const [pendingContent, setPendingContent] = useState<string | null>(null);

  const [autoBackupSettings, setAutoBackupSettings] = useState<AutoBackupSettings>({
    enabled: false,
    frequency: 'weekly',
    timeOfDay: '02:00',
    keepCount: 5,
    includeMedia: false,
    encryptBackups: false,
  });

  useEffect(() => {
    loadStats();
    loadLocalBackups();
    loadAutoBackupSettings();
  }, []);

  const loadStats = async () => {
    const s = await backupService.getCurrentStats();
    setStats(s);
  };

  const loadLocalBackups = async () => {
    const backups = await backupService.listLocalBackups();
    setLocalBackups(backups);
    if (backups.length > 0) {
      setLastBackup(backups[0].dateFormatted);
    }
  };

  const loadAutoBackupSettings = async () => {
    const settings = await backupService.getAutoBackupSettings();
    setAutoBackupSettings(settings);
  };

  const handleCreateBackup = async (encrypted: boolean = false, password?: string) => {
    triggerHaptic('medium');
    setIsCreating(true);

    try {
      const result = await backupService.createBackup({ encrypted, password });

      if (result.success && result.filePath) {
        const shared = await backupService.shareBackup(result.filePath);

        if (shared) {
          setLastBackup(new Date().toLocaleString());
          triggerHaptic('success');

showAlert(
            '✅ Backup Created!',
            `Your ${encrypted ? 'encrypted ' : ''}backup (${result.metadata?.totalKeys} keys, ${result.metadata?.totalSize} bytes) is ready.\n\nSave it to cloud storage, email, or Files for safekeeping.`,
            [{ text: 'Great!' }]
          );
        }

        await backupService.cleanupBackupFile(result.filePath);
        await loadLocalBackups(); // Refresh list
      } else {
        throw new Error(result.error || 'Failed to create backup');
      }
    } catch (error) {
      triggerHaptic('error');

showAlert('Backup Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsCreating(false);
    }
  };

  const promptEncryptedBackup = () => {
    setShowEncryptModal(true);
  };

  const handleRestoreBackup = async () => {
    triggerHaptic('medium');
    setIsRestoring(true);

    try {
      const picked = await backupService.pickBackupFile();

      if (!picked) {
        setIsRestoring(false);
        return;
      }

      const parsed = JSON.parse(picked.content);
      if (parsed._encrypted) {
        setPendingContent(picked.content);
        setPendingAction('restore');
        setShowPasswordModal(true);
        setIsRestoring(false);
        return;
      }

      await processRestore(picked.content);
    } catch (error) {
      triggerHaptic('error');

showAlert('Restore Failed', error instanceof Error ? error.message : 'Unknown error');
      setIsRestoring(false);
    }
  };

  const processRestore = async (content: string, password?: string) => {
    setIsRestoring(true);

    try {
      const previewData = await backupService.previewBackup(content, password);
      setPreview(previewData);

      if (!previewData.valid) {
        triggerHaptic('error');

showAlert('Invalid Backup', previewData.error || 'Could not read backup file');
        setIsRestoring(false);
        return;
      }

showAlert(
        'Restore Backup?',
        `Found backup from ${new Date(previewData.metadata!.exportedAt).toLocaleString()}\n\n` +
        `• Babies: ${previewData.babyCount}\n` +
        `• Entries: ${previewData.entryCount}\n` +
        `• Size: ${previewData.size}\n` +
        `• Version: ${previewData.version}\n` +
        `${previewData.warnings.length > 0 ? '⚠️ ' + previewData.warnings.join('\n') + '\n\n' : ''}` +
        'This will REPLACE all current data. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setIsRestoring(false) },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              const result = await backupService.restoreBackup(content, password);

              if (result.success) {
                triggerHaptic('success');

showAlert(
                  '✅ Restore Complete!',
                  `Successfully restored ${result.restoredKeys.length} data entries.\n\nPlease restart the app for all changes to take effect.`,
                  [
                    {
                      text: 'Restart App',
                      onPress: () => {
                        navigation.navigate('Splash');
                      }
                    }
                  ]
                );
              } else {
                triggerHaptic('error');

showAlert('Restore Failed', result.error || 'Could not restore backup');
              }
              setIsRestoring(false);
            }
          }
        ]
      );
    } catch (error) {
      triggerHaptic('error');

showAlert('Restore Failed', error instanceof Error ? error.message : 'Unknown error');
      setIsRestoring(false);
    }
  };

  const handleLocalBackupPress = async (backup: LocalBackupInfo) => {
    triggerHaptic('light');

    const content = await backupService.readLocalBackup(backup.path);
    if (!content) {
      sweetAlert.alert('Error', 'Could not read backup file', 'warning');
      return;
    }

    if (backup.isEncrypted) {
      setPendingContent(content);
      setPendingAction('preview');
      setShowPasswordModal(true);
      return;
    }

    const previewData = await backupService.previewBackup(content);
    setPreview(previewData);

showAlert(
      backup.name,
      `Created: ${backup.dateFormatted}\nSize: ${backup.sizeFormatted}\nBabies: ${previewData.babyCount}\nEntries: ${previewData.entryCount}\n${backup.isEncrypted ? '🔒 Encrypted' : '🔓 Not Encrypted'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Share', onPress: () => shareLocalBackup(backup) },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            setPendingContent(content);
            if (backup.isEncrypted) {
              setPendingAction('restore');
              setShowPasswordModal(true);
            } else {
              processRestore(content);
            }
          }
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteLocalBackup(backup),
        },
      ]
    );
  };

  const shareLocalBackup = async (backup: LocalBackupInfo) => {
    const shared = await backupService.shareBackup(backup.path);
    if (shared) {
      triggerHaptic('success');
    }
  };

  const deleteLocalBackup = (backup: LocalBackupInfo) => {

showAlert(
      'Delete Backup?',
      `Are you sure you want to delete "${backup.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await backupService.deleteLocalBackup(backup.path);
            if (success) {
              triggerHaptic('success');
              await loadLocalBackups();
            }
          }
        }
      ]
    );
  };

  const handleSaveAutoBackupSettings = async (settings: AutoBackupSettings) => {
    await backupService.saveAutoBackupSettings(settings);
    setAutoBackupSettings(settings);
    setShowAutoBackupModal(false);
    triggerHaptic('success');

showAlert('Settings Saved', `Auto backup ${settings.enabled ? 'enabled' : 'disabled'}`);
  };

  const runAutoBackupNow = async () => {
    triggerHaptic('medium');
    setIsCreating(true);

    try {
      const result = await backupService.runAutoBackupIfDue();
      if (result) {
        if (result.success) {
          triggerHaptic('success');
          sweetAlert.alert('✅ Auto Backup Complete', 'Your data has been backed up successfully.', 'warning');
          await loadLocalBackups();
        } else {
          throw new Error(result.error || 'Auto backup failed');
        }
      } else {
        sweetAlert.alert('Not Due Yet', 'Auto backup is not scheduled to run at this time.', 'warning');
      }
    } catch (error) {
      triggerHaptic('error');

showAlert('Auto Backup Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsCreating(false);
    }
  };

  const handlePasswordConfirm = async (password: string) => {
    if (pendingAction === 'create') {
      await handleCreateBackup(true, password);
    } else if (pendingAction === 'restore' && pendingContent) {
      await processRestore(pendingContent, password);
    } else if (pendingAction === 'preview' && pendingContent) {
      const previewData = await backupService.previewBackup(pendingContent, password);
      setPreview(previewData);

showAlert(
        'Backup Preview',
        `Valid: ${previewData.valid ? 'Yes' : 'No'}\nBabies: ${previewData.babyCount}\nEntries: ${previewData.entryCount}`
      );
    }
    setPendingAction(null);
    setPendingContent(null);
  };

  const StatPill = ({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) => (
    <View style={[styles.statPill, isDark && styles.statPillDark]}>
      <View style={[styles.statPillIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <View>
        <Text style={[styles.statPillValue, isDark && styles.statPillValueDark]}>{value}</Text>
        <Text style={[styles.statPillLabel, isDark && styles.statPillLabelDark]}>{label}</Text>
      </View>
    </View>
  );

  const ActionCard = ({
    icon,
    title,
    subtitle,
    color,
    onPress,
    isLoading,
    disabled,
    badge,
  }: {
    icon: string;
    title: string;
    subtitle: string;
    color: string;
    onPress: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    badge?: string;
  }) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePress = () => {
      if (disabled || isLoading) return;
      scale.value = withSequence(
        withTiming(0.96, { duration: 50 }),
        withTiming(1, { duration: 100 })
      );
      onPress();
    };

    return (
      <TouchableOpacity
        style={[styles.actionCard, animatedStyle, isDark && styles.actionCardDark]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[`${color}15`, `${color}05`]}
          style={styles.actionCardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={[styles.actionIcon, { backgroundColor: `${color}20` }]}>
            {isLoading ? (
              <ActivityIndicator color={color} />
            ) : (
              <Ionicons name={icon as any} size={28} color={color} />
            )}
          </View>
          <View style={styles.actionText}>
            <Text style={[styles.actionTitle, isDark && styles.actionTitleDark]}>{title}</Text>
            <Text style={[styles.actionSubtitle, isDark && styles.actionSubtitleDark]}>{subtitle}</Text>
          </View>
          {badge && (
            <View style={[styles.badge, { backgroundColor: `${color}30` }]}>
              <Text style={[styles.badgeText, { color }]}>{badge}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : '#999'} />
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const LocalBackupItem = ({ backup, onPress }: { backup: LocalBackupInfo; onPress: () => void }) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    return (
      <TouchableOpacity
        style={[styles.localBackupItem, isDark && styles.localBackupItemDark, animatedStyle]}
        onPress={() => {
          scale.value = withSequence(withTiming(0.97, { duration: 50 }), withTiming(1, { duration: 100 }));
          onPress();
        }}
      >
        <View style={[styles.localBackupIcon, { backgroundColor: backup.isEncrypted ? `${COLORS.purple}20` : `${COLORS.success}20` }]}>
          <Ionicons
            name={backup.isEncrypted ? 'lock-closed' : 'document-text'}
            size={22}
            color={backup.isEncrypted ? COLORS.purple : COLORS.success}
          />
        </View>
        <View style={styles.localBackupInfo}>
          <Text style={[styles.localBackupName, isDark && styles.textLight]} numberOfLines={1}>
            {backup.name}
          </Text>
          <Text style={styles.localBackupMeta}>
            {backup.dateFormatted} • {backup.sizeFormatted}
            {backup.isEncrypted && ' • 🔒 Encrypted'}
          </Text>
        </View>
        <Ionicons name="ellipsis-vertical" size={18} color={isDark ? '#666' : '#999'} />
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient
      colors={isDark ? ['#0f0f1e', '#1a1a2e'] : ['#f8faff', '#f0f4ff']}
      style={styles.container}
    >
      <AutoHideScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)} style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>Backup & Restore</Text>
          <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>
            Protect your memories, move between devices
          </Text>
        </Animated.View>

        {/* Info Card */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200)} style={[styles.infoCard, isDark && styles.infoCardDark]}>
          <BlurView intensity={isDark ? 40 : 90} style={styles.infoBlur} tint={isDark ? 'dark' : 'light'}>
            <Ionicons name="shield-checkmark" size={32} color={themeColors.primary} style={styles.infoIcon} />
            <Text style={[styles.infoTitle, isDark && styles.infoTitleDark]}>
              Your Data, Always Yours
            </Text>
            <Text style={[styles.infoText, isDark && styles.infoTextDark]}>
              Create encrypted JSON backups of all your baby tracking data. Share via iCloud, Google Drive, email, or save to Files for safekeeping. Restore anytime on any device.
            </Text>
          </BlurView>
        </Animated.View>

        {/* Current Stats */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(300)} style={styles.statsRow}>
          <StatPill icon="cube-outline" label="Data Keys" value={stats.keys} color={COLORS.info} />
          <StatPill icon="heart-outline" label="Babies" value={stats.babies} color={themeColors.primary} />
          <StatPill icon="save-outline" label="Size" value={stats.size} color={COLORS.success} />
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(400)} style={styles.actionsSection}>
          <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Quick Actions</Text>

          <ActionCard
            icon="cloud-upload-outline"
            title="Create Backup"
            subtitle="Export all data to a shareable file"
            color={COLORS.success}
            onPress={() => handleCreateBackup(false)}
            isLoading={isCreating}
          />

          <View style={{ height: 12 }} />

          <ActionCard
            icon="lock-closed-outline"
            title="Encrypted Backup"
            subtitle="Password-protect your backup"
            color={COLORS.purple}
            onPress={promptEncryptedBackup}
            isLoading={isCreating}
          />

          <View style={{ height: 12 }} />

          <ActionCard
            icon="cloud-download-outline"
            title="Restore from Backup"
            subtitle="Import data from a backup file"
            color={themeColors.primary}
            onPress={handleRestoreBackup}
            isLoading={isRestoring}
          />
        </Animated.View>

        {/* Local Backups Section */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(500)} style={styles.localBackupsSection}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowLocalBackups(!showLocalBackups)}
          >
            <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>
              Local Backups ({localBackups.length})
            </Text>
            <Ionicons
              name={showLocalBackups ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={isDark ? '#888' : '#888'}
            />
          </TouchableOpacity>

          {showLocalBackups && (
            <Animated.View entering={shouldReduceMotion ? undefined : FadeIn}>
              {localBackups.length === 0 ? (
                <View style={[styles.emptyState, isDark && styles.emptyStateDark]}>
                  <Ionicons name="folder-open-outline" size={40} color={isDark ? '#444' : '#ccc'} />
                  <Text style={[styles.emptyStateText, isDark && styles.textSecondaryLight]}>
                    No local backups yet
                  </Text>
                </View>
              ) : (
                <>
                  {localBackups.map((backup) => (
                    <LocalBackupItem
                      key={backup.id}
                      backup={backup}
                      onPress={() => handleLocalBackupPress(backup)}
                    />
                  ))}

                  {/* Clear All Button */}
                  {localBackups.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearAllButton}
                      onPress={() => {

showAlert(
                          'Clear All Backups?',
                          `Delete all ${localBackups.length} local backups? This cannot be undone.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete All',
                              style: 'destructive',
                              onPress: async () => {
                                for (const backup of localBackups) {
                                  await backupService.deleteLocalBackup(backup.path);
                                }
                                await loadLocalBackups();
                                triggerHaptic('success');
                              }
                            }
                          ]
                        );
                      }}
                    >
                      <Text style={styles.clearAllText}>Clear All Local Backups</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </Animated.View>
          )}
        </Animated.View>

        {/* Auto Backup Section */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(600)} style={styles.autoBackupSection}>
          <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Auto Backup</Text>

          <ActionCard
            icon="time-outline"
            title="Auto Backup Settings"
            subtitle={
              autoBackupSettings.enabled
                ? `${autoBackupSettings.frequency} • Keep ${autoBackupSettings.keepCount}`
                : 'Schedule automatic backups'
            }
            color={COLORS.warning}
            onPress={() => setShowAutoBackupModal(true)}
            badge={autoBackupSettings.enabled ? 'ON' : 'OFF'}
          />

          <View style={{ height: 12 }} />

          <ActionCard
            icon="play-circle-outline"
            title="Run Backup Now"
            subtitle="Manually trigger auto backup"
            color={COLORS.orange}
            onPress={runAutoBackupNow}
            isLoading={isCreating}
          />
        </Animated.View>

        {/* How It Works */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(700)} style={styles.howItWorks}>
          <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>How It Works</Text>

          {[
            { icon: 'document-text', title: 'JSON Format', desc: 'Open, portable format readable by any device' },
            { icon: 'phone-portrait', title: 'Cross-Platform', desc: 'Move seamlessly between iOS and Android' },
            { icon: 'lock-closed', title: 'Privacy First', desc: 'Your data never touches our servers' },
            { icon: 'refresh-circle', title: 'Full Restore', desc: 'Everything comes back: babies, logs, milestones' },
          ].map((item, i) => (
            <View key={i} style={[styles.howItem, isDark && styles.howItemDark]}>
              <View style={[styles.howIcon, { backgroundColor: `${themeColors.primary}15` }]}>
                <Ionicons name={item.icon as any} size={20} color={themeColors.primary} />
              </View>
              <View style={styles.howText}>
                <Text style={[styles.howTitle, isDark && styles.howTitleDark]}>{item.title}</Text>
                <Text style={[styles.howDesc, isDark && styles.howDescDark]}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Last Backup */}
        {lastBackup && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(800)} style={styles.lastBackup}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
            <Text style={[styles.lastBackupText, isDark && styles.lastBackupTextDark]}>
              Last backup: {lastBackup}
            </Text>
          </Animated.View>
        )}

        {/* Note */}
        <Text style={[styles.note, isDark && styles.noteDark]}>
          💡 Tip: Back up regularly and store files in cloud storage for maximum safety. Encrypted backups require your password to restore.
        </Text>
      </AutoHideScrollView>

      {/* Modals */}
      <EncryptModal
        visible={showEncryptModal}
        onClose={() => setShowEncryptModal(false)}
        onConfirm={(password) => {
          setPendingAction('create');
          handleCreateBackup(true, password);
        }}
        isDark={isDark}
        primaryColor={themeColors.primary}
        secondaryColor={themeColors.secondary}
      />

      <PasswordModal
        visible={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPendingAction(null);
          setPendingContent(null);
          setIsRestoring(false);
        }}
        onConfirm={handlePasswordConfirm}
        isDark={isDark}
        primaryColor={themeColors.primary}
        secondaryColor={themeColors.secondary}
        title={pendingAction === 'create' ? 'Set Backup Password' : 'Enter Backup Password'}
        subtitle={pendingAction === 'create' ? 'Protect your backup with encryption' : 'This backup is password protected'}
      />

      <AutoBackupModal
        visible={showAutoBackupModal}
        onClose={() => setShowAutoBackupModal(false)}
        onSave={handleSaveAutoBackupSettings}
        settings={autoBackupSettings}
        isDark={isDark}
        primaryColor={themeColors.primary}
        secondaryColor={themeColors.secondary}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },

  textLight: { color: '#fff' },
  textSecondaryLight: { color: '#a0a0a0' },

  header: { marginBottom: 24 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  headerTitleDark: { color: '#fff' },
  headerSubtitle: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  headerSubtitleDark: { color: '#a0a0a0' },

  infoCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.15)',
  },
  infoCardDark: {
    borderColor: 'rgba(102,126,234,0.2)',
  },
  infoBlur: {
    padding: 24,
    alignItems: 'center',
  },
  infoIcon: { marginBottom: 12 },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  infoTitleDark: { color: '#fff' },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  infoTextDark: { color: '#a0a0a0' },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  statPillDark: {
    backgroundColor: 'rgba(30,30,40,0.5)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statPillIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statPillValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  statPillValueDark: { color: '#fff' },
  statPillLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginTop: 2,
  },
  statPillLabelDark: { color: '#888' },

  actionsSection: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionLabelDark: { color: '#888' },

  actionCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  actionCardDark: {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  actionCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1 },
  actionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  actionTitleDark: { color: '#fff' },
  actionSubtitle: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  actionSubtitleDark: { color: '#888' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  localBackupsSection: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  localBackupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  localBackupItemDark: {
    backgroundColor: 'rgba(30,30,40,0.4)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  localBackupIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  localBackupInfo: { flex: 1 },
  localBackupName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  localBackupMeta: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
  },
  emptyStateDark: {
    backgroundColor: 'rgba(30,30,40,0.4)',
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  clearAllButton: {
    alignItems: 'center',
    padding: 14,
    marginTop: 8,
  },
  clearAllText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '600',
  },

  autoBackupSection: { marginBottom: 24 },

  howItWorks: { marginBottom: 24 },
  howItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  howItemDark: {
    backgroundColor: 'rgba(30,30,40,0.4)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  howIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  howText: { flex: 1 },
  howTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  howTitleDark: { color: '#fff' },
  howDesc: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  howDescDark: { color: '#888' },

  lastBackup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(67,233,123,0.1)',
    borderRadius: 14,
  },
  lastBackupText: {
    fontSize: 14,
    color: '#43e97b',
    fontWeight: '600',
  },
  lastBackupTextDark: { color: '#51cf66' },

  note: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 18,
  },
  noteDark: { color: '#666' },

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalBlur: {
    borderRadius: 24,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  modalContentDark: {
    backgroundColor: 'rgba(30,30,40,0.95)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    marginTop: 12,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(102,126,234,0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.15)',
  },
  inputContainerDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#888',
  },
  modalConfirmButton: {
    flex: 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalConfirmGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    marginBottom: 12,
  },
  settingRowDark: {
    backgroundColor: 'rgba(30,30,40,0.4)',
  },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  frequencyButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  freqButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  freqButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  freqButtonTextActive: {
    color: '#fff',
  },
  keepCountButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  keepButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888',
  },
  keepButtonTextActive: {
    color: '#fff',
  },
});
