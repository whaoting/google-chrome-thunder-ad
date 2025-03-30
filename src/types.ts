// 用戶設定的介面定義
export interface UserSettings {
  // 廣告播放速度
  adSpeed: number;
  // 影片播放速度
  videoSpeed: number;
  // 是否啟用擴充功能控制
  enabled: boolean;
  // 是否自動將音樂影片速度調整為正常速度
  autoNormalSpeedForMusic: boolean;
}

// 預設設定
export const DEFAULT_SETTINGS: UserSettings = {
  adSpeed: 16.0,
  videoSpeed: 1.0,
  enabled: true,
  autoNormalSpeedForMusic: true
};

// 消息類型定義
export enum MessageType {
  GET_SETTINGS = 'GET_SETTINGS',
  UPDATE_SETTINGS = 'UPDATE_SETTINGS',
  GET_AD_STATUS = 'GET_AD_STATUS',
  AD_STATUS_CHANGED = 'AD_STATUS_CHANGED',
  PING = 'PING',
}

// 消息介面定義
export interface Message {
  type: MessageType;
  payload?: any;
}

// 影片狀態介面
export interface VideoStatus {
  // 是否為廣告
  isAd: boolean;
  // 是否為音樂影片
  isMusic: boolean;
  // 當前播放速度
  currentSpeed: number;
} 