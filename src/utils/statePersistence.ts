// src/utils/statePersistence.ts
// UNIFIED: Single source of truth for ALL state persistence
// FIXED: Eliminates duplication between App.tsx, AppNavigator, and statePersistence
// FIXED: Single storage key strategy, clear responsibility separation

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';

// ============================================
// STORAGE KEYS - Unified naming convention
// ============================================
const STORAGE_KEYS = {
  // Navigation state (full React Navigation state tree)
  NAVIGATION_STATE: '@littleloom_nav_state_v4',
  
  // Last active route (lightweight, for quick restore)
  LAST_ROUTE: '@littleloom_last_route_v4',
  
  // Form drafts
  FORM_STATE: '@littleloom_form_state_v2',
  
  // Scroll positions
  SCROLL_POSITIONS: '@littleloom_scroll_positions_v2',
  
  // Component state (for modals, wizards, etc.)
  COMPONENT_STATE: '@littleloom_component_state_v2',
  
  // App session metadata
  SESSION_META: '@littleloom_session_meta_v2',
  
  // Security state
  SECURITY_STATE: '@littleloom_security_state_v2',
  
  // Nav visibility preference
  NAV_VISIBILITY: '@littleloom_nav_visible_v2',
} as const;

// ============================================
// TYPES
// ============================================

export interface PersistedNavigationState {
  state: object;
  routeName: string;
  params?: Record<string, any>;
  timestamp: number;
  appVersion: string;
}

export interface PersistedRoute {
  name: string;
  params?: Record<string, any>;
  timestamp: number;
}

export interface PersistedFormState {
  screenName: string;
  formData: Record<string, any>;
  timestamp: number;
}

export interface SessionMetadata {
  lastActive: number;
  lastRoute: string;
  lastRouteParams?: Record<string, any>;
  appVersion: string;
  navVisible: boolean;
  themeMode: string;
  appearance: string;
}

export interface SecurityPersistedState {
  isLocked: boolean;
  lockTimestamp: number;
  lastAuthTime: number;
}

// ============================================
// MAIN MANAGER
// ============================================

class StatePersistenceManager {
  private static instance: StatePersistenceManager;
  private appStateSubscription: any;
  private isSaving: boolean = false;
  private pendingSaves: Map<string, { data: any; timestamp: number }> = new Map();
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly APP_VERSION = '2.1.0';
  private readonly MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  static getInstance(): StatePersistenceManager {
    if (!StatePersistenceManager.instance) {
      StatePersistenceManager.instance = new StatePersistenceManager();
    }
    return StatePersistenceManager.instance;
  }

  initialize(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
  }

  // ============================================
  // APP STATE HANDLER
  // ============================================
  
  private async handleAppStateChange(nextAppState: AppStateStatus): Promise<void> {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      await this.flushPendingSaves();
    }
  }

  // ============================================
  // NAVIGATION STATE (Full tree)
  // ============================================
  
  async saveNavigationState(state: object, routeName: string, params?: Record<string, any>): Promise<void> {
    try {
      const persisted: PersistedNavigationState = {
        state,
        routeName,
        params,
        timestamp: Date.now(),
        appVersion: this.APP_VERSION,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.NAVIGATION_STATE, JSON.stringify(persisted));
    } catch (error) {
      console.warn('Failed to save navigation state:', error);
    }
  }

  async getNavigationState(): Promise<PersistedNavigationState | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.NAVIGATION_STATE);
      if (!data) return null;
      
      const parsed: PersistedNavigationState = JSON.parse(data);
      
      // Validate age
      if (Date.now() - parsed.timestamp > this.MAX_AGE_MS) {
        await this.clearNavigationState();
        return null;
      }
      
      // Validate version (optional migration handling)
      if (parsed.appVersion !== this.APP_VERSION) {
        console.log('Navigation state from different app version, may need migration');
      }
      
      return parsed;
    } catch (error) {
      console.warn('Failed to get navigation state:', error);
      return null;
    }
  }

  async clearNavigationState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.NAVIGATION_STATE);
      await AsyncStorage.removeItem(STORAGE_KEYS.LAST_ROUTE);
    } catch (error) {
      console.warn('Failed to clear navigation state:', error);
    }
  }

  // ============================================
  // LAST ROUTE (Lightweight quick restore)
  // ============================================
  
  async saveLastRoute(routeName: string, params?: Record<string, any>): Promise<void> {
    try {
      const route: PersistedRoute = {
        name: routeName,
        params,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_ROUTE, JSON.stringify(route));
      
      // Also update session meta
      await this.updateSessionMeta({ lastRoute: routeName, lastRouteParams: params });
    } catch (error) {
      console.warn('Failed to save last route:', error);
    }
  }

  async getLastRoute(): Promise<PersistedRoute | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LAST_ROUTE);
      if (!data) return null;
      
      const parsed: PersistedRoute = JSON.parse(data);
      
      if (Date.now() - parsed.timestamp > this.MAX_AGE_MS) {
        await AsyncStorage.removeItem(STORAGE_KEYS.LAST_ROUTE);
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.warn('Failed to get last route:', error);
      return null;
    }
  }

  // ============================================
  // SESSION METADATA
  // ============================================
  
  async updateSessionMeta(updates: Partial<SessionMetadata>): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_META);
      const current: SessionMetadata = existing ? JSON.parse(existing) : {
        lastActive: Date.now(),
        lastRoute: '',
        appVersion: this.APP_VERSION,
        navVisible: true,
        themeMode: 'system',
        appearance: 'system',
      };
      
      const updated = { ...current, ...updates, lastActive: Date.now() };
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION_META, JSON.stringify(updated));
    } catch (error) {
      console.warn('Failed to update session meta:', error);
    }
  }

  async getSessionMeta(): Promise<SessionMetadata | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_META);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('Failed to get session meta:', error);
      return null;
    }
  }

  // ============================================
  // FORM STATE
  // ============================================
  
  async saveFormState(screenName: string, formData: Record<string, any>): Promise<void> {
    try {
      const state: PersistedFormState = {
        screenName,
        formData,
        timestamp: Date.now(),
      };
      
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.FORM_STATE);
      const drafts: Record<string, PersistedFormState> = existing ? JSON.parse(existing) : {};
      
      drafts[screenName] = state;
      
      // Clean old drafts (older than 24 hours)
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      Object.keys(drafts).forEach(key => {
        if (drafts[key].timestamp < oneDayAgo) {
          delete drafts[key];
        }
      });
      
      await AsyncStorage.setItem(STORAGE_KEYS.FORM_STATE, JSON.stringify(drafts));
    } catch (error) {
      console.warn('Failed to save form state:', error);
    }
  }

  async getFormState(screenName: string): Promise<Record<string, any> | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.FORM_STATE);
      if (!data) return null;
      
      const drafts: Record<string, PersistedFormState> = JSON.parse(data);
      const draft = drafts[screenName];
      
      if (draft && Date.now() - draft.timestamp < 24 * 60 * 60 * 1000) {
        return draft.formData;
      }
      return null;
    } catch (error) {
      console.warn('Failed to get form state:', error);
      return null;
    }
  }

  async clearFormState(screenName: string): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.FORM_STATE);
      if (existing) {
        const drafts = JSON.parse(existing);
        delete drafts[screenName];
        await AsyncStorage.setItem(STORAGE_KEYS.FORM_STATE, JSON.stringify(drafts));
      }
    } catch (error) {
      console.warn('Failed to clear form state:', error);
    }
  }

  // ============================================
  // SCROLL POSITIONS
  // ============================================
  
  async saveScrollPosition(screenName: string, position: number): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.SCROLL_POSITIONS);
      const positions: Record<string, number> = existing ? JSON.parse(existing) : {};
      positions[screenName] = position;
      await AsyncStorage.setItem(STORAGE_KEYS.SCROLL_POSITIONS, JSON.stringify(positions));
    } catch (error) {
      console.warn('Failed to save scroll position:', error);
    }
  }

  async getScrollPosition(screenName: string): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SCROLL_POSITIONS);
      if (!data) return 0;
      const positions: Record<string, number> = JSON.parse(data);
      return positions[screenName] || 0;
    } catch (error) {
      return 0;
    }
  }

  async clearScrollPosition(screenName: string): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.SCROLL_POSITIONS);
      if (existing) {
        const positions = JSON.parse(existing);
        delete positions[screenName];
        await AsyncStorage.setItem(STORAGE_KEYS.SCROLL_POSITIONS, JSON.stringify(positions));
      }
    } catch (error) {
      console.warn('Failed to clear scroll position:', error);
    }
  }

  // ============================================
  // COMPONENT STATE (Modals, wizards, etc.)
  // ============================================
  
  async saveComponentState(componentId: string, data: any, expiryMs?: number): Promise<void> {
    try {
      const payload = {
        data,
        timestamp: Date.now(),
        expiry: expiryMs || 24 * 60 * 60 * 1000, // Default 24 hours
      };
      
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.COMPONENT_STATE);
      const states: Record<string, any> = existing ? JSON.parse(existing) : {};
      states[componentId] = payload;
      
      // Clean expired states
      const now = Date.now();
      Object.keys(states).forEach(key => {
        if (now - states[key].timestamp > states[key].expiry) {
          delete states[key];
        }
      });
      
      await AsyncStorage.setItem(STORAGE_KEYS.COMPONENT_STATE, JSON.stringify(states));
    } catch (error) {
      console.warn('Failed to save component state:', error);
    }
  }

  async getComponentState(componentId: string): Promise<any | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.COMPONENT_STATE);
      if (!data) return null;
      
      const states = JSON.parse(data);
      const state = states[componentId];
      
      if (state && Date.now() - state.timestamp < state.expiry) {
        return state.data;
      }
      return null;
    } catch (error) {
      console.warn('Failed to get component state:', error);
      return null;
    }
  }

  async clearComponentState(componentId: string): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.COMPONENT_STATE);
      if (existing) {
        const states = JSON.parse(existing);
        delete states[componentId];
        await AsyncStorage.setItem(STORAGE_KEYS.COMPONENT_STATE, JSON.stringify(states));
      }
    } catch (error) {
      console.warn('Failed to clear component state:', error);
    }
  }

  // ============================================
  // SECURITY STATE
  // ============================================
  
  async saveSecurityState(state: SecurityPersistedState): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SECURITY_STATE, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save security state:', error);
    }
  }

  async getSecurityState(): Promise<SecurityPersistedState | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SECURITY_STATE);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('Failed to get security state:', error);
      return null;
    }
  }

  // ============================================
  // NAV VISIBILITY
  // ============================================
  
  async saveNavVisibility(visible: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NAV_VISIBILITY, String(visible));
      await this.updateSessionMeta({ navVisible: visible });
    } catch (error) {
      console.warn('Failed to save nav visibility:', error);
    }
  }

  async getNavVisibility(): Promise<boolean> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.NAV_VISIBILITY);
      return data !== 'false'; // Default to true
    } catch (error) {
      return true;
    }
  }

  // ============================================
  // BATCH OPERATIONS
  // ============================================
  
  async flushPendingSaves(): Promise<void> {
    if (this.isSaving || this.pendingSaves.size === 0) return;
    
    this.isSaving = true;
    const saves: Promise<void>[] = [];
    
    this.pendingSaves.forEach((value, key) => {
      saves.push(
        AsyncStorage.setItem(key, JSON.stringify(value)).catch(console.warn)
      );
    });
    
    await Promise.all(saves);
    this.pendingSaves.clear();
    this.isSaving = false;
  }

  queueSave(key: string, data: any): void {
    this.pendingSaves.set(key, { data, timestamp: Date.now() });
    
    // Debounce flush
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.flushPendingSaves();
    }, 500);
  }

  // ============================================
  // CLEANUP
  // ============================================
  
  async clearAllState(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      await AsyncStorage.multiRemove(keys);
      this.pendingSaves.clear();
    } catch (error) {
      console.warn('Failed to clear all state:', error);
    }
  }

  async clearOldState(maxAgeDays: number = 7): Promise<void> {
    try {
      const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
      
      // Clean form states
      const formData = await AsyncStorage.getItem(STORAGE_KEYS.FORM_STATE);
      if (formData) {
        const drafts = JSON.parse(formData);
        Object.keys(drafts).forEach(key => {
          if (drafts[key].timestamp < cutoff) delete drafts[key];
        });
        await AsyncStorage.setItem(STORAGE_KEYS.FORM_STATE, JSON.stringify(drafts));
      }
      
      // Clean component states
      const compData = await AsyncStorage.getItem(STORAGE_KEYS.COMPONENT_STATE);
      if (compData) {
        const states = JSON.parse(compData);
        Object.keys(states).forEach(key => {
          if (states[key].timestamp < cutoff) delete states[key];
        });
        await AsyncStorage.setItem(STORAGE_KEYS.COMPONENT_STATE, JSON.stringify(states));
      }
      
      // Clean scroll positions
      await AsyncStorage.removeItem(STORAGE_KEYS.SCROLL_POSITIONS);
      
    } catch (error) {
      console.warn('Failed to clear old state:', error);
    }
  }

  // ============================================
  // RESTORE HELPERS
  // ============================================
  
  async shouldRestoreRoute(): Promise<{ shouldRestore: boolean; route?: string; params?: any }> {
    const meta = await this.getSessionMeta();
    const lastRoute = await this.getLastRoute();
    
    if (!meta || !lastRoute) {
      return { shouldRestore: false };
    }
    
    // Don't restore if app was killed (no state saved)
    // Don't restore auth/security screens
    const nonRestorableRoutes = [
      'SecurityLock', 'Login', 'SignUp', 'ForgotPassword', 
      'Onboarding', 'BiometricSetup'
    ];
    
    if (nonRestorableRoutes.includes(lastRoute.name)) {
      return { shouldRestore: false };
    }
    
    // Check if session is still valid (within 30 minutes)
    const sessionValid = Date.now() - meta.lastActive < 30 * 60 * 1000;
    
    return {
      shouldRestore: sessionValid,
      route: lastRoute.name,
      params: lastRoute.params,
    };
  }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const statePersistence = StatePersistenceManager.getInstance();
export default statePersistence;

// ============================================
// CONVENIENCE EXPORTS (for backward compatibility)
// ============================================

export const saveNavigationState = (state: object, routeName: string, params?: Record<string, any>) => 
  statePersistence.saveNavigationState(state, routeName, params);

export const getNavigationState = () => statePersistence.getNavigationState();

export const saveLastRoute = (routeName: string, params?: Record<string, any>) => 
  statePersistence.saveLastRoute(routeName, params);

export const getLastRoute = () => statePersistence.getLastRoute();

export const saveFormState = (screenName: string, formData: Record<string, any>) => 
  statePersistence.saveFormState(screenName, formData);

export const getFormState = (screenName: string) => statePersistence.getFormState(screenName);

export const saveScrollPosition = (screenName: string, position: number) => 
  statePersistence.saveScrollPosition(screenName, position);

export const getScrollPosition = (screenName: string) => statePersistence.getScrollPosition(screenName);
