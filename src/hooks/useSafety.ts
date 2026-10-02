import { useContext } from 'react';
import { SafetyContext } from '../context/SafetyContext';

function getFallbackSafety() {
  return {
    topics: [],
    emergencyContacts: [],
    emergencyLogs: [],
    checklists: [],
    recentTipsViewed: [],
    isLoading: false,
    lastEmergencyCall: null,
    isLocationAvailable: false,
    currentLocation: null,
    isTrackingLocation: false,
    safetyScore: 0,
    streakDays: 0,
    lastActiveDate: null,
    doctorReports: [],
    deviceContactsImported: false,
    loadSafetyData: async () => {},
    resetSafetyData: async () => {},
    callEmergency: async () => {},
    triggerSOS: async () => {},
    findNearbyHospitals: async () => {},
    findNearbyPediatricians: async () => {},
    shareLocationWithEmergency: async () => {},
    startLocationTracking: async () => {},
    stopLocationTracking: () => {},
    getCurrentAddress: async () => null,
    refreshLocation: async () => null,
    toggleTopicExpanded: () => {},
    markTopicCompleted: async () => {},
    markTopicIncomplete: async () => {},
    getTopicById: () => undefined,
    getTopicsByCategory: () => [],
    searchTopics: () => [],
    addCustomEmergencyContact: async () => {},
    removeCustomContact: async () => {},
    updateEmergencyContact: async () => {},
    importFamilyContacts: async () => {},
    importDeviceContacts: async () => {},
    getLocalEmergencyNumbers: async () => [],
    toggleChecklistItem: async () => {},
    getChecklistProgress: () => 0,
    resetChecklist: async () => {},
    markTipAsViewed: async () => {},
    getSafetyScore: () => 0,
    getSafetyLevel: () => 'poor' as const,
    getEmergencyLogs: () => [],
    addEmergencyLog: async () => {},
    resolveEmergencyLog: async () => {},
    clearEmergencyLogs: async () => {},
    triggerHaptic: () => {},
    getFirstAidSteps: () => [],
    addDoctorReport: async () => {},
    approveDoctorReport: async () => {},
    getDoctorReports: () => [],
    deleteDoctorReport: async () => {},
    updateDoctorReport: async () => {},
    scheduleSafetyReminder: async () => null,
    cancelSafetyReminder: async () => {},
  };
}

export const useSafety = () => {
  try {
    const context = useContext(SafetyContext);
    if (!context) return getFallbackSafety() as any;
    return context;
  } catch {
    return getFallbackSafety() as any;
  }
};

export default useSafety;
