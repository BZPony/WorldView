# 时间分辨率缩放系统

## 整体架构

全局时间分辨率存于 `AppState.state.timeZoomLevel`（默认 `'year'`）。分辨率级别定义在 `TimeConfig.zoomLevels`，数组索引越大精度越高：

```
era → century → decade → year → halfyear → season → month → week → day → hour → minute
```

缩放即沿此数组上下移动索引值。

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
- 时间轴逻辑总宽度（`trackWidth`）随之变化

### 性能问题与浮点精度问题

#### 问题一：DOM 膨胀

month 级别下 `totalTicks = 24,000`，需要创建 24,000 个 DOM 节点并追加到页面。但视口宽度仅约 800px，用户实际可见的刻度约 8 个。其余 23,992 个节点是纯粹的性能浪费。

#### 问题二：浮点精度

缩放级别越高，`trackWidth` 越大（month 达 2,400,000px）。拖动时计算：

```js
const tsDelta = (endTimestamp - startTimestamp) * (-deltaX / trackWidth);
```

`(-deltaX / trackWidth)` 在 2,400,000px 分母下比例极小（~4.17e-7），乘以 1,036,800,000 分钟后精度仍可保证，但表达式本身存在不必要的除法和乘法链，阅读不清晰。

### 解决方案

#### 方案一：预计算换算系数

在 `_generateTicks()` 中，`trackWidth` 和总时间戳差已知时，预计算：

```js
this.config.timestampPerPixel = (endTs - startTs) / trackWidth;
```

拖动时直接用：

```js
const tsDelta = -deltaX * this.config.timestampPerPixel;
```

用一次乘法替代除法和乘法两个操作，语义清晰：「每像素对应多少分钟」。

#### 方案二：基于视口的懒渲染（Virtual Ticks）

`_generateTicks()` 只生成当前视口附近的刻度块，而不是整个时间范围：

```
+--------------------------+   ← container（overflow: hidden）
|   [-3] [-2] [-1] [0] [1] [2] [3] [4] [5] [6] [7]   |   ← 只渲染可见 + buffer
+--------------------------+
```

| 参数 | 说明 |
|------|------|
| `containerWidth / tickWidth` | 可见刻度数（约 8 个） |
| `+ 6` | 前后 buffer（各 3 个） |
| 总计 | **约 14 个 DOM 元素**（固定） |

每当用户拖动时，检查是否需要 shift 刻度块位置。刻度位置通过 `style.left`（而非 `trackWidth` 和内部滚动）排布。

**`_generateTicks()` 新逻辑**：

1. 取当前时间 → `TimeUtils.toTimestamp(currentTime)`
2. 向前后各生成 `halfTicks` 个刻度，每个刻度用绝对定位 `left: i * tickWidth`
3. 刻度 `position: absolute` 放在 track 内，跟随 track 的 `translateX` 自然平移

```js
_generateTicks() {
    const zoomLevel = AppState.get('timeZoomLevel') || 'year';
    const level = TimeConfig.zoomLevels.find(z => z.id === zoomLevel);
    if (!level) return;

    const scale = TimeConfig.getScale();
    const minUnitScale = scale[level.minUnit];
    const tickStepTs = minUnitScale * level.step;

    const { startYear, endYear, tickWidth } = this.config;
    const startTs = TimeUtils.toTimestamp({ year: startYear });
    const endTs = TimeUtils.toTimestamp({ year: endYear });

    // 计算逻辑总宽与换算系数
    const totalTicks = Math.ceil((endTs - startTs) / tickStepTs);
    this.config.trackWidth = totalTicks * tickWidth;
    this.config.timestampPerPixel = (endTs - startTs) / this.config.trackWidth;

    this.track.style.width = this.config.trackWidth + 'px';

    // 懒渲染：只生成当前视口附近的刻度
    this._renderVisibleTicks(tickStepTs, zoomLevel);
}
```

**`_renderVisibleTicks()` 新方法**：

```js
_renderVisibleTicks(tickStepTs, zoomLevel) {
    this.track.innerHTML = '';

    const tickWidth = this.config.tickWidth;
    const containerWidth = this.container.clientWidth;
    const visibleCount = Math.ceil(containerWidth / tickWidth) + 6; // 可见 + buffer

    const centerTs = TimeUtils.toTimestamp(AppState.get('currentTime'));
    const tickIndexCenter = Math.round((centerTs - TimeUtils.toTimestamp({ year: this.config.startYear })) / tickStepTs);
    const tickIndexStart = tickIndexCenter - Math.floor(visibleCount / 2);

    for (let i = 0; i < visibleCount; i++) {
        const globalIndex = tickIndexStart + i;
        const tickTs = TimeUtils.toTimestamp({ year: this.config.startYear }) + globalIndex * tickStepTs;
        const tickTime = TimeUtils.timestampToTime(tickTs);
        const label = TimeUtils.format(tickTime, zoomLevel);
        const tick = document.createElement('div');
        tick.className = 'timeline-tick';
        tick.textContent = label;
        // 绝对定位：每个刻度占据 tickWidth px
        tick.style.position = 'absolute';
        tick.style.left = (globalIndex * tickWidth) + 'px';
        this.track.appendChild(tick);
    }
}
```

**当用户拖动时间轴时**，检查是否需要 shift 刻度块（例如每移动 `tickWidth * 2` 个像素就重新生成一次）：

```js
// 在 render() 最后调用
_checkTickShift(time) {
    // 当前视口中心对应的时间戳与上次生成时的中心差超过阈值 → 重新生成
    const shiftThreshold = this.config.tickWidth * 2;
    // ...
    // 需要时调用 _regenerateTicks()
}
```

**`timeToOffset()` / `offsetToTime()` 无需修改**——内部仍用 `trackWidth`（逻辑总宽）和 `timestampPerPixel` 计算。

### 受影响的方法清单

| 方法 | 改动 |
|------|------|
| `_generateTicks()` | 计算 `timestampPerPixel` + 调用 `_renderVisibleTicks` |
| `_renderVisibleTicks(tickStepTs, zoomLevel)` | **新增**：基于视口生成 ~14 个刻度 |
| `_regenerateTicks()` | 不变（内部调 `_generateTicks()`） |
| `_onMouseMove()` | 用 `timestampPerPixel` 替代 `(endTs - startTs) / trackWidth` |
| `timeToOffset()` | 不变 |
| `offsetToTime()` | 不变 |
| `render()` | DOM 结构不变（track 用 translateX 平移） |
| CSS | `.timeline-tick` 已有 `position: flex`，需要改为 `position: absolute` + `left` 定位 |

### 性能对比

| 级别 | 改前 DOM 数 | 改后 DOM 数 |
|------|-----------|-----------|
| era | 20 | ~14 |
| year | 2,000 | ~14 |
| month | 24,000 | ~14 |
| day | ~720,000 | ~14 |

DOM 节点数从随精度膨胀变为恒定 ~14 个。浮点精度通过预计算的 `timestampPerPixel` 简化算术链。

---

## 第三步：waypoint 根据全局分辨率判断可见性

设计待定，由用户后续补充。

---

## 实施步骤（第二步性能优化）

1. `timeline.js` — 重写 `_generateTicks()`，预计算 `timestampPerPixel`
2. `timeline.js` — 新增 `_renderVisibleTicks()`，只渲染视口附近刻度
3. `timeline.js` — `_onMouseMove()` 用 `timestampPerPixel` 替代双重运算
4. `css/timeline.css` — `.timeline-tick` 改为 `position: absolute`
5. 验证：month 级别下 DOM 数不超过 20