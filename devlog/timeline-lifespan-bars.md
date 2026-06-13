# Timeline 实体生命条设计文档

## 问题

时间轴拖动时，用户无法直观看到未显示人物的活动时间区间，不知道应该向前还是向后拖动时间轴。

## 方案概述

1. **时间轴生命条**：轨道刻度上方绘制彩色横条，每个条表示一个实体的活跃时间区间
2. **Thumbtack（图钉）按钮**：在一级面板关闭和删除按钮之间，切换实体是否固定到时间轴上

---

## 第一部分：时间轴生命条

### 数据结构

**TimeSpan**（`{ start, end, birthTime?, deathTime? }`）包含四个关键时间点：

```js
function getLifespan(entity) {
    const person = entity.components.person;
    const motion = entity.components.motion;
    const waypoints = motion ? motion.waypoints : [];
    const birthTime = person ? person.birthTime : null;
    const deathTime = person ? person.deathTime : null;

    // 取 min(birthTime, firstWaypointArrival)
    let start = birthTime;
    if (waypoints.length > 0) {
        const firstArrival = waypoints[0].time.arrival || waypoints[0].time.departure || waypoints[0].time;
        if (firstArrival && (!start || TimeUtils.compare(firstArrival, start) < 0)) {
            start = firstArrival;
        }
    }

    // 取 max(deathTime, lastWaypointDeparture)
    let end = deathTime;
    if (waypoints.length > 0) {
        const lastDeparture = waypoints[waypoints.length - 1].time.departure
            || waypoints[waypoints.length - 1].time.arrival
            || waypoints[waypoints.length - 1].time;
        if (lastDeparture && (!end || TimeUtils.compare(lastDeparture, end) > 0)) {
            end = lastDeparture;
        }
    }

    if (!start && !end) return null;
    if (!start && end) start = end;
    if (!end && start) end = start;
    return { start, end, birthTime: person ? person.birthTime : null, deathTime: person ? person.deathTime : null };
}
```

### 视觉效果

- **横条颜色**：与 `entity.components.core.color` 一致

| 实体类型 | 渲染方式 |
|----------|---------|
| 有 `person` 组件且 `birthTime` / `deathTime` 都存在且 `birthTime ≠ deathTime` | start~birthTime 虚线 → baby 图标 → birthTime~deathTime 实线 → skull 图标 → deathTime~end 虚线 |
| 有 `person` 组件但缺少 `birthTime` 或 `deathTime`，或 `birthTime = deathTime` | **整段实线**，无图标 |
| **无 `person` 组件，有 `motion` 组件** | **整段实线**，无图标 |

- **出生点**：小圆形图标，内部 SVG 为 `baby`，仅当 `birthTime` 存在且 `birthTime ≠ deathTime` 时显示
- **死亡点**：小圆形图标，内部 SVG 为 `skull`，仅当 `deathTime` 存在且 `birthTime ≠ deathTime` 时显示

### 显示优先级与渲染顺序

| 位置 | 显示内容 |
|------|---------|
| 第 1 行 | 当前选中实体（`selectedItem`），仅当有 motion 或 person 组件时显示。若选中实体不满足条件，此行留空，后续行顺延占据 |
| 第 2~N 行 | 被 Thumbtack 固定的实体，**按 `pinnedEntities` 数组中元素的出现顺序排列**。先固定的实体在前，后固定的在后 |

- **去重规则**：若 selectedItem 也在 pinnedEntities 中，只在第一行显示一次，pinnedEntities 中对应的实体会被跳过
- 每行高度 4px，行间距 2px，总共约 30px 区域可容纳 ~5 行
- 用户取消固定（再次点击 Thumbtack）时，从 `pinnedEntities` 中移除该 ID；被移除后下一行实体自动上移
- 用户重新固定一个已存在的实体时，该 ID 不会被重复添加（检查去重）

### 虚线 / 实线规则汇总

- 有 `person` 组件且 `birthTime ≠ deathTime`：birthTime~deathTime 实线，两端虚线
- 无 `person` 组件（仅有 motion）：整段实线，无图标
- 有 `person` 但缺少 birthTime 或 deathTime：整段实线，无图标
- 有 `person` 但 birthTime = deathTime：整段实线，无图标

### 渲染方式

在 `.timeline-track` 内部，刻度元素上方，插入一个容器层 `.timeline-lifespan-layer`，绝对定位覆盖轨道上部：

```html
<div class="timeline-track" id="timeline-track">
    <div class="timeline-lifespan-layer"></div>
    <div class="timeline-tick">...</div>
    ...
</div>
```

### `_renderLifespanBars()` 逻辑

```js
_renderLifespanBars() {
    const layer = this.track.querySelector('.timeline-lifespan-layer');
    if (!layer) return;
    layer.innerHTML = '';

    const entities = AppState.get('entities') || [];
    const selectedItem = AppState.get('selectedItem');
    const pinnedIds = AppState.get('pinnedEntities') || [];
    const trackWidth = this.config.trackWidth;
    const startTs = this.config.startTimestamp;
    const totalTs = this.config.endTimestamp - startTs;

    const toPx = (time) => {
        const ts = TimeUtils.toTimestamp(time);
        return ((ts - startTs) / totalTs) * trackWidth;
    };

    // 收集需要显示的实体（去重）
    const toShow = [];
    if (selectedItem && (selectedItem.data.components.motion || selectedItem.data.components.person)) {
        toShow.push(selectedItem.data);
    }
    for (const eid of pinnedIds) {
        const entity = entities.find(e => e.id === eid);
        if (entity && !toShow.includes(entity)) {
            toShow.push(entity);
        }
    }

    toShow.forEach((entity, rowIndex) => {
        const span = getLifespan(entity);
        if (!span || !span.start || !span.end) return;
        const top = rowIndex * 6;
        const color = entity.components.core.color || '#888';

        const hasPerson = !!span.birthTime && !!span.deathTime && TimeUtils.compare(span.birthTime, span.deathTime) !== 0;

        if (hasPerson) {
            // 出生前虚线
            if (TimeUtils.compare(span.start, span.birthTime) < 0) {
                const left = toPx(span.start);
                const width = toPx(span.birthTime) - left;
                appendBar(layer, left, width, top, color, true);
            }
            // 出生点图标
            appendIcon(layer, toPx(span.birthTime), top, 'baby', color);
            // 出生~死亡实线
            const left = toPx(span.birthTime);
            const width = toPx(span.deathTime) - left;
            if (width > 0) appendBar(layer, left, width, top, color, false);
            // 死亡点图标
            appendIcon(layer, toPx(span.deathTime), top, 'skull', color);
            // 死亡后虚线
            if (TimeUtils.compare(span.deathTime, span.end) < 0) {
                const dLeft = toPx(span.deathTime);
                const dWidth = toPx(span.end) - dLeft;
                appendBar(layer, dLeft, dWidth, top, color, true);
            }
        } else {
            // 无 person 或 birthTime/deathTime 缺失：整段实线
            appendBar(layer, toPx(span.start), toPx(span.end) - toPx(span.start), top, color, false);
        }
    });
}
```

### 坐标计算

生命条使用时间戳计算像素位置：

```js
const toPx = (time) => {
    const ts = TimeUtils.toTimestamp(time);
    return ((ts - startTs) / totalTs) * trackWidth;
};
```

### State 新增

```js
// AppState.state
pinnedEntities: []   // 被图钉固定的实体 ID 列表（String[]）
```

### 样式（timeline.css）

```css
.timeline-lifespan-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 36px;
    pointer-events: none;
    z-index: 2;
}

.timeline-lifespan-bar {
    position: absolute;
    height: 4px;
    border-radius: 2px;
    opacity: 0.75;
}

.timeline-lifespan-bar--dashed {
    opacity: 0.4;
    background: repeating-linear-gradient(
        to right,
        transparent,
        transparent 3px,
        currentColor 3px,
        currentColor 6px
    ) !important;
}

.timeline-lifespan-icon {
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 3;
}
```

### 需要修改的 Timeline 方法

| 方法 | 改动 |
|------|------|
| `Timeline.init()` | 创建 `.timeline-lifespan-layer` 容器 |
| `Timeline._generateTicks()` | 末尾调用 `_renderLifespanBars()` |
| `Timeline._regenerateTicks()` | 不变（内部已调 `_generateTicks()`） |
| `Timeline._renderLifespanBars()` | **新增** |

---

## 第二部分：Thumbtack 按钮

### 位置

DetailPanel `.detail-header` 中，关闭按钮和删除按钮之间：

```
[× 关闭]  [📌 固定]  [🗑 删除]
```

纵向排列顺序：关闭按钮(top:10px) → Thumbtack(top:48px) → 删除按钮(top:86px)

### State

使用 `AppState.state.pinnedEntities`（String[]）。

### 交互

- 按钮点击 → toggle 当前选中实体的 ID 在 `pinnedEntities` 中的存在
- 非激活状态：背景色 `rgba(25,25,25,0.75)`，svg 颜色 `white`（与关闭按钮一致）
- 激活状态：背景色 `rgba(50,120,230,0.75)`，边框蓝色

### 样式（detail.css）

```css
.detail-toggle-btn--thumbtack {
    position: absolute;
    top: 48px;
    right: 10px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: rgba(25, 25, 25, 0.75);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    z-index: 1001;
    transition: all var(--animation-duration) ease;
}

.detail-toggle-btn--thumbtack:hover {
    background-color: rgba(100, 100, 100, 0.8);
    transform: scale(1.1);
}

.detail-toggle-btn--thumbtack.active {
    background-color: rgba(50, 120, 230, 0.75);
    border: 1px solid rgba(80, 150, 255, 0.5);
}
```

同时将删除按钮 `top` 从 `48px` 调整为 `86px`。

---

## 需要修改的文件

### 第一部分（生命条）

| 文件 | 改动 |
|------|------|
| `js/core/state.js` | 新增 `pinnedEntities: []` |
| `css/timeline.css` | 新增 `.timeline-lifespan-layer` / `-bar` / `-bar--dashed` / `-icon` |
| `js/components/view/timeline.js` | 生命条容器 + `_renderLifespanBars()` + `appendBar()` / `appendIcon()` 辅助函数 |

### 第二部分（Thumbtack 按钮）

| 文件 | 改动 |
|------|------|
| `myMap.html` | Thumbtack 按钮 HTML |
| `css/detail.css` | 新增 `.detail-toggle-btn--thumbtack` + 删除按钮 top 调整 |
| `js/components/view/detail.js` | 绑定 Thumbtack 点击 + 视觉更新 |

## 全部实施步骤

1. `state.js` — 新增 `pinnedEntities` 状态
2. `myMap.html` — 添加 Thumbtack 按钮（已存在于 HTML 中）
3. `css/detail.css` — Thumbtack + 删除按钮 top 调整
4. `detail.js` — 绑定事件 + 状态更新
5. `css/timeline.css` — 生命条样式
6. `timeline.js` — 生命条容器创建 + 渲染逻辑实现
