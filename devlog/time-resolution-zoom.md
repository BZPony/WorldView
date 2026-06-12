# 时间分辨率缩放系统

## 整体架构

全局时间分辨率存于 `AppState.state.timeZoomLevel`（默认 `'year'`）。分辨率级别定义在 `TimeConfig.zoomLevels`，数组索引越大精度越高：

```
era → century → decade → year → halfyear → season → month → week → day → hour → minute
```

---

## 第一步：缩放按钮 ✅

时间轴右侧两个垂直排列的按钮（放大/缩小），沿 zoomLevels 上下移动索引，到达边界时置灰。

**已完成。**

---

## 第二步：时间轴刻度随分辨率缩放

### 需求

- 缩放不改变当前时间（`AppState.currentTime` 不变）
- 每个刻度的像素宽度不变（`tickWidth = 100px`）
- 每个刻度表示的时间单位根据当前 `timeZoomLevel` 变化
- 时间轴的像素总宽度随之变化

### 核心概念

每个 `TimeConfig.zoomLevels[i]` 包含：

```
{ id: 'year',   label: '年', minUnit: 'year',  step: 1  }   // 刻度 = 1 年
{ id: 'month',  label: '月', minUnit: 'month', step: 1  }   // 刻度 = 1 月
{ id: 'week',   label: '周', minUnit: 'day',   step: 7  }   // 刻度 = 7 天
```

一个刻度的实际时间跨度 = `step × minUnit`（通过 `TimeUtils.getResolutionStep(zoomLevel)` 可拿到 minUnit 偏移量）。

### 缩放示例

| 级别 | 每个刻度 | tickStep（年份等效） | 总刻度数（-1000~1000） | 轨道总宽 |
|------|---------|---------------------|----------------------|---------|
| era | 100 年 | 100 | 20 | 2,000px |
| decade | 5 年 | 5 | 400 | 40,000px |
| year | 1 年 | 1 | 2,000 | 200,000px |
| month | 1 月 | 1/12 | 24,000 | 2,400,000px |

### 需要修改的方法

#### `Timeline.init()` — 新增初始化逻辑

不再硬编码 `tickStep`。`startYear` 和 `endYear` 作为固定的时间边界，刻度数量和 step 由 zoomLevel 动态计算：

```js
// 移除 this.config.tickStep （不再从固定配置读取）
// 保留 this.config.startYear / endYear / tickWidth（像素宽度不变）
// 新增 this.config.tickStep 由 _generateTicks 动态设置
```

#### `Timeline._generateTicks()` — 完全重写

每次缩放时重新生成刻度 DOM 元素：

```js
_generateTicks() {
    const zoomLevel = AppState.get('timeZoomLevel') || 'year';
    const level = TimeConfig.zoomLevels.find(z => z.id === zoomLevel);
    if (!level) return;
    
    const scale = TimeConfig.getScale();
    const minUnitScale = scale[level.minUnit];  // 1 hour = 60 minutes
    const tickStepTs = minUnitScale * level.step;  // 一个刻度的分钟数
    
    const { startYear, endYear, tickWidth } = this.config;
    const startTs = TimeUtils.toTimestamp({ year: startYear });
    const endTs = TimeUtils.toTimestamp({ year: endYear });
    
    const totalTicks = Math.ceil((endTs - startTs) / tickStepTs);
    this.config.trackWidth = totalTicks * tickWidth;
    
    this.track.innerHTML = '';
    this.track.style.width = this.config.trackWidth + 'px';
    
    for (let i = 0; i < totalTicks; i++) {
        const tickTs = startTs + i * tickStepTs;
        const tickTime = TimeUtils.timestampToTime(tickTs);
        const label = TimeUtils.format(tickTime, zoomLevel);
        const tick = document.createElement('div');
        tick.className = 'timeline-tick';
        tick.textContent = label;
        this.track.appendChild(tick);
    }
}
```

#### `Timeline.timeToOffset()` / `offsetToTime()` — 无需修改

这两个方法已经基于 `startTimestamp` / `endTimestamp` 和 `trackWidth` 计算，当 `trackWidth` 改变时自动适应。

#### 缩放按钮回调 — 添加 `_generateTicks()` + `render()` 调用

```js
_zoomIn() {
    // ... 设置 timeZoomLevel
    this._regenerateTicks();
}

_zoomOut() {
    // ... 设置 timeZoomLevel
    this._regenerateTicks();
}

_regenerateTicks() {
    this._generateTicks();
    this._updateZoomButtons();
    const currentTime = AppState.get('currentTime');
    this.render(currentTime);
}
```

### 不变的内容

- `startYear: -1000`、`endYear: 1000` — 时间边界固定
- `tickWidth: 100px` — 每个刻度像素宽度固定
- `startTimestamp` / `endTimestamp` — 固定，仅在 init 时计算一次
- `currentTime` — 缩放不改变当前时间
- `render(time)` — 逻辑不变，根据新的 `trackWidth` 重新计算像素位置

### CSS 影响

Timeline 容器 `overflow: hidden`，超高精度（month/day）下轨道宽度会远超视口，用户通过拖动自然浏览不同时间区间。现有 CSS 无需修改。

---

## 第三步：waypoint 根据全局分辨率判断可见性

设计待定，由用户后续补充。

---

## 实施步骤（仅第二步）

1. `timeline.js` — 重写 `_generateTicks()`，根据 `timeZoomLevel` 动态生成刻度
2. `timeline.js` — 缩放按钮回调中添加 `_regenerateTicks()` 调用
3. 验证：切换缩放级别后刻度变化、当前时间位置不变