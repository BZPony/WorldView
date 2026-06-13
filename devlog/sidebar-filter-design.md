# 侧边栏筛选功能设计文档

## 1. 概述

当前侧边栏的「筛选」Tab 仅为一个占位符，资源管理器 Tab 无筛选能力，所有实体全部显示。本设计文档规划侧边栏多维筛选功能，使用户能快速定位目标实体。

## 2. 设计原则

- **叠加式筛选** — 多个筛选条件 AND 逻辑叠加，而非单选模式
- **即时反馈** — 任何筛选条件变更后，资源管理器列表即时刷新
- **状态持久化** — 筛选条件存储在 `AppState.filterCriteria` 中，通过 `state:change` 广播
- **非破坏性** — 筛选仅影响列表显示，不修改实体数据
- **渐进增强** — 筛选默认不过滤（显示全部），用户主动选择后生效

## 3. 筛选维度

基于 WorldView 的 ECS 数据结构，设计以下筛选维度：

### 3.1 实体类型筛选

| 类型 | 组件判别 | 默认状态 |
|------|---------|---------|
| 👤 人物 | `components.person` 存在 | ✅ 显示 |
| 📍 地点 | `components.place` 存在 | ✅ 显示 |
| 🏛️ 组织 | `components.organization` 存在 | ✅ 显示 |
| 🏰 政权 | `components.regime` 存在 | ✅ 显示 |
| 🏷️ 自定义标签 | `components.customTags` 存在 | ✅ 显示 |

**交互**：复选框列表，全选/取消全选快捷按钮。

### 3.2 时间范围筛选

根据当前时间轴位置，筛选出在当前时间窗口内有活动的实体：

| 规则 | 说明 |
|------|------|
| 跟随时间轴 | 筛选 `currentTime` 位于实体活跃时间范围内的实体 |
| 自定义时间范围 | 用户手动输入起止时间点 |
| 时刻 / 时段 | 单选：某个时刻存在（默认），或某时段存在 |

**实体活跃时间判断规则**：
- **Person**：`birthTime <= time <= deathTime`
- **Motion**：`firstWaypoint.arrival <= time <= lastWaypoint.departure`
- **Place / Organization / Regime**：始终存在（无时间概念，不符合时间筛选时自动排除）

**交互**：Toggle 开关 + 手动输入起止时间（年:月:日）。

### 3.3 地图可视范围筛选

仅显示当前地图视口内的实体（地点类和有轨迹经过的实体）。

| 规则 | 说明 |
|------|------|
| Place 实体 | `position.lat/lng` 在当前地图 bounds 内 |
| Motion 实体 | 至少一个途径点坐标在当前地图 bounds 内 |
| 关闭时 | 不应用地图范围筛选 |

**交互**：Toggle 开关，开启后随地图移动/缩放实时过滤。

### 3.4 关键词搜索

输入文本搜索实体名称（模糊匹配 `components.core.name`）。

**交互**：搜索输入框，实时过滤（debounce 300ms），不区分大小写。

### 3.5 自定义标签筛选

从所有实体的 `customTags` 组件中提取唯一标签列表，用户可多选标签进行过滤。

**交互**：标签下拉多选，支持快速全选/清除。

## 4. 数据模型

### 4.1 AppState.filterCriteria 结构

```javascript
{
    entityTypes: {
        person: true,        // 人物是否可见
        place: true,         // 地点是否可见
        organization: true,  // 组织是否可见
        regime: true,        // 政权是否可见
    },
    timeFilter: {
        enabled: false,                   // 是否启用时间筛选
        mode: 'moment',                  // 'moment' 单时刻 | 'range' 时段
        from: null,                      // 时段模式起始时间 {year, month, day}
        to: null,                        // 时段模式结束时间 {year, month, day}
        followTimeline: true,            // 是否跟随时间轴当前时间
    },
    mapBounds: {
        enabled: false,                  // 是否启用地图范围筛选
    },
    keyword: '',                         // 关键词搜索（空字符串=不筛选）
    tags: [],                            // 选中的标签数组，空数组=不筛选
}
```

### 4.2 筛选结果计算流程

```
AppState.entities (全部实体)
    │
    ├─ [1] 类型筛选 filterByType(entities, criteria.entityTypes)
    ├─ [2] 时间筛选 filterByTime(entities, criteria.timeFilter, currentTime)
    ├─ [3] 地图筛选 filterByBounds(entities, mapBounds)
    ├─ [4] 关键词筛选 filterByKeyword(entities, criteria.keyword)
    ├─ [5] 标签筛选 filterByTags(entities, criteria.tags)
    │
    ▼
filteredEntities → renderResourceList()
```

## 5. UI 设计

### 5.1 筛选面板布局（侧边栏内，filter-content-panel）

```
┌────────────────────────────┐
│ 🔍 [搜索实体名称...]        │  ← 输入框
├────────────────────────────┤
│ ▼ 实体类型                  │  ← 折叠区块标题
│   ☑️ 人物       ☑️ 地点     │
│   ☑️ 组织       ☑️ 政权     │
│   ☑️ 自定义标签             │
│   [全选] [取消全选]         │
├────────────────────────────┤
│ ▼ 时间筛选          [开关] │
│   ○ 跟随时间轴              │
│   ○ 自定义时间              │
│   起止: [年] [月] [日]      │
│   截止: [年] [月] [日]      │
│   ○ 时刻 ○ 时段             │
├────────────────────────────┤
│ ▼ 地图范围筛选      [开关] │
│   (提示: 开启后只显示       │
│    当前视野内的实体)        │
├────────────────────────────┤
│ ▼ 自定义标签                │
│   [西域 ▼]                  │  ← 多选下拉
│   (已选: 2)                 │
├────────────────────────────┤
│ [重置所有筛选]              │  ← 底部按钮
└────────────────────────────┘
```

### 5.2 交互细节

- **折叠区块**：所有筛选区块默认展开，点击标题折叠/展开（带 ▼ 箭头旋转动画）
- **Toggle 开关**：右侧滑动开关，即时生效
- **时间输入**：若启用时间筛选且 `followTimeline = false`，显示起止时间输入框
- **重置按钮**：一键恢复所有筛选为默认值（全部显示）
- **筛选激活指示**：侧边栏筛选 Tab 按钮上显示激活的筛选条件数量（badge 小红点）

## 6. 架构集成

### 6.1 筛选逻辑位置

筛选逻辑实现在 `js/data/` 目录下新增 `filter.js`，作为纯数据模块，不依赖 DOM：

```javascript
// js/data/filter.js
const FilterEngine = {
    /**
     * 根据筛选条件过滤实体列表
     * @param {Array} entities - 全部实体
     * @param {Object} criteria - AppState.filterCriteria
     * @param {Object} context - { currentTime, mapBounds }
     * @returns {Array} 筛选后的实体
     */
    apply(entities, criteria, context) {
        let filtered = [...entities];
        
        // 1. 类型筛选
        filtered = this._filterByType(filtered, criteria.entityTypes);
        // 2. 时间筛选
        if (criteria.timeFilter.enabled) {
            filtered = this._filterByTime(filtered, criteria.timeFilter, context.currentTime);
        }
        // 3. 地图范围筛选
        if (criteria.mapBounds.enabled && context.mapBounds) {
            filtered = this._filterByBounds(filtered, context.mapBounds);
        }
        // 4. 关键词筛选
        if (criteria.keyword) {
            filtered = this._filterByKeyword(filtered, criteria.keyword);
        }
        // 5. 标签筛选
        if (criteria.tags.length > 0) {
            filtered = this._filterByTags(filtered, criteria.tags);
        }
        
        return filtered;
    },
    
    _filterByType(entities, typeMap) { /* ... */ },
    _filterByTime(entities, timeFilter, currentTime) { /* ... */ },
    _filterByBounds(entities, bounds) { /* ... */ },
    _filterByKeyword(entities, keyword) { /* ... */ },
    _filterByTags(entities, tags) { /* ... */ },
};
```

### 6.2 与现有模块的集成点

| 模块 | 变更 |
|------|------|
| `state.js` | 新增 `filterCriteria` 状态字段，默认值（全部显示） |
| `sidebar.js` | 新增筛选 UI 渲染方法，`renderResourceList()` 使用 `FilterEngine.apply()` 获取筛选后的列表，监听 `filterCriteria` 变化刷新 |
| `map.js` | 地图移动/缩放时发送 `map:boundschange` 事件供筛选模块消费 |
| `myMap.html` | 筛选面板移除占位符，改由 JS 动态渲染 |

### 6.3 状态流转

```
用户操作筛选 UI
    → AppState.set('filterCriteria', newCriteria)
    → EventBus.emit('state:change', { key: 'filterCriteria', ... })
    → Sidebar._onStateChange() 
    → Sidebar.renderResourceList() (使用 filteredEntities)
    → MapView 监听筛选变化后隐藏/显示地图标记（可选优化）
```

## 7. 实施计划

### 阶段一：基础架构（筛选引擎 + 类型筛选）

1. 创建 `js/data/filter.js` — 实现 `FilterEngine`，完成类型筛选
2. `state.js` 新增 `filterCriteria` 状态，默认全显示
3. `sidebar.js` 修改 `renderResourceList()` 使用 `FilterEngine.apply()`
4. `sidebar.js` 新增 `_initFilterPanel()` 方法，动态渲染类型复选框
5. 绑定复选框 change 事件 → 更新 `filterCriteria.entityTypes`

### 阶段二：时间筛选

1. `FilterEngine` 实现 `_filterByTime()`
2. 筛选 UI 渲染时间区块（开关、模式切换、输入框）
3. 绑定事件更新 `filterCriteria.timeFilter`

### 阶段三：关键词 + 标签筛选

1. `FilterEngine` 实现 `_filterByKeyword()` / `_filterByTags()`
2. 筛选 UI 渲染搜索框和标签多选下拉
3. 绑定事件

### 阶段四：地图范围筛选

1. `FilterEngine` 实现 `_filterByBounds()`
2. `map.js` 发送 `map:boundschange` 事件
3. 筛选 UI 渲染 Toggle 开关
4. 绑定事件

### 阶段五：联动优化

1. 筛选条件变化时同步更新地图标记显示/隐藏
2. 筛选条件激活数量 badge
3. 筛选条件重置按钮
4. 搜索 debounce 优化

## 8. 边界情况

- **空结果**：当筛选结果为空时，资源管理器显示"没有匹配的实体"提示
- **筛选与创建**：新创建的实体若不符合筛选条件，则不立即显示在列表中
- **筛选与选中**：若当前选中的实体被筛除，不清除选中状态（用户可取消筛选恢复）
- **标签动态性**：实体标签修改后，筛选面板中的可选标签列表需动态更新
- **时间对象格式**：自定义时间输入需兼容 `{year, month, day}` 对象格式（月日可为空）