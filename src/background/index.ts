import { MessageType, UserSettings, DEFAULT_SETTINGS } from '../types';
import { getSettings, saveSettings } from '../utils/storage';

// 初始化設定
const initSettings = async (): Promise<void> => {
  try {
    const settings = await getSettings();
    if (!settings) {
      await saveSettings(DEFAULT_SETTINGS);
    }
  } catch (error) {
    console.error('初始化設定時出錯:', error);
  }
};

// 處理來自內容腳本和彈出視窗的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handleMessage = async () => {
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
        default:
          sendResponse({ success: false, error: '未知的消息類型' });
      }
    } catch (error) {
      console.error('處理消息時出錯:', error);
      sendResponse({ success: false, error: String(error) });
    }
  };

  // 返回 true 表示將異步發送響應
  handleMessage();
  return true;
});

// 當擴充功能安裝或更新時初始化設定
chrome.runtime.onInstalled.addListener(() => {
  initSettings();
}); 