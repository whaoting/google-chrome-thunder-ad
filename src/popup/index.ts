import './popup.css';
import { MessageType, UserSettings, DEFAULT_SETTINGS, AdStatus } from '../types';

// DOM 元素
const adSpeedSlider = document.getElementById('ad-speed-slider') as HTMLInputElement;
const adSpeedValue = document.getElementById('ad-speed-value') as HTMLSpanElement;
const videoSpeedSlider = document.getElementById('video-speed-slider') as HTMLInputElement;
const videoSpeedValue = document.getElementById('video-speed-value') as HTMLSpanElement;
const enableToggle = document.getElementById('enable-toggle') as HTMLInputElement;
const statusText = document.getElementById('status-text') as HTMLSpanElement;
const statusDot = document.getElementById('status-dot') as HTMLDivElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
const checkStatusBtn = document.getElementById('check-status-btn') as HTMLButtonElement;
const currentStatus = document.getElementById('current-status') as HTMLSpanElement;
const adQuickButtons = document.querySelectorAll('.section:nth-child(1) .quick-button') as NodeListOf<HTMLButtonElement>;
const videoQuickButtons = document.querySelectorAll('.section:nth-child(2) .quick-button') as NodeListOf<HTMLButtonElement>;

// 當前設定
let currentSettings: UserSettings = DEFAULT_SETTINGS;

// 從背景腳本獲取設定
const fetchSettings = async (): Promise<UserSettings> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: MessageType.GET_SETTINGS }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (response && response.success) {
        resolve(response.settings);
      } else {
        reject(new Error('獲取設定失敗'));
      }
    });
  });
};

// 更新設定到背景腳本
const updateSettings = async (settings: UserSettings): Promise<void> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ 
      type: MessageType.UPDATE_SETTINGS, 
      payload: settings 
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (response && response.success) {
        resolve();
      } else {
        reject(new Error('更新設定失敗'));
      }
    });
  });
};

// 獲取當前廣告狀態
const getAdStatus = async (): Promise<AdStatus | null> => {
  return new Promise((resolve, reject) => {
    // 查詢當前活動標籤
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        resolve(null);
        return;
      }
      
      // 發送消息到內容腳本
      chrome.tabs.sendMessage(tabs[0].id!, { type: MessageType.GET_AD_STATUS }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('獲取廣告狀態時出錯:', chrome.runtime.lastError);
          resolve(null);
        } else if (response && response.success) {
          resolve(response.status);
        } else {
          resolve(null);
        }
      });
    });
  });
};

// 更新 UI 顯示
const updateUI = (settings: UserSettings): void => {
  // 更新滑塊和數值顯示
  adSpeedSlider.value = settings.adSpeed.toString();
  adSpeedValue.textContent = `${settings.adSpeed.toFixed(1)}x`;
  
  videoSpeedSlider.value = settings.videoSpeed.toString();
  videoSpeedValue.textContent = `${settings.videoSpeed.toFixed(1)}x`;
  
  // 更新開關狀態
  enableToggle.checked = settings.enabled;
  
  // 更新狀態指示器
  statusText.textContent = settings.enabled ? '已啟用' : '已停用';
  if (settings.enabled) {
    statusDot.classList.add('active');
  } else {
    statusDot.classList.remove('active');
  }
  
  // 更新快速按鈕狀態
  updateQuickButtonsState(adQuickButtons, settings.adSpeed);
  updateQuickButtonsState(videoQuickButtons, settings.videoSpeed);
};

// 更新快速按鈕狀態
const updateQuickButtonsState = (buttons: NodeListOf<HTMLButtonElement>, currentValue: number): void => {
  buttons.forEach(button => {
    const buttonSpeed = parseFloat(button.dataset.speed || '0');
    if (buttonSpeed === currentValue) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });
};

// 更新廣告狀態顯示
const updateAdStatusDisplay = async (): Promise<void> => {
  const status = await getAdStatus();
  
  if (status === null) {
    currentStatus.textContent = '無法獲取狀態';
    return;
  }
  
  if (status.isAd) {
    currentStatus.textContent = `正在播放廣告 (${status.currentSpeed.toFixed(1)}x)`;
  } else {
    currentStatus.textContent = `正常影片播放中 (${status.currentSpeed.toFixed(1)}x)`;
  }
};

// 初始化
const init = async (): Promise<void> => {
  try {
    // 獲取設定
    currentSettings = await fetchSettings();
    
    // 更新 UI
    updateUI(currentSettings);
    
    // 更新廣告狀態顯示
    await updateAdStatusDisplay();
    
    // 設定事件監聽器
    setupEventListeners();
    
  } catch (error) {
    console.error('初始化彈出視窗時出錯:', error);
  }
};

// 設定事件監聽器
const setupEventListeners = (): void => {
  // 廣告速度滑塊變更
  adSpeedSlider.addEventListener('input', () => {
    const value = parseFloat(adSpeedSlider.value);
    adSpeedValue.textContent = `${value.toFixed(1)}x`;
    currentSettings.adSpeed = value;
    updateSettings(currentSettings);
    updateQuickButtonsState(adQuickButtons, value);
  });
  
  // 影片速度滑塊變更
  videoSpeedSlider.addEventListener('input', () => {
    const value = parseFloat(videoSpeedSlider.value);
    videoSpeedValue.textContent = `${value.toFixed(1)}x`;
    currentSettings.videoSpeed = value;
    updateSettings(currentSettings);
    updateQuickButtonsState(videoQuickButtons, value);
  });
  
  // 啟用開關變更
  enableToggle.addEventListener('change', () => {
    currentSettings.enabled = enableToggle.checked;
    updateSettings(currentSettings);
    updateUI(currentSettings);
  });
  
  // 重置按鈕點擊
  resetBtn.addEventListener('click', () => {
    currentSettings = { ...DEFAULT_SETTINGS };
    updateSettings(currentSettings);
    updateUI(currentSettings);
  });
  
  // 檢查狀態按鈕點擊
  checkStatusBtn.addEventListener('click', updateAdStatusDisplay);
  
  // 廣告速度快速按鈕點擊
  adQuickButtons.forEach(button => {
    button.addEventListener('click', () => {
      const value = parseFloat(button.dataset.speed || '0');
      currentSettings.adSpeed = value;
      updateSettings(currentSettings);
      updateUI(currentSettings);
    });
  });
  
  // 影片速度快速按鈕點擊
  videoQuickButtons.forEach(button => {
    button.addEventListener('click', () => {
      const value = parseFloat(button.dataset.speed || '0');
      currentSettings.videoSpeed = value;
      updateSettings(currentSettings);
      updateUI(currentSettings);
    });
  });
};

// 當文檔加載完成後初始化
document.addEventListener('DOMContentLoaded', init); 