# 閃電廣告 Thunder Ad

閃電廣告是一個 Chrome 擴充功能，能夠自動偵測 YouTube 廣告並調整其播放速度，同時保持一般影片的播放速度不受影響，提升用戶觀看 YouTube 的體驗。

## 功能特色

- 自動偵測 YouTube 廣告
- 為廣告和一般影片分別設定不同的播放速度
- 在廣告結束後自動恢復到用戶設定的影片播放速度
- 支援用戶手動調整廣告和影片的播放速度
- 提供快速選擇常用播放速度的按鈕
- 可隨時啟用或停用擴充功能控制

## 安裝方法

### 從 Chrome 線上應用程式商店安裝

1. 前往 Chrome 線上應用程式商店（尚未發布）
2. 點擊「加到 Chrome」按鈕
3. 確認安裝

### 手動安裝（開發者模式）

1. 下載並解壓縮此專案
2. 執行 `npm install` 安裝依賴
3. 執行 `npm run build` 建置專案
4. 在 Chrome 瀏覽器中，前往 `chrome://extensions/`
5. 開啟右上角的「開發人員模式」
6. 點擊「載入未封裝項目」
7. 選擇專案中的 `dist` 資料夾

## 使用方法

1. 安裝擴充功能後，前往 YouTube 網站
2. 當廣告出現時，擴充功能會自動將廣告播放速度調整為設定值
3. 廣告結束後，播放速度會自動恢復為一般影片的設定值
4. 點擊擴充功能圖標可開啟設定面板，調整廣告和影片的播放速度

## 預設設定

- 廣告播放速度：16.0x
- 影片播放速度：1.0x
- 擴充功能控制：啟用

## 開發

### 安裝依賴

```bash
npm install
```

### 開發模式

```bash
npm run dev
```

### 建置專案

```bash
npm run build
```

### 生成圖標

專案使用 SVG 格式的圖標，需要轉換為 PNG 格式才能在 Chrome 擴充功能中使用。

```bash
# 安裝 sharp 套件（如果尚未安裝）
npm install sharp

# 生成圖標
npm run generate-icons
```

## 技術棧

- TypeScript
- Chrome Extension API
- Webpack
- HTML/CSS

## 授權

MIT
