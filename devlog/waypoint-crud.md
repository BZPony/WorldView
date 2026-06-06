# 途径点 CRUD 功能设计

> 创建日期：2026-06-06
> 状态：待实现

---

## 一、背景与动机

目前 detail 面板中的 `motion` 和 `nameHistory` 组件只能查看途径点数据，无法进行添加和删除操作。用户需要通过详情面板直接管理途径点数据，提升编辑效率。

## 二、功能概述

为 motion 和 nameHistory 组件的每个途径点条目添加删除按钮和"在此后插入"按钮，并在列表顶部添加"在开头插入"特殊条目。

### 2.1 按钮布局

每个 `waypoint-item` 内部采用左右结构：

```
┌───────────────────────────────────┐
│ [内容区：时间/名称/描述]  [按钮区] │
│                         ┌──────┐ │
│                         │ 删除  │ │
│                         ├──────┤ │
│                         │ 插入  │ │
│                         └──────┘ │
└───────────────────────────────────┘
```

- 按钮区位于 `waypoint-item` 右侧，垂直排列
- 每个按钮为圆角矩形，内含 SVG 图标
- hover 时背景高亮
- 删除按钮使用 `delete` 图标，插入按钮使用 `add` 图标

### 2.2 顶部插入条目

- 在滚动列表的最顶部，渲染一个特殊的 `waypoint-item`
- 不显示任何数据内容
- 只有一个居中的"插入"按钮，表示在全部途径点之前创建新途径点

### 2.3 默认值规则

**motion 组件：**

| 场景 | arrival 时间 | departure 时间 | name | description |
|------|------------|--------------|------|-------------|
| 在两个途径点之间插入 | 前一个 departure 和后一个 arrival 的平均值 | 同上 | "新途径点" | "请输入描述" |
| 在最前面插入（无前一个） | 后一个 arrival - 10 × minUnit | 同上 | "新途径点" | "请输入描述" |

其中 `minUnit` 根据当前 `timeZoomLevel` 的分辨率级别确定缩放系数。

**nameHistory 组件：**

| 场景 | time | description |
|------|------|-------------|
| 在两个条目之间插入 | 前后两个时间的平均值 | "请输入描述" |
| 在最前面插入（无前一个） | 后一个 time - 10 × minUnit | "请输入描述" |

## 三、影响范围

| 文件 | 改动内容 | 改动量 |
|------|----------|--------|
| `js/components/view/detail.js` | motion/nameHistory 渲染器：添加按钮区、顶部插入条目；新增 `_addWaypoint`、`_deleteWaypoint` 方法 | 大 |
| `css/detail.css` | 新增按钮区样式、按钮样式、hover 效果、flex 布局调整 | 小 |

## 四、实施步骤

### Step 1：detail.css 样式更新

1. `.waypoint-item` 改为 flex 布局（水平方向），内容区 flex:1，按钮区固定宽度
2. 新增 `.waypoint-btn-group` — 右侧按钮区容器（垂直 flex）
3. 新增 `.waypoint-btn` — 按钮样式（圆角矩形、SVG 图标、hover 高亮）
4. 新增 `.waypoint-add-first` — 顶部特殊条目的样式（无内容、居中按钮）

### Step 2：detail.js 渲染器更新

**motion 渲染器：**
1. 每个途径点 `<li>` 中增加右侧按钮区（删除 + 插入）
2. 在列表开头新增"在开头插入"的 `<li>`
3. 使用 `data-wp-index` 和 `data-action` 标识操作

**nameHistory 渲染器：**
1. 同上结构

### Step 3：detail.js 事件处理

1. 通过事件委托监听 `.waypoint-btn` 的 `click` 事件
2. `_handleWaypointAction(e)` 根据 `data-action` 分发：
   - `delete-wp`：删除指定索引的途径点
   - `add-after-wp`：在指定索引后插入新途径点
   - `add-first-wp`：在开头插入新途径点
3. 计算默认值并发射 `command:execute` 事件

### Step 4：默认时间计算

1. 获取当前 `timeZoomLevel` 对应的分辨率单位
2. 使用 `TimeUtils` 计算两个时间的平均值
3. `TimeUtils.toOffset()` 转为整数 → 求平均 → `TimeUtils.offsetToTime()` 转回对象
4. "向前推 N 个 minUnit"：用 `TimeUtils.toOffset()` 相减