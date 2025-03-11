// 用戶設定的介面定義
export interface UserSettings {
  // 廣告播放速度
  adSpeed: number;
  // 影片播放速度
  videoSpeed: number;
  // 是否啟用擴充功能控制
  enabled: boolean;
}

// 預設設定
export const DEFAULT_SETTINGS: UserSettings = {
  adSpeed: 16.0,
  videoSpeed: 1.0,
  enabled: true
};

// 消息類型定義
export enum MessageType {
  GET_SETTINGS = 'GET_SETTINGS',
  UPDATE_SETTINGS = 'UPDATE_SETTINGS',
  AD_STATUS_CHANGED = 'AD_STATUS_CHANGED',
  GET_AD_STATUS = 'GET_AD_STATUS'
}

// 消息介面定義
export interface Message {
  type: MessageType;
  payload?: any;
}

// 廣告狀態介面
export interface AdStatus {
  isAd: boolean;
  currentSpeed: number;
} 