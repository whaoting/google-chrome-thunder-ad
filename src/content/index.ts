import { MessageType, UserSettings, DEFAULT_SETTINGS } from '../types';
import { getSettings } from '../utils/storage';

// 全域變數
let userSettings: UserSettings = DEFAULT_SETTINGS;
let currentIsAd = false;
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

    // 檢查是否為音樂影片
    const isMusic = checkIfMusic();

    // 綜合判斷：如果是音樂影片，則不判定為廣告
    const isAd = (hasAdElement || hasAdUrl || hasAdPlaying) && !isMusic;
    
    if (isAd) {
      console.log('偵測到廣告:', {
        hasAdElement,
        hasAdUrl,
        hasAdPlaying,
        isMusic
      });
    }

    return isAd;
  } catch (error) {
    console.error('檢查廣告狀態時出錯:', error instanceof Error ? error.message : String(error));
    return false;
  }
};

// 檢查當前影片是否為音樂類型
const checkIfMusic = (): boolean => {
  try {
    // 方法 1: 檢查頻道名稱是否為官方音樂頻道
    const channelName = document.querySelector('#top-row ytd-video-owner-renderer yt-formatted-string.ytd-channel-name')?.textContent?.trim();
    const isMusicChannel = channelName?.includes('- Topic') || 
                         channelName?.endsWith('VEVO') ||
                         channelName?.includes('Official Music');

    // 方法 2: 檢查影片類別
    const categoryElement = document.querySelector('meta[itemprop="genre"]');
    const category = categoryElement?.getAttribute('content');
    const isMusicCategory = category === 'Music';

    // 方法 3: 檢查影片標題和描述
    const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim();
    const videoDescription = document.querySelector('#description')?.textContent?.trim();
    const hasMusicKeywords = (videoTitle?.toLowerCase().includes('mv') ||
                           videoTitle?.toLowerCase().includes('music video') ||
                           videoTitle?.toLowerCase().includes('official video')) ?? false;

    // 方法 4: 檢查音樂區段標記
    const hasChapters = document.querySelectorAll('.ytp-chapter-marker-segment').length > 0;

    // 綜合判斷
    const isMusic = isMusicChannel || isMusicCategory || hasMusicKeywords || hasChapters;

    if (isMusic) {
      console.log('偵測到音樂影片:', {
        channelName,
        category,
        hasMusicKeywords,
        hasChapters
      });
    }

    return isMusic;
  } catch (error) {
    console.error('檢查音樂影片狀態時出錯:', error instanceof Error ? error.message : String(error));
    return false;
  }
};

// 監聽影片切換
const observeVideoChanges = () => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' || mutation.type === 'attributes') {
        // 檢查影片元素是否變更
        const videoElement = document.querySelector('video');
        if (videoElement) {
          // 更新播放速度
          updatePlaybackSpeed();
        }
      }
    });
  });

  // 監聽播放器元素
  const playerElement = document.getElementById('movie_player');
  if (playerElement) {
    observer.observe(playerElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  // 監聽 URL 變化
  let lastUrl = window.location.href;
  setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // URL 變更時更新播放速度
      updatePlaybackSpeed();
    }
  }, 1000);

  return observer;
};

// 更新播放速度
const updatePlaybackSpeed = async () => {
  try {
    const settings = await getSettings();
    if (!settings.enabled) {
      return;
    }

    const isAd = await checkIfAd();
    const isMusic = await checkIfMusic();
    const video = document.querySelector('video');
    
    if (!video) {
      console.warn('找不到影片元素');
      return;
    }

    // 優先處理廣告
    if (isAd) {
      video.playbackRate = settings.adSpeed;
      console.log('設定廣告播放速度:', settings.adSpeed);
      return;
    }

    // 如果不是廣告，再檢查是否為音樂影片
    if (isMusic && settings.autoNormalSpeedForMusic) {
      video.playbackRate = 1.0;
      console.log('檢測到音樂影片，自動切換為 1 倍速');
      return;
    }

    // 一般影片使用正常速度
    video.playbackRate = settings.videoSpeed;
    console.log('設定一般影片播放速度:', settings.videoSpeed);

    // 更新狀態
    await updateAdStatus();
  } catch (error) {
    console.error('更新播放速度時出錯:', error);
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
    updatePlaybackSpeed();

    // 通知 background script 廣告狀態已變更
    chrome.runtime.sendMessage({
      type: MessageType.AD_STATUS_CHANGED,
      payload: { isAd }
    }).catch(error => {
      console.error('發送廣告狀態更新時出錯:', error instanceof Error ? error.message : String(error));
    });
  }
};

// 更新到 types.ts 中的 AdStatus 介面
interface VideoStatus {
  isAd: boolean;
  isMusic: boolean;
  currentSpeed: number;
}

// 獲取影片狀態
const getAdStatus = async (): Promise<VideoStatus> => {
  try {
    const videoElement = document.querySelector('video');
    const isAd = await checkIfAd();
    const isMusic = await checkIfMusic();
    const currentSpeed = videoElement?.playbackRate || 1.0;

    return {
      isAd,
      isMusic,
      currentSpeed
    };
  } catch (error) {
    console.error('獲取影片狀態時出錯:', error);
    return {
      isAd: false,
      isMusic: false,
      currentSpeed: 1.0
    };
  }
};

// 處理來自 popup 的訊息
const handleMessage = async (message: any, sendResponse: (response: any) => void) => {
  try {
    switch (message.type) {
      case MessageType.PING:
        sendResponse({ success: true });
        break;
      case MessageType.GET_AD_STATUS:
        const status = await getAdStatus();
        sendResponse(status);
        break;
      case MessageType.UPDATE_SETTINGS:
        userSettings = message.payload;
        const videoElement = document.querySelector('video');
        updatePlaybackSpeed();
        sendResponse({ success: true });
        break;
      default:
        console.warn('收到未知的訊息類型:', message.type);
    }
  } catch (error) {
    console.error('處理訊息時出錯:', error);
    sendResponse({ success: false, error: String(error) });
  }
};

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
const init = async () => {
  try {
    // 載入設定
    userSettings = await getSettings();
    
    // 設定 MutationObserver 監聽影片切換
    const observer = observeVideoChanges();
    
    // 監聽來自 popup 的訊息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      handleMessage(message, sendResponse);
      return true;
    });

    // 定期檢查廣告狀態
    setInterval(async () => {
      const isAd = await checkIfAd();
      if (isAd !== currentIsAd) {
        currentIsAd = isAd;
        await updateAdStatus();
      }
    }, 1000);

    console.log('Content script 已初始化');
  } catch (error) {
    console.error('初始化時出錯:', error instanceof Error ? error.message : String(error));
  }
};

// 啟動初始化
init(); 