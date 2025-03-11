/// <reference types="chrome" />
import { UserSettings, DEFAULT_SETTINGS } from '../types';

// 儲存設定到 Chrome 儲存空間
export const saveSettings = async (settings: UserSettings): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    try {
      chrome.storage.sync.set({ settings }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
};

// 從 Chrome 儲存空間獲取設定
export const getSettings = async (): Promise<UserSettings> => {
  return new Promise<UserSettings>((resolve, reject) => {
    try {
      chrome.storage.sync.get('settings', (result: { settings?: UserSettings }) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.settings || DEFAULT_SETTINGS);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}; 