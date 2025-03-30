import { MessageType, UserSettings, DEFAULT_SETTINGS } from '../types';
import { getSettings } from '../utils/storage';

// 初始化變數
let userSettings: UserSettings = DEFAULT_SETTINGS;
let isAd: boolean = false;
let originalSpeed: number = 1.0;
let observer: MutationObserver | null = null;

// 確保 content script 已經載入
console.log('Content script 已載入');

// 初始化設定
const initSettings = async (): Promise<void> => {
  try {
    const settings = await getSettings();
    if (settings) {
      userSettings = settings;
      console.log('設定已載入:', settings);
    }
  } catch (error) {
    console.error('載入設定時出錯:', error instanceof Error ? error.message : String(error));
  }
};

// 檢查當前影片是否為廣告
const checkIfAd = (): boolean => {
  try {
    // 檢查播放器元素
    const videoElement = document.querySelector('video');
    if (!videoElement) return false;

    // 檢查多個廣告指標
    const adIndicators = [
      // 廣告容器
      '.ytp-ad-player-overlay',        // 影片廣告覆蓋層
      '.ytp-ad-overlay-container',     // 廣告覆蓋容器
      '.video-ads.ytp-ad-module',      // 廣告模組
      '.ytp-ad-text',                  // 廣告文字
      '.ytp-ad-preview-container',     // 廣告預覽容器
      '.ytp-ad-skip-button-container', // 可跳過廣告按鈕容器
      'div[id^="ad-text"]',           // 以 ad-text 開頭的廣告文字元素
      '[class*="ytp-ad-"]'            // 任何包含 ytp-ad- 的類別
    ];

    // 檢查是否存在任一廣告指標
    const hasAdElement = adIndicators.some(selector => 
      document.querySelector(selector) !== null
    );

    // 檢查 URL 是否包含廣告參數
    const hasAdUrl = window.location.search.includes('&ad_type=') || 
                    window.location.search.includes('&adformat=') ||
                    window.location.search.includes('&adurl=');

    // 檢查播放器狀態
    const playerElement = document.getElementById('movie_player');
    const hasAdPlaying = playerElement?.classList.contains('ad-showing') === true || 
                        playerElement?.classList.contains('ad-interrupting') === true;

    // 綜合判斷
    const isAd = hasAdElement || hasAdUrl || hasAdPlaying;
    
    if (isAd) {
      console.log('偵測到廣告:', {
        hasAdElement,
        hasAdUrl,
        hasAdPlaying
      });
    }

    return isAd;
  } catch (error) {
    console.error('檢查廣告狀態時出錯:', error instanceof Error ? error.message : String(error));
    return false;
  }
};

// 更新播放速度
const updatePlaybackSpeed = (videoElement: HTMLVideoElement | null): void => {
  if (!videoElement || !userSettings.enabled) return;

  try {
    // 儲存原始播放速度
    if (!isAd) {
      originalSpeed = videoElement.playbackRate;
    }

    // 根據廣告狀態設定播放速度
    const targetSpeed = isAd ? userSettings.adSpeed : originalSpeed;
    if (videoElement.playbackRate !== targetSpeed) {
      videoElement.playbackRate = targetSpeed;
      console.log(`播放速度已更新: ${targetSpeed}x (${isAd ? '廣告' : '一般影片'})`);
    }
  } catch (error) {
    console.error('更新播放速度時出錯:', error instanceof Error ? error.message : String(error));
  }
};

// 更新廣告狀態
const updateAdStatus = (): void => {
  const newIsAd = checkIfAd();
  if (newIsAd !== isAd) {
    isAd = newIsAd;
    console.log('廣告狀態已更新:', isAd);

    // 更新播放速度
    const videoElement = document.querySelector('video');
    updatePlaybackSpeed(videoElement);

    // 通知 background script 廣告狀態已變更
    chrome.runtime.sendMessage({
      type: MessageType.AD_STATUS_CHANGED,
      payload: { isAd }
    }).catch(error => {
      console.error('發送廣告狀態更新時出錯:', error instanceof Error ? error.message : String(error));
    });
  }
};

// 監聽來自 popup 的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 處理 PING 訊息
  if (message.type === MessageType.PING) {
    sendResponse({ success: true });
    return true;
  }

  // 處理獲取廣告狀態的請求
  if (message.type === MessageType.GET_AD_STATUS) {
    try {
      const videoElement = document.querySelector('video');
      const isAd = checkIfAd();
      const currentSpeed = isAd ? userSettings.adSpeed : (videoElement?.playbackRate || 1.0);

      sendResponse({
        isAd,
        currentSpeed
      });
    } catch (error) {
      console.error('處理廣告狀態請求時出錯:', error);
      sendResponse(null);
    }
    return true;
  }

  // 處理設定更新
  if (message.type === MessageType.UPDATE_SETTINGS) {
    userSettings = message.payload;
    const videoElement = document.querySelector('video');
    updatePlaybackSpeed(videoElement);
    sendResponse({ success: true });
    return true;
  }

  return false;
});

// 監聽播放速度變化
const handlePlaybackRateChange = (event: Event) => {
  const videoElement = event.target as HTMLVideoElement;
  if (!isAd) {
    originalSpeed = videoElement.playbackRate;
  }
};

// 初始化 MutationObserver
const initObserver = () => {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver(() => {
    const videoElement = document.querySelector('video');
    if (videoElement) {
      videoElement.addEventListener('ratechange', handlePlaybackRateChange);
    }
    updateAdStatus();
  });

  // 確保 document.body 存在後才開始觀察
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    console.log('開始觀察 DOM 變化');
  }
};

// 初始化
initSettings().then(() => {
  console.log('Content script 初始化完成');
}); 