# Timeline 时间精度提升设计文档

## 前置任务：时间偏移量概念重命名

`TimeUtils` 和 `Timeline` 使用了相同名称但不同含义的 "offset" 概念：

| 位置 | 原名称 | 含义 |
|------|--------|------|
| `TimeUtils.toOffset()` | offset | 时间换算为距纪元起点的分钟数（`timestamp`） |
| `TimeUtils.offsetToTime()` | offset | 分钟数反算为时间对象 |
| `Timeline.offsetToTime()` | offset | 时间轴像素偏移量转换为时间对象 |

为避免混淆，将 `TimeUtils` 中的方法重命名为更语义化的名称：

| 原名称 | 新名称 | 含义 |
|--------|--------|------|
| `TimeUtils.toOffset(t)` | `TimeUtils.toTimestamp(t)` | 时间对象 → 时间戳（分钟） |
| `TimeUtils.offsetToTime(n)` | `TimeUtils.timestampToTime(n)` | 时间戳 → 时间对象 |
| 内部变量名 `*Off` / `*Offset` | `*Ts` / `*Timestamp` | 全局变量采用新命名 |

**改动范围**：`time.js`（API 定义） + `map.js`（6 处调用）+ `detail.js`（4 处调用）+ `timeConfig.js`（1 处注释）

---

## Timeline 精度问题

Timeline 拖动时 UI 有明显卡顿，根源是 `Timeline.offsetToTime()` 中：

```js
const year = startYear + ratio * (endYear - startYear);
return { year: Math.round(year) };
```

- 一个像素对应多个年份（`2000 years / 5000px = 0.4 years/px ≈ 4.8 months/px`），但 `Math.round()` 丢弃所有小数
- 多次拖动可能产生相同 `year` 值，地图和图标不渲染变化
- 新的 `TimeUtils.toTimestamp` / `timestampToTime` 已支持分钟级精度，timeline 完全未使用
- **全局 `timeZoomLevel` 不影响 timeline 计算精度** — timeline 始终使用分钟级时间戳以确保平滑过渡

## 解决方案

Timeline 改用时间戳作为内部计算基准，像素和时间戳为线性关系。

### 核心公式

```
timeline_ratio = pixel_offset / trackWidth
timestamp = startTimestamp + timeline_ratio * (endTimestamp - startTimestamp)
time_object = TimeUtils.timestampToTime(timestamp)
```

- **startTimestamp** = `TimeUtils.toTimestamp({ year: startYear })`
- **endTimestamp** = `TimeUtils.toTimestamp({ year: endYear })`
- **trackWidth** 不变

每一步都精确到分钟级时间戳。

### 改造内容

仅修改 `js/components/view/timeline.js`：

| 方法 | 改动 |
|------|------|
| `init` | 新增 `startTimestamp` / `endTimestamp` |
| `timeToOffset(time)` | `TimeUtils.toTimestamp(time)` 替代 `time.year` |
| `offsetToTime(offsetX)` | `TimeUtils.timestampToTime(Math.round(ts))` 替代 `Math.round(year)` |
| `_onMouseMove` | 拖动使用时间戳计算，保留完整精度 |

---

## 精度对比

| | 改进前 | 改进后 |
|---|---|---|
| 拖动精度 | +/- 1 year（卡顿） | +/- 1 minute（流畅） |
| 像素→时间 | `Math.round(year)` | `TimeUtils.timestampToTime(ts)` |
| 时间→像素 | `(year - startYear) / range` | `(timestamp - startTs) / (endTs - startTs)` |