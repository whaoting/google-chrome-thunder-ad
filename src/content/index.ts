import { MessageType, UserSettings, DEFAULT_SETTINGS, AdStatus } from '../types';

// 當前設定
let currentSettings: UserSettings = DEFAULT_SETTINGS;
// 當前廣告狀態
let adStatus: AdStatus = { isAd: false, currentSpeed: DEFAULT_SETTINGS.videoSpeed };
// 視頻元素
let videoElement: HTMLVideoElement | null = null;
// 觀察器
let adObserver: MutationObserver | null = null;

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

// 發送廣告狀態變更消息
const sendAdStatusChanged = (status: AdStatus): void => {
  chrome.runtime.sendMessage({
    type: MessageType.AD_STATUS_CHANGED,
    payload: status
  });
};

// 檢查是否為廣告
const checkIfAd = (): boolean => {
  // 方法1: 檢查廣告標籤
  const adBadge = document.querySelector('.ytp-ad-simple-ad-badge, .ytp-ad-text');
  if (adBadge) return true;

  // 方法2: 檢查跳過廣告按鈕
  const skipButton = document.querySelector('.ytp-ad-skip-button');
  if (skipButton) return true;

  // 方法3: 檢查廣告資訊面板
  const adInfoPanel = document.querySelector('.ytp-ad-info-panel-container');
  if (adInfoPanel) return true;

  // 方法4: 檢查URL參數
  const url = new URL(window.location.href);
  const adParam = url.searchParams.get('ad');
  if (adParam) return true;

  return false;
};

// 設定視頻播放速度
const setVideoSpeed = (speed: number): void => {
  if (!videoElement) return;
  
  videoElement.playbackRate = speed;
  adStatus.currentSpeed = speed;
};

// 更新廣告狀態並設定相應的播放速度
const updateAdStatus = (): void => {
  if (!videoElement || !currentSettings.enabled) return;

  const isAd = checkIfAd();
  
  // 如果廣告狀態發生變化
  if (isAd !== adStatus.isAd) {
    adStatus.isAd = isAd;
    
    // 根據廣告狀態設定播放速度
    if (isAd) {
      setVideoSpeed(currentSettings.adSpeed);
      console.log('偵測到廣告，設定播放速度為:', currentSettings.adSpeed);
    } else {
      setVideoSpeed(currentSettings.videoSpeed);
      console.log('廣告結束，恢復播放速度為:', currentSettings.videoSpeed);
    }
    
    // 發送狀態變更消息
    sendAdStatusChanged(adStatus);
  }
};

// 初始化視頻元素觀察器
const initVideoObserver = (): void => {
  // 查找視頻元素
  videoElement = document.querySelector('video');
  
  if (!videoElement) {
    console.log('未找到視頻元素，稍後重試');
    setTimeout(initVideoObserver, 1000);
    return;
  }
  
  console.log('找到視頻元素，初始化觀察器');
  
  // 創建 MutationObserver 來監視 DOM 變化
  adObserver = new MutationObserver((mutations) => {
    updateAdStatus();
  });
  
  // 監視整個文檔的變化
  adObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });
  
  // 初始檢查廣告狀態
  updateAdStatus();
  
  // 監聽視頻播放事件
  videoElement.addEventListener('play', updateAdStatus);
  videoElement.addEventListener('seeked', updateAdStatus);
};

// 初始化擴充功能
const init = async (): Promise<void> => {
  try {
    // 獲取設定
    currentSettings = await fetchSettings();
    console.log('已獲取設定:', currentSettings);
    
    // 初始化視頻觀察器
    initVideoObserver();
    
    // 監聽設定變更消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === MessageType.UPDATE_SETTINGS && message.payload) {
        currentSettings = message.payload;
        console.log('設定已更新:', currentSettings);
        
        // 根據當前廣告狀態更新播放速度
        if (adStatus.isAd) {
          setVideoSpeed(currentSettings.adSpeed);
        } else {
          setVideoSpeed(currentSettings.videoSpeed);
        }
        
        sendResponse({ success: true });
      } else if (message.type === MessageType.GET_AD_STATUS) {
        sendResponse({ success: true, status: adStatus });
      }
      
      return true;
    });
    
  } catch (error) {
    console.error('初始化擴充功能時出錯:', error);
  }
};

// 當頁面加載完成後初始化
if (document.readyState === 'complete') {
  init();
} else {
  window.addEventListener('load', init);
} 