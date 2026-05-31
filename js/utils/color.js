/**
 * 调整颜色的亮度与饱和度
 * @param {string} hexColor - 十六进制颜色（如 "#ff4d4f" 或 "#f00"）
 * @param {number} [lightnessDelta=0]   - 亮度调整量，范围 -1 到 1（0 不变，正数变亮，负数变暗）
 * @param {number} [saturationDelta=0]  - 饱和度调整量，范围 -1 到 1（0 不变，正数更鲜艳，负数更灰）
 * @returns {string} hsl() 或 rgb() 字符串，根据输入自动选择
 */
function adjustColor(hexColor, lightnessDelta = 0, saturationDelta = 0) {
    // 去掉 # 并转为 RGB
    let r, g, b;
    const hex = hexColor.replace('#', '');
    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16) / 255;
        g = parseInt(hex[1] + hex[1], 16) / 255;
        b = parseInt(hex[2] + hex[2], 16) / 255;
    } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16) / 255;
        g = parseInt(hex.substring(2, 4), 16) / 255;
        b = parseInt(hex.substring(4, 6), 16) / 255;
    } else {
        return hexColor; // 无法解析时返回原值
    }

    // RGB → HSL
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    // 调整饱和度与亮度，并钳位在 0~1
    s = Math.min(1, Math.max(0, s + saturationDelta));
    l = Math.min(1, Math.max(0, l + lightnessDelta));

    // HSL → RGB（若饱和度为 0 可直接返回灰度）
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    const to255 = (c) => Math.round(c * 255);
    return `rgb(${to255(r)},${to255(g)},${to255(b)})`;
}