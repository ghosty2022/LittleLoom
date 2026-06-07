import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';

const STORAGE_KEYS = {
  NAVIGATION_STATE: '@littleloom_navigation_state',
  FORM_STATE: '@littleloom_form_state',
  SCROLL_POSITIONS: '@littleloom_scroll_positions',
  DRAFT_DATA: '@littleloom_draft_data',
} as const;

export interface PersistedFormState {
  screenName: string;
  formData: Record<string, any>;
  timestamp: number;
}

export interface PersistedNavigationState {
  currentRoute: string;
  params?: Record<string, any>;
  timestamp: number;
}

class StatePersistenceManager {
  private static instance: StatePersistenceManager;
  private appStateSubscription: any;
  private isSaving: boolean = false;
  private pendingSaves: Map<string, any> = new Map();

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
  }

  private async handleAppStateChange(nextAppState: AppStateStatus): Promise<void> {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      await this.flushPendingSaves();
    }
  }

  async saveNavigationState(routeName: string, params?: Record<string, any>): Promise<void> {
    try {
      const state: PersistedNavigationState = {
        currentRoute: routeName,
        params,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.NAVIGATION_STATE, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save navigation state:', error);
    }
  }

  async getNavigationState(): Promise<PersistedNavigationState | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.NAVIGATION_STATE);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('Failed to get navigation state:', error);
      return null;
    }
  }

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
      
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      Object.keys(drafts).forEach(key => {
        if (drafts[key].timestamp < sevenDaysAgo) {
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

  async saveDraft(key: string, data: any): Promise<void> {
    this.pendingSaves.set(key, data);
    if (!this.isSaving) {
      await this.flushPendingSaves();
    }
  }

  async getDraft(key: string): Promise<any> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEYS.DRAFT_DATA}_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  }

  async flushPendingSaves(): Promise<void> {
    if (this.isSaving || this.pendingSaves.size === 0) return;
    
    this.isSaving = true;
    const saves: Promise<void>[] = [];
    
    this.pendingSaves.forEach((data, key) => {
      saves.push(
        AsyncStorage.setItem(
          `${STORAGE_KEYS.DRAFT_DATA}_${key}`,
          JSON.stringify({ data, timestamp: Date.now() })
        ).catch(console.warn)
      );
    });
    
    await Promise.all(saves);
    this.pendingSaves.clear();
    this.isSaving = false;
  }

  async clearAllState(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.warn('Failed to clear all state:', error);
    }
  }

  async getLastActiveRoute(): Promise<{ route: string; params?: any } | null> {
    const navState = await this.getNavigationState();
    if (navState) {
      return { route: navState.currentRoute, params: navState.params };
    }
    return null;
  }
}

export const statePersistence = StatePersistenceManager.getInstance();
export default statePersistence;