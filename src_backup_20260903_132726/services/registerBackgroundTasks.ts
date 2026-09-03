// src/services/registerBackgroundTasks.ts

import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Platform } from 'react-native';

const BACKGROUND_SYNC_TASK = 'BACKGROUND_NOTIFICATION_SYNC';

// Define the task if not already defined
if (!TaskManager.isTaskDefined(BACKGROUND_SYNC_TASK)) {
  TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
      // Import dynamically to avoid circular dependencies
      const { NotificationSyncService } = require('./EnhancedNotificationService');
      const syncService = NotificationSyncService.getInstance();
      const result = await syncService.performBackgroundSync();
      
      return result?.hasUpdates 
        ? BackgroundFetch.BackgroundFetchResult.NewData 
        : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
      console.error('[BackgroundSync] Task error:', error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

export async function registerBackgroundTasks(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    
    if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
      console.log('[BackgroundTasks] Permission denied');
      return;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 5, // minutes
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('[BackgroundTasks] Registered successfully');
    }
  } catch (error) {
    console.error('[BackgroundTasks] Registration error:', error);
  }
}

export async function unregisterBackgroundTasks(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    console.log('[BackgroundTasks] Unregistered');
  } catch (error) {
    console.error('[BackgroundTasks] Unregister error:', error);
  }
}