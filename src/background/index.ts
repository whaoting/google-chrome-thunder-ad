import { MessageType, UserSettings, DEFAULT_SETTINGS } from '../types';
import { getSettings, saveSettings } from '../utils/storage';

// 聲明 self 類型，以便在 TypeScript 中使用
declare const self: ServiceWorkerGlobalScope;

// 初始化設定
const initSettings = async (): Promise<void> => {
  try {
    const settings = await getSettings();
    if (!settings) {
      await saveSettings(DEFAULT_SETTINGS);
    }
    console.log('設定已初始化:', settings || DEFAULT_SETTINGS);
  } catch (error) {
    console.error('初始化設定時出錯:', error instanceof Error ? error.message : String(error));
  }
};

// 處理來自內容腳本和彈出視窗的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 在 Service Worker 中，我們需要保持 worker 活躍直到異步操作完成
  const keepServiceWorkerAlive = new Promise<void>(async (resolve) => {
    try {
      switch (message.type) {
        case MessageType.GET_SETTINGS:
          const settings = await getSettings();
          sendResponse({ success: true, settings });
          break;
        case MessageType.UPDATE_SETTINGS:
          await saveSettings(message.payload as UserSettings);
          sendResponse({ success: true });
          break;
        case MessageType.AD_STATUS_CHANGED:
          // 只是記錄廣告狀態變更，不需要特別處理
          console.log('廣告狀態變更:', message.payload);
          sendResponse({ success: true });
          break;
        default:
          sendResponse({ success: false, error: '未知的消息類型' });
      }
    } catch (error) {
      console.error('處理消息時出錯:', error instanceof Error ? error.message : String(error));
      sendResponse({ success: false, error: String(error) });
    } finally {
      resolve(); // 完成後解析 Promise
    }
  });

  // 返回 true 表示將異步發送響應
  return true;
});

// 當擴充功能安裝或更新時初始化設定
chrome.runtime.onInstalled.addListener(() => {
  console.log('擴充功能已安裝或更新');
  initSettings();
});

// 確保 Service Worker 不會過早終止
self.addEventListener('install', (event) => {
  console.log('Service Worker 已安裝');
  // 跳過等待，直接激活
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker 已激活');
  // 立即接管所有客戶端
  event.waitUntil(self.clients.claim());
});

// 保持 Service Worker 活躍
chrome.runtime.onConnect.addListener((port) => {
  console.log('新連接已建立');
  port.onDisconnect.addListener(() => {
    console.log('連接已斷開');
  });
}); 