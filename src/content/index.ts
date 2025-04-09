import { MessageType, UserSettings, DEFAULT_SETTINGS } from '../types';
import { getSettings } from '../utils/storage';

// 全域變數
let userSettings: UserSettings = DEFAULT_SETTINGS;
let currentIsAd = false;
let isAd: boolean = false;
let originalSpeed: number = 1.0;
let videoObserver: MutationObserver | null = null;
let skipObserver: MutationObserver | null = null;
let adCheckInterval: number | null = null;
let messageListener: ((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => void) | null = null;
let isExtensionValid = true;

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

// 檢查擴充功能是否有效
const checkExtensionValidity = () => {
  try {
    chrome.runtime.getURL('');
    return true;
  } catch (error) {
    return false;
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
      '.ytp-ad-skip-button-container', // 可跳過廣告按鈕容器
      '.ytp-ad-preview-container',     // 廣告預覽容器
      '.video-ads.ytp-ad-module'       // 廣告模組
    ];

    // 檢查是否存在任一廣告指標
    const hasAdElement = adIndicators.some(selector => {
      const element = document.querySelector(selector);
      // 確保元素存在且可見
      return element !== null && 
             window.getComputedStyle(element).display !== 'none' &&
             window.getComputedStyle(element).visibility !== 'hidden';
    });

    // 檢查播放器狀態
    const playerElement = document.getElementById('movie_player');
    const hasAdPlaying = playerElement?.classList.contains('ad-showing') === true || 
                        playerElement?.classList.contains('ad-interrupting') === true;

    // 檢查是否為音樂影片
    const isMusic = checkIfMusic();

    // 綜合判斷：如果是音樂影片，則不判定為廣告
    const isAd = (hasAdElement || hasAdPlaying) && !isMusic;
    
    if (isAd) {
      console.log('偵測到廣告:', {
        hasAdElement,
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

  // 定期檢查廣告狀態和播放速度
  setInterval(async () => {
    const video = document.querySelector('video');
    if (!video) return;

    const settings = await getSettings();
    const isAd = await checkIfAd();
    const isMusic = await checkIfMusic();

    // 如果不是廣告且不是音樂影片，確保使用設定的影片速度
    if (!isAd && !(isMusic && settings.autoNormalSpeedForMusic)) {
      if (video.playbackRate !== settings.videoSpeed) {
        video.playbackRate = settings.videoSpeed;
        console.log('恢復影片播放速度:', settings.videoSpeed);
      }
    }

    updatePlaybackSpeed();
  }, 500); // 每 500ms 檢查一次

  return observer;
};

// 更新播放速度
const updatePlaybackSpeed = async () => {
  try {
    const settings = await getSettings();
    if (!settings.enabled) {
      // 如果插件被禁用，清除 badge
      chrome.runtime.sendMessage({
        type: MessageType.UPDATE_BADGE,
        payload: { speed: null }
      });
      return;
    }

    const isAd = await checkIfAd();
    const isMusic = await checkIfMusic();
    const video = document.querySelector('video');
    
    if (!video) {
      console.warn('找不到影片元素');
      return;
    }

    let newSpeed = video.playbackRate; // 預設使用當前播放速度

    // 優先處理廣告
    if (isAd) {
      newSpeed = settings.adSpeed;
      video.playbackRate = newSpeed;
      console.log('設定廣告播放速度:', newSpeed);
    }
    // 如果不是廣告，再檢查是否為音樂影片
    else if (isMusic && settings.autoNormalSpeedForMusic) {
      newSpeed = 1.0;
      video.playbackRate = newSpeed;
      console.log('檢測到音樂影片，自動切換為 1 倍速');
    }
    // 一般影片：如果當前速度不是廣告速度或音樂速度，則更新設定
    else if (video.playbackRate !== settings.adSpeed && 
             !(isMusic && settings.autoNormalSpeedForMusic)) {
      // 更新設定中的影片速度
      settings.videoSpeed = video.playbackRate;
      // 儲存新的播放速度設定
      chrome.runtime.sendMessage({
        type: MessageType.UPDATE_SETTINGS,
        payload: settings
      });
      console.log('更新影片播放速度設定:', video.playbackRate);
    }

    // 發送速度更新訊息到 background script
    chrome.runtime.sendMessage({
      type: MessageType.UPDATE_BADGE,
      payload: { speed: video.playbackRate }
    });

    // 更新狀態
    await updateAdStatus();
  } catch (error) {
    console.error('更新播放速度時出錯:', error);
  }
};

// 監聽播放速度變化
const handlePlaybackRateChange = async (event: Event) => {
  const videoElement = event.target as HTMLVideoElement;
  const settings = await getSettings();
  
  if (!settings.enabled) {
    chrome.runtime.sendMessage({
      type: MessageType.UPDATE_BADGE,
      payload: { speed: null }
    });
    return;
  }

  // 立即更新 badge 顯示當前速度
  chrome.runtime.sendMessage({
    type: MessageType.UPDATE_BADGE,
    payload: { speed: videoElement.playbackRate }
  });

  const isAdVideo = await checkIfAd();
  const isMusicVideo = await checkIfMusic();
  
  let newSpeed = videoElement.playbackRate;
  
  // 如果是廣告，使用廣告速度
  if (isAdVideo) {
    newSpeed = settings.adSpeed;
    videoElement.playbackRate = newSpeed;
  }
  // 如果是音樂且啟用自動正常速度，使用 1.0
  else if (isMusicVideo && settings.autoNormalSpeedForMusic) {
    newSpeed = 1.0;
    videoElement.playbackRate = newSpeed;
  }
  // 其他情況，使用用戶手動設定的速度
  else {
    settings.videoSpeed = videoElement.playbackRate;
    // 儲存新的播放速度設定
    chrome.runtime.sendMessage({
      type: MessageType.UPDATE_SETTINGS,
      payload: settings
    });
  }

  // 如果速度被調整，再次更新 badge
  if (newSpeed !== videoElement.playbackRate) {
    chrome.runtime.sendMessage({
      type: MessageType.UPDATE_BADGE,
      payload: { speed: newSpeed }
    });
  }
};

// 初始化 MutationObserver
const initObserver = () => {
  if (videoObserver) {
    videoObserver.disconnect();
  }

  videoObserver = new MutationObserver(() => {
    const videoElement = document.querySelector('video');
    if (videoElement) {
      // 移除舊的事件監聽器（如果存在）
      videoElement.removeEventListener('ratechange', handlePlaybackRateChange);
      // 添加新的事件監聽器
      videoElement.addEventListener('ratechange', handlePlaybackRateChange);
    }
    updateAdStatus();
  });

  // 確保 document.body 存在後才開始觀察
  if (document.body) {
    videoObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    console.log('開始觀察 DOM 變化');
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

// 自動略過廣告
const autoSkipAds = async (): Promise<MutationObserver | null> => {
  try {
    const settings = await getSettings();
    if (!settings.enabled || !settings.autoSkipAds) return null;

    // 監聽略過按鈕的出現
    const skipButtonObserver = new MutationObserver(async (mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          // 檢查是否出現略過按鈕
          const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
          if (skipButton && !skipButton.hasAttribute('data-clicked')) {
            // 標記按鈕已被點擊
            skipButton.setAttribute('data-clicked', 'true');
            
            // 隨機延遲 0.5~1.5 秒
            const delay = Math.random() * 1000 + 500;
            
            setTimeout(() => {
              if (skipButton instanceof HTMLElement) {
                skipButton.click();
                console.log('自動略過廣告');
              }
            }, delay);
          }
        }
      }
    });

    // 監聽播放器元素
    const playerElement = document.getElementById('movie_player');
    if (playerElement) {
      skipButtonObserver.observe(playerElement, {
        childList: true,
        subtree: true,
        attributes: true
      });
    }

    return skipButtonObserver;
  } catch (error) {
    console.error('自動略過廣告時出錯:', error);
    return null;
  }
};

// 清理所有資源
const cleanup = () => {
  try {
    if (videoObserver) {
      videoObserver.disconnect();
      videoObserver = null;
    }
    if (skipObserver) {
      skipObserver.disconnect();
      skipObserver = null;
    }
    if (adCheckInterval) {
      clearInterval(adCheckInterval);
      adCheckInterval = null;
    }
    if (messageListener) {
      chrome.runtime.onMessage.removeListener(messageListener);
      messageListener = null;
    }
    isExtensionValid = false;
  } catch (error) {
    console.error('清理資源時出錯:', error);
  }
};

// 初始化
const init = async () => {
  try {
    // 檢查擴充功能是否有效
    if (!checkExtensionValidity()) {
      console.warn('擴充功能已失效');
      cleanup();
      return;
    }

    // 先清理可能存在的舊資源
    cleanup();

    // 載入設定
    userSettings = await getSettings();
    
    // 設定 MutationObserver 監聽影片切換
    videoObserver = observeVideoChanges();
    
    // 初始化自動略過廣告功能
    skipObserver = await autoSkipAds();
    
    // 監聽來自 popup 的訊息
    messageListener = (message, sender, sendResponse) => {
      if (!isExtensionValid) return;
      handleMessage(message, sendResponse);
      return true;
    };
    chrome.runtime.onMessage.addListener(messageListener);

    // 定期檢查廣告狀態和擴充功能有效性
    adCheckInterval = window.setInterval(async () => {
      try {
        if (!checkExtensionValidity()) {
          console.warn('擴充功能已失效');
          cleanup();
          return;
        }

        const isAd = await checkIfAd();
        if (isAd !== currentIsAd) {
          currentIsAd = isAd;
          await updateAdStatus();
        }
      } catch (error) {
        console.error('檢查廣告狀態時出錯:', error);
        if (error instanceof Error && error.message.includes('Extension context invalidated')) {
          cleanup();
        }
      }
    }, 1000);

    console.log('Content script 已初始化');
    isExtensionValid = true;

  } catch (error) {
    console.error('初始化時出錯:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.message.includes('Extension context invalidated')) {
      cleanup();
    }
  }
};

// 啟動初始化
init();

// 監聽頁面卸載事件
window.addEventListener('unload', cleanup);

// 監聽擴充功能失效事件
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTENSION_INVALIDATED') {
    cleanup();
  }
}); 