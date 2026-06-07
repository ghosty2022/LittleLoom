// src/utils/index.ts
// UNIFIED UTILITY EXPORTS — Single source of truth for all utilities

// ─── Image System ───
export {
  ImageUtils,
  isValidImageUri,
  isEmoji,
  ensureDirectory,
  ensureAllImageDirs,
  copyImage,
  deleteImage,
  imageExists,
  getFileSize,
  readDirectory,
  pickImage,
  pickMultipleImages,
  takePhoto,
  compressImage,
  resizeImage,
  createThumbnail,
  getImageDimensions,
  processImageBatch,
  cacheImage,
  getCachedImage,
  clearImageCache,
  getCacheSize,
  isCacheFull,
  saveParentImage,
  saveGuardianImage,
  saveBabyImage,
  saveGalleryImage,
  saveToPhotoLibrary,
  getParentImagePath,
  getGuardianImagePath,
  getBabyImagePath,
  getMilestoneImagePath,
  getGalleryPath,
  getCachePath,
  CACHE_DIR,
  PARENT_IMAGES_DIR,
  GUARDIAN_IMAGES_DIR,
  BABY_IMAGES_DIR,
  MILESTONE_IMAGES_DIR,
  GALLERY_DIR,
  MAX_CACHE_SIZE,
  DEFAULT_COMPRESSION,
  MAX_IMAGE_DIMENSION,
  THUMBNAIL_SIZE,
  type SaveImageResult,
  type PickImageOptions,
} from './imageUtils';

// ─── Unit System ───
export {
  UnitUtils,
  useUnitPreferences,
  convertWeight,
  convertHeight,
  convertTemperature,
  convertVolume,
  formatWeight,
  formatHeight,
  formatTemperature,
  formatVolume,
  smartWeightDisplay,
  smartHeightDisplay,
  parseHeightInput,
  DEFAULT_UNITS,
  type WeightUnit,
  type HeightUnit,
  type TemperatureUnit,
  type VolumeUnit,
  type UnitPreferences,
} from './UnitUtils';

// ─── Modal System ───
export {
  ModalProvider,
  useModal,
  showModal,
  hideModal,
  showSuccessModal,
  showErrorModal,
  showConfirmModal,
  showWarningModal,
  showInfoModal,
  SweetAlert,
  type ModalType,
  type ModalButton,
  type ModalConfig,
} from './modal';

// ─── Notification System ───
export {
  notificationService,
  useNotifications,
  initNotifications,
  type NotificationChannels,
} from './NotificationService';

// ─── State Persistence ───
export { statePersistence } from './statePersistence';

// ─── Storage ───
export { storage } from './storage';

// ─── Biometric ───
export { biometric } from './biometric';

// ─── Performance ───
export { performanceCheck } from './performanceCheck';

// ─── Theme Events ───
export { themeEvents } from './themeEvents';