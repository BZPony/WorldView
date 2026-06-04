# 时间系统重构设计

> 创建日期：2026-06-03
> 状态：规划阶段（尚未实现）

---

## 一、背景与动机

当前系统使用**整数**表示年份作为唯一的时间单位，存在以下问题：

1. **分辨率不足** — 无法精确表示人物在一年/一天内的行动轨迹
2. **跨分辨率混合** — 不同精度的途径点（年/月/日/分）混在一起，无法区分
3. **缩放过滤** — 未来时间轴缩放功能需要按精度过滤途径点，当前无法实现
4. **自定义纪元** — 世界观创作中一年可能有18个月、一月可能有40天，当前无法适配

---

## 二、核心设计

### 2.1 时间对象（统一所有 time 字段）

```javascript
// 时间点（统一格式）
{
    year: 500,
    month: 6,       // 可选，默认为当年第一个月
    day: 15,        // 可选
    hour: 14,       // 可选
    minute: 30,     // 可选
    second: 0       // 可选（极少用到）
}
```

所有 `time` 字段统一改用此对象结构：

- `entities.js` — `birthTime`、`deathTime`、`waypoint.time`
- `state.js` — `currentTime`

### 2.2 全局时间换算配置（TimeConfig）

独立配置文件，用户可自定义：

```javascript
// js/data/timeConfig.js
const TimeConfig = {
    // 纪元起点（所有时间偏移量基于此计算）
    epoch: { year: 0, month: 1, day: 1, hour: 0, minute: 0, second: 0 },

    // === 用户可自定义的换算规则 ===
    yearMonths: 12,     // 一年 12 个月（可改为 18）
    monthDays: 30,      // 一个月 30 天（可改为 40 或 60）
    dayHours: 24,
    hourMinutes: 60,
    minuteSeconds: 60,

    // === 精度设置 ===
    minUnit: 'minute',  // 最小精度单位，建议 minute
                        // 秒级精度极少用到，用 minute 可大幅降低溢出风险

    // === 轨迹显示窗口 ===
    trackWindow: {
        enabled: true,      // 是否启用
        value: 200,         // 显示过去数
        unit: 'year'        // 单位（也可配 month、day）
    },

    // === 分辨率(缩放)级别定义 ===
    zoomLevels: [
        { id: 'era',     label: '纪元',  minUnit: 'year', step: 100 },
        { id: 'century', label: '世纪',  minUnit: 'year', step: 25 },
        { id: 'decade',  label: '年代',  minUnit: 'year', step: 5 },
        { id: 'year',    label: '年',    minUnit: 'year', step: 1 },
        { id: 'halfyear',label: '半年',  minUnit: 'month',step: 6 },
        { id: 'season',  label: '季度',  minUnit: 'month',step: 3 },
        { id: 'month',   label: '月',    minUnit: 'month',step: 1 },
        { id: 'week',    label: '周',    minUnit: 'day',   step: 7 },
        { id: 'day',     label: '日',    minUnit: 'day',   step: 1 },
        { id: 'hour',    label: '时',    minUnit: 'hour',  step: 1 },
        { id: 'minute',  label: '分',    minUnit: 'minute',step: 1 },
    ],

    // 根据 minUnit 返回每级单位的缩放系数（用于 toOffset 换算）
    getScale() {
        switch (this.minUnit) {
            case 'minute': return {
                year:   this.yearMonths * this.monthDays * this.dayHours * this.hourMinutes,
                month:  this.monthDays * this.dayHours * this.hourMinutes,
                day:    this.dayHours * this.hourMinutes,
                hour:   this.hourMinutes,
                minute: 1
            };
            case 'second': return {
                year:   this.yearMonths * this.monthDays * this.dayHours * this.hourMinutes * this.minuteSeconds,
                month:  this.monthDays * this.dayHours * this.hourMinutes * this.minuteSeconds,
                day:    this.dayHours * this.hourMinutes * this.minuteSeconds,
                hour:   this.hourMinutes * this.minuteSeconds,
                minute: this.minuteSeconds,
                second: 1
            };
        }
    }
};
```

### 2.3 时间工具函数（TimeUtils）

```javascript
// js/utils/time.js

const TimeUtils = {
    /**
     * 将时间对象转为距 epoch 的偏移量（带符号整数）
     * 所有时间统一转为此值进行比较和插值
     * 使用 minUnit 作为基准单位，避免秒级溢出
     * 
     * 正负年处理：负年产生负偏移量，比较天然正确
     *
     * 安全性验证：
     * - 12*30*24*60 = 518400（一年 million 分钟）
     * - ±999999 年范围：±5.18e11，远在 2^53 安全范围内
     * - 如果用户自定义 18月/40月：18*40*24*60 = 1036800
     * - ±999999 年范围：±1.03e12，仍在安全范围内
     */
    toOffset(t) { ... },

    /**
     * 计算两个时间点的差值（偏移量相减）
     */
    diff(a, b) {
        return this.toOffset(b) - this.toOffset(a);
    },

    /**
     * 时间插值：在 start 和 end 之间按比例计算中间时间
     * 返回一个新的时间对象
     * @param {Object} start - 起始时间对象
     * @param {Object} end - 结束时间对象
     * @param {number} ratio - 0~1 比例
     * @returns {Object} 新的时间对象
     */
    lerp(start, end, ratio) { ... },

    /**
     * 比较两个时间对象
     * @returns {number} -1 (a < b) / 0 (a === b) / 1 (a > b)
     */
    compare(a, b) { ... },

    /**
     * 判断一个途径点的精度是否匹配当前缩放级别
     * 规则：waypoint.resolution 的精度 ≥ 当前缩放级别精度时显示
     * 例如时间轴在 decade 时，resolution:'day' 显示，resolution:'century' 不显示
     * @param {string} resolution - 途径点的分辨率 ID
     * @param {string} currentZoomLevel - 当前缩放级别 ID
     * @returns {boolean}
     */
    isVisible(resolution, currentZoomLevel) { ... },

    /**
     * 按当前缩放级别格式化时间显示
     * 例如 zoomLevel=decade 时显示 "500年代"
     *       zoomLevel=day 时显示 "500年6月15日"
     */
    format(t, zoomLevel) { ... },

    /**
     * 从时间对象减去一定量，返回新时间对象
     * 用于计算 trackWindow 的起始时间
     * @param {Object} t - 时间对象
     * @param {number} value - 减去多少
     * @param {string} unit - 单位（year/month/day/hour/minute）
     * @returns {Object} 新的时间对象
     */
    subtract(t, value, unit) { ... }
};
```

---

## 三、途径点数据结构变更

```javascript
// 当前（整数）
{ time: 500, lat: 35.86, lng: 104.19 }

// 未来（到达/离开时间 + 分辨率）
{
    time: {
        arrival: { year: 500, month: 6, day: 15 },    // 到达时间
        departure: { year: 500, month: 6, day: 18 }    // 离开时间
    },
    lat: 35.86,
    lng: 104.19,
    resolution: 'day'  // 此途径点的精度级别，用于缩放过滤
}
```

**到达/离开时间设计说明：**

- 每个途径点包含 `arrival`（到达时间）和 `departure`（离开时间）
- 默认两者相等 —— `createTimelineComponent`、`createPersonData` 等工厂函数自动填充
- 未来地图缩放时，如果一个途径点内部有更细粒度的子轨迹，可以通过 `arrival` 和 `departure` 之间存在的时间间隔展开为子时间轴
- 对于轨迹插值 `getEntityPosition()`，当前时间位于 `waypoint[i].departure` 和 `waypoint[i+1].arrival` 之间时，在这两点之间插值
- 对于寿命检查 `_isWaypointOutsideLifespan()`，使用 `arrival` 和 `departure` 进行判断

```
时间线: 
   ──●arrival/departure──●arrival/departure──
     wp[i]              wp[i+1]
      │← departure~arrival 之间插值 →│

未来展开子轨迹:
   ──●arrival────●────●────●departure──
     (主点)   子点1  子点2   (主点)
```

**分辨率显示规则：** 只有 `waypoint.resolution` 的精度 **≥** 当前时间轴缩放级别的精度时，才显示。

例如时间轴在 `decade`（5年一格）级别：

- `resolution: 'day'` → ✔ 显示（天比5年精细）
- `resolution: 'century'` → ✘ 不显示（25年比5年粗糙）

### 3.1 工厂函数改动

```javascript
// 当前 createTimelineComponent
function createTimelineComponent(waypoints = []) {
    return { type: 'timeline', waypoints };
}

// 未来 — 工厂函数自动将单 time 补全为 {arrival, departure}
function createTimelineComponent(waypoints = []) {
    const normalized = waypoints.map(wp => {
        const timeObj = typeof wp.time === 'object' ? wp.time : { year: wp.time };
        return {
            ...wp,
            time: {
                arrival: wp.time?.arrival || timeObj,
                departure: wp.time?.departure || timeObj
            }
        };
    });
    return { type: 'timeline', waypoints: normalized };
}
```

### 3.2 getEntityPosition 插值逻辑改动

```javascript
// 当前（整数 time 直接比较和插值）
const ratio = (time - a.time) / (b.time - a.time);

// 未来（使用 departure/arrival）
const segStart = a.time.departure;
const segEnd = b.time.arrival;
// 当前时间 currentTime 在 [segStart, segEnd] 之间时插值
const ratio = TimeUtils.diff(segStart, currentTime) / TimeUtils.diff(segStart, segEnd);
```

---

## 四、轨迹显示窗口（trackWindow）

目的：防止人物轨迹过于冗长杂乱，只显示最近一段时间内的路线。

```javascript
// 在 _renderSegments 和 _renderWaypointMarkers 中
const currentTime = AppState.get('currentTime');
const windowStart = TimeUtils.subtract(currentTime, trackWindow.value, trackWindow.unit);

// 仅显示 windowStart 之后的途径点
const visibleWaypoints = waypoints.filter(wp =>
    TimeUtils.compare(wp.time, windowStart) >= 0
);
```

---

## 五、影响范围

| 模块 | 改动内容 | 改动量 |
|------|----------|--------|
| **新增** `js/data/timeConfig.js` | 时间换算规则 + 缩放级别 | 新文件 |
| **新增** `js/utils/time.js` | TimeUtils 工具函数 | 新文件 |
| `js/data/entities.js` | waypoint.time 改为对象，新增 resolution；birthTime/deathTime 改为对象 | 中 |
| `js/core/state.js` | currentTime 改为时间对象，新增 timeZoomLevel | 小 |
| `js/core/commandHandler.js` | currentTime 相关操作适配 | 小 |
| `js/components/view/timeline.js` | 新增缩放控制（缩放按钮/滚轮），currentTime 操作适配 | 大 |
| `js/components/view/map.js` | getEntityPosition 改用 TimeUtils 插值；_renderSegments 添加精度过滤 + trackWindow 过滤 | 中 |
| `js/components/view/detail.js` | timeline 渲染器改用 TimeUtils.format 显示；_isWaypointOutsideLifespan 改用 TimeUtils.compare | 小 |
| `myMap.html` | 引入新 js 文件 | 小 |

---

## 六、实施建议

分阶段实施，避免一次性改动过大：

**阶段一（基础设施）：** 仅创建 TimeConfig + TimeUtils，不修改任何现有模块。现有整数时间通过 `TimeUtils.toOffset({year: t})` 兼容。

**阶段二（数据迁移）：** 将 entities.js 中的时间改为对象格式，state.js 中的 currentTime 改为对象格式。旧数据做兼容处理。

**阶段三（消费端适配）：** 修改 map.js、detail.js、timeline.js 使用 TimeUtils，逐步添加缩放 UI 和 trackWindow。

---

## 七、溢出安全说明

选择 `minute` 作为最小精度单位：

| 配置 | 一年缩放值 | ±100万年范围 | 安全？ |
|------|-----------|-------------|--------|
| 12月/30天 | 518,400 | ±5.18e11 | ✔ 远低于 2^53 (9e15) |
| 18月/40天 | 1,036,800 | ±1.03e12 | ✔ 低于 2^53 |
| 18月/60天 | 1,555,200 | ±1.55e12 | ✔ 低于 2^53 |

如果启用 `minUnit: 'second'`，则需要限制时间范围在 ±1000 年内。
