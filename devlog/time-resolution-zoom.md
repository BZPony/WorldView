# 时间分辨率缩放系统

## 整体架构

全局时间分辨率存于 `AppState.state.timeZoomLevel`（默认 `'year'`）。分辨率级别定义在 `TimeConfig.zoomLevels`，数组索引越大精度越高：

```
era → century → decade → year → halfyear → season → month → week → day → hour → minute
```

缩放即沿此数组上下移动索引值。

---

## 第一步：缩放按钮 ✅

**已完成。**

---

## 第二步：时间轴刻度随分辨率缩放 ✅

**已完成（含虚拟滚动性能优化）。**

---

## 第三步：Waypoint 根据全局分辨率判断可见性

### 需求

- 每个 waypoint 有 `resolution` 属性（如 `'year'`、`'month'`、`'day'`）
- 仅当 `waypoint.resolution` 的精度 **≥** 全局 `timeZoomLevel` 的精度时，该 waypoint 才在地图上显示
- 全局分辨率越高（越往右），能显示的 waypoint 越少（仅高精度 waypoint 可见）
- 全局分辨率越低（越往左），显示的 waypoint 越多（低精度 waypoint 也可见）

### 判断规则

修改现有 `TimeUtils.isVisible`：

```js
isVisible(resolution, currentZoomLevel) {
    const resIdx = TimeConfig.getZoomIndex(resolution);      // waypoint 精度索引
    const zoomIdx = TimeConfig.getZoomIndex(currentZoomLevel); // 全局精度索引
    if (resIdx === -1 || zoomIdx === -1) return true; // 未知级别默认显示
    return zoomIdx >= resIdx;  // 全局精度 ≥ waypoint 精度 → 显示
}
```

**规则**：全局分辨率精度 ≥ waypoint 分辨率精度时显示。Zoom In → 全局精度提高 → 更多 waypoint 满足条件 → 更多显示。

### 示例

| 全局 zoomLevel | waypoint resolution | 是否显示 | 原因 |
|---------------|---------------------|---------|------|
| `day` (idx=8) | `year` (idx=3) | ✅ | zoomIdx(8) ≥ resIdx(3)，全局精度覆盖 waypoint |
| `day` (idx=8) | `day` (idx=8) | ✅ | 精度匹配 |
| `day` (idx=8) | `hour` (idx=9) | ❌ | zoomIdx(8) < resIdx(9)，waypoint 精度高于全局精度，不显示 |
| `year` (idx=3) | `month` (idx=6) | ❌ | zoomIdx(3) < resIdx(6)，waypoint 精度高于全局精度，不显示 |
| `year` (idx=3) | `era` (idx=0) | ✅ | zoomIdx(3) ≥ resIdx(0)，全局精度覆盖 waypoint |

### 触发时机

缩放按钮 → `AppState.set('timeZoomLevel', newId)` → 需要触发 MapView 重新渲染。

当前 MapView 仅监听 `currentTime`、`entities`、`selectedItem`，不监听 `timeZoomLevel`。

### 需要修改的文件

#### 1. `js/components/view/map.js` — 添加 `timeZoomLevel` 监听

在 `init()` 中新增：

```js
EventBus.on('state:change', (data) => {
    if (data.key === 'timeZoomLevel') this.renderTimelineEntities();
});
```

#### 2. `js/components/view/map.js` — `renderTimelineEntities()` 中过滤 waypoint

在 `_renderWaypointMarkers` 和 `_renderSegments` 中，对每个 waypoint 检查可见性。

**途径点 marker 过滤**（`_renderWaypointMarkers`）：

```js
waypoints.forEach((wp, idx) => {
    // 分辨率过滤：全局精度 < waypoint 精度时跳过，不渲染 marker
    const zoomLevel = AppState.get('timeZoomLevel') || 'year';
    if (!TimeUtils.isVisible(wp.resolution || 'year', zoomLevel)) return;
    // ... 原有逻辑
});
```

**轨迹线段**（`_renderSegments`）：不受分辨率影响，始终显示完整轨迹。

---

### 实施步骤

1. `map.js` `init()` — 添加 `timeZoomLevel` 状态变化监听，触发 `renderTimelineEntities()`
2. `map.js` `_renderWaypointMarkers()` — 在遍历 waypoints 时，添加分辨率可见性检查（`TimeUtils.isVisible`），不可见则跳过 marker 渲染
3. ~~`_renderSegments()` 不修改~~（轨迹始终显示）
4. `time.js` — 修改 `TimeUtils.isVisible`，将 `resIdx >= zoomIdx` 改为 `zoomIdx >= resIdx`
