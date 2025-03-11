/**
 * 此腳本用於生成 PNG 格式的圖標
 * 需要安裝 sharp 套件: npm install sharp
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const sizes = [16, 48, 128];
const svgPath = path.join(__dirname, "../public/icons/icon.svg");
const outputDir = path.join(__dirname, "../public/icons");

// 確保輸出目錄存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 為每個尺寸生成 PNG 圖標
async function generateIcons() {
  try {
    for (const size of sizes) {
      const outputPath = path.join(outputDir, `icon${size}.png`);

      await sharp(svgPath).resize(size, size).png().toFile(outputPath);

      console.log(`已生成 ${size}x${size} 圖標: ${outputPath}`);
    }

    console.log("所有圖標已生成完成！");
  } catch (error) {
    console.error("生成圖標時出錯:", error);
  }
}

generateIcons();
