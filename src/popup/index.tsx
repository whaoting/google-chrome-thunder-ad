import './popup.css';
import { MessageType, UserSettings, DEFAULT_SETTINGS, VideoStatus } from '../types';
import { getSettings, saveSettings } from '../utils/storage';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const Popup: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [adStatus, setAdStatus] = useState<VideoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 檢查是否在 YouTube 頁面
  const checkYouTubePage = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url?.includes('youtube.com')) {
        throw new Error('請在 YouTube 頁面使用此擴充功能');
      }
      return tab;
    } catch (error) {
      throw new Error('無法取得目前分頁資訊');
    }
  };

  // 檢查 content script 是否已載入
  const checkContentScript = async (tabId: number, retries = 3): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: MessageType.PING });
        return true;
      } catch (error) {
        if (i === retries - 1) {
          return false;
        }
        // 等待 500ms 後重試
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    return false;
  };

  // 獲取廣告狀態
  const getAdStatus = async (): Promise<VideoStatus> => {
    try {
      // 檢查是否在 YouTube 頁面
      const tab = await checkYouTubePage();
      if (!tab.id) {
        throw new Error('無法取得分頁 ID');
      }

      // 檢查 content script 是否已載入
      const isContentScriptReady = await checkContentScript(tab.id);
      if (!isContentScriptReady) {
        throw new Error('擴充功能尚未準備就緒，請重新整理頁面');
      }

      // 發送獲取廣告狀態的請求
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: MessageType.GET_AD_STATUS,
      });

      if (!response) {
        throw new Error('無法取得廣告狀態');
      }

      return response as VideoStatus;
    } catch (error) {
      throw error;
    }
  };

  // 更新設定
  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings } as UserSettings;
      await saveSettings(updatedSettings);
      setSettings(updatedSettings);
      
      // 發送設定更新訊息到 content script
      const tab = await checkYouTubePage();
      if (tab.id) {
        await chrome.tabs.sendMessage(tab.id, {
          type: MessageType.UPDATE_SETTINGS,
          payload: updatedSettings
        });
      }

      // 更新廣告狀態的播放速度
      if (adStatus) {
        if ('adSpeed' in newSettings) {
          // 不論是否在廣告狀態，都允許更新 adSpeed 設定
          setAdStatus({ 
            ...adStatus, 
            currentSpeed: adStatus.isAd ? newSettings.adSpeed! : adStatus.currentSpeed 
          });
        } else if ('videoSpeed' in newSettings && !adStatus.isAd) {
          setAdStatus({ ...adStatus, currentSpeed: newSettings.videoSpeed! });
        }
      }
    } catch (error) {
      console.error('更新設定時出錯:', error);
      setError(error instanceof Error ? error.message : '更新設定時發生未知錯誤');
    }
  };

  // 重置設定
  const resetSettings = async () => {
    try {
      await updateSettings(DEFAULT_SETTINGS);
    } catch (error) {
      console.error('重置設定時出錯:', error instanceof Error ? error.message : String(error));
      setError('重置設定時出錯');
    }
  };

  // 初始化
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        const savedSettings = await getSettings();
        if (savedSettings) {
          setSettings(savedSettings);
        }
        
        const status = await getAdStatus();
        setAdStatus(status);
        setError(null);
      } catch (error) {
        console.error('初始化時出錯:', error instanceof Error ? error.message : String(error));
        setError(error instanceof Error ? error.message : '初始化時出錯');
        setAdStatus(null);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  if (isLoading) {
    return (
      <div className="popup-container">
        <div className="loading">載入中...</div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      <h1>
        <img src="/icons/icon.svg" alt="閃電廣告圖示" />
        閃電廣告
      </h1>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="status-section">
        <h2>當前狀態</h2>
        {adStatus ? (
          <>
            <p className={adStatus.isAd ? 'ad-playing' : ''}>
              <span>影片狀態</span>
              <span className={`ad-status ${adStatus.isAd ? 'active' : ''}`}>
                {adStatus.isAd ? '正在播放廣告' : 
                 adStatus.isMusic ? '音樂影片' : 
                 '一般影片'}
              </span>
            </p>
            <p>
              <span>當前播放速度</span>
              <span className="speed-value">{adStatus.currentSpeed.toFixed(2)}x</span>
            </p>
          </>
        ) : (
          <p className="no-status">請前往 YouTube 頁面使用</p>
        )}
      </div>

      <div className="settings-section">
        <h2>功能設定</h2>
        <div className="setting-item">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => updateSettings({ enabled: e.target.checked })}
            />
            <span>啟用插件</span>
          </label>
        </div>

        <div className="setting-item">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.autoNormalSpeedForMusic}
              onChange={(e) => updateSettings({ autoNormalSpeedForMusic: e.target.checked })}
              disabled={!settings.enabled}
            />
            <span>音樂影片自動切換速度</span>
          </label>
          <div className="toggle-description">
            當檢測到音樂影片時，自動切換為 1 倍速播放
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>播放速度設定</h2>
        <div className="setting-item">
          <label>廣告播放速度</label>
          <div className="speed-control">
            <input
              type="range"
              min="1"
              max="16"
              step="0.1"
              value={settings.adSpeed}
              onChange={(e) => updateSettings({ adSpeed: parseFloat(e.target.value) })}
              disabled={!settings.enabled}
            />
            <span className="speed-value">{settings.adSpeed.toFixed(2)}x</span>
          </div>
        </div>

        <button 
          onClick={resetSettings}
          disabled={!settings.enabled}
        >
          重置設定
        </button>
      </div>
    </div>
  );
};

// 創建並渲染 React 應用
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
} 