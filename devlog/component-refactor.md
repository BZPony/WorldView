# 组件重构：将 timeline 拆分为 motion / nameHistory

> 创建日期：2026-06-06
> 状态：规划阶段（尚未实现）

---

## 一、背景与动机

### 1.1 当前问题

现有的 `timeline` 组件承载了两种完全不同的职责：

| 维度 | person 的 timeline | place 的 timeline |
|------|-------------------|-------------------|
| 时间类型 | arrival + departure 双时间 | 单一时间 |
| 位置 | 每个 waypoint 不同（线性插值移动） | 所有 waypoint 相同（固定坐标） |
| 名称 | 途径点标签（次要） | 核心功能（历史名称演变） |
| 轨迹线 | 需要渲染 | 不需要 |
| 途径点标记 | 需要渲染 | 不需要 |
| 插值 | 相邻 waypoint 线性插值 | 返回最后位置 |
| 寿命检查 | 需要（出生/死亡区间虚线） | 不需要 |

这违反了 ECS **一个组件只做一件事** 的原则，导致：

1. `detail.js` 渲染器需要判断实体类型来决定是否显示抵达/离开时间
2. `map.js` 的 `getEntityPosition` 需要分支处理两种行为
3. 代码耦合度高，难以扩展（比如政权实体未来也需要时间轴）

### 1.2 目标

将一个臃肿的 `timeline` 拆分为三个职责单一的组件：

- **`motion`（运动轨迹）** — 人物的路径移动（替代旧 timeline 的轨迹职责）
- **`nameHistory`（名称演变）** — 实体随时间改名（替代旧 timeline 的名称演变职责）
- **固定位置** — 使用已有的 `place` 组件，其自带的 `position` 字段足够

拆分后旧 `timeline` 组件仍可正常使用，待所有消费端迁移完成后删除。

---

## 二、新组件设计

### 2.1 motion（运动轨迹组件）

用于可移动实体（人物、动物、舰队等）。waypoint 结构继承自旧 `timeline`，但仅包含移动相关数据。

```javascript
{
    type: 'motion',
    waypoints: [
        {
            time: { arrival: { year: 0, month: 6, day: 15 }, departure: { year: 0, month: 6, day: 15 } },
            lat: 30,
            lng: 110,
            name: '起源镇',        // 途径点标签
            description: '在此地结识了第一位同伴',  // 事件描述
            resolution: 'day'     // 精度级别
        }
    ]
}
```

- 参与 `getEntityPosition` 线性插值
- 参与 `_renderWaypointMarkers` 渲染途径点标记
- 参与 `_renderSegments` 渲染轨迹线
- 参与寿命检查（虚线/实线）

### 2.2 place（固定位置组件，已有）

**不需要新组件。** 已存在的 `place` 组件自身携带 `position` 信息，足以承担固定位置数据的职责：

```javascript
{
    type: 'place',
    position: { lat: 30, lng: 110 },
    description: '一座宁静的小镇'
}
```

- `getEntityPosition` 直接返回 `place.position`
- 不渲染轨迹线和途径点标记
- 可以和 `motion`、`nameHistory` 等组件自由组合

### 2.3 nameHistory（名称演变组件）

用于随时代改变名称的实体（可选，可附加在 place、regime 等任意实体上）。

```javascript
{
    type: 'nameHistory',
    entries: [
        { time: { year: -300 }, name: '拜占庭', description: '古希腊殖民城市' },
        { time: { year: 330, month: 5 }, name: '君士坦丁堡', description: '东罗马首都' },
        { time: { year: 1453 }, name: '伊斯坦布尔', description: '奥斯曼帝国征服后' }
    ]
}
```

- 不参与位置计算
- 详情面板显示名称变更时间线
- `map.js` 的 `_getDisplayName` 从 `nameHistory` 中查找当前名称
- entries 按时间升序排列

### 2.4 实体组合示例

```javascript
// 人物：core + motion + person
person = {
    core: { name: '张三', color: '#4f454f', icon: 'person' },
    motion: { waypoints: [...] },
    person: { birthTime: ..., deathTime: ..., gender: '男', description: '...' }
}

// 地点（静态）：core + place
place_static = {
    core: { name: '小马谷', color: '#ff69b4', icon: 'place' },
    place: { position: { lat: 31, lng: 120 } }
}

// 地点（名称演变）：core + place + nameHistory
place_dynamic = {
    core: { name: '君士坦丁堡', color: '#cc3333', icon: 'place' },
    place: { position: { lat: 28, lng: 115 } },
    nameHistory: {
        entries: [
            { time: { year: -300 }, name: '拜占庭' },
            { time: { year: 330, month: 5 }, name: '君士坦丁堡' },
            { time: { year: 1453 }, name: '伊斯坦布尔' }
        ]
    }
}
```

---

## 三、影响范围

| 文件 | 改动内容 | 改动量 |
|------|----------|--------|
| `js/data/entities.js` | 新增 `createMotionComponent`、`createNameHistoryComponent`、`createMotionEntity` | 中 |
| `js/data/entities.js` | 示例数据增加新组件版本 | 中 |
| `js/components/view/map.js` | `getEntityPosition` 优先 `place`/`motion`，旧 `timeline` 备选 | 中 |
| `js/components/view/map.js` | `renderTimelineEntities` 判断 `motion` 渲染轨迹 | 小 |
| `js/components/view/map.js` | `_getDisplayName` 检查 `nameHistory` | 小 |
| `js/components/view/map.js` | 筛选实体方法同时检查 `motion`+`timeline` | 小 |
| `js/components/view/detail.js` | 新增 `motion`/`nameHistory` 渲染器 | 中 |
| `js/components/view/detail.js` | `_getComponentLabel`/`_getComponentIcon` 添加 `motion` 类型 | 小 |
| `js/components/view/sidebar.js` | 筛选逻辑补充 `motion` | 小 |
| `myMap.html` | 无改动 | 无 |
| `css/` | 无改动 | 无 |

### 3.1 旧 timeline 兼容策略

`timeline` 组件在新系统中被逐步淘汰：

1. **阶段一（当前）**：`timeline` 正常运行，所有消费端同时支持 `motion`/`timeline`
2. **阶段二（数据迁移）**：创建新实体使用 `motion`，旧实体自动补全两种组件
3. **阶段三（删除）**：所有代码中移除 `timeline` 分支，只保留 `motion`/`nameHistory`

> 注意：stage-1.html 中的 devlog 如果引用旧组件名，也需同步更新。

---

## 四、实施顺序

### Step 1：实体数据层

- 在 `entities.js` 中新增 `createMotionComponent`、`createNameHistoryComponent` 工厂函数
- 新增 `createMotionEntity` 工厂函数
- 更新示例人物使用 `motion` 组件
- 更新示例地点使用 `nameHistory` 组件（位置仍使用 `place` 组件）
- 修改 `normalizeEntityData` 自动从 `timeline` 生成 `motion`

### Step 2：地图视图层

- 筛选可移动实体同时检查 `motion` + 旧 `timeline`
- `getEntityPosition` 优先检查 `place`（固定位置）/ `motion`（移动插值），旧 `timeline` 作为 fallback
- `renderTimelineEntities` 判断 `motion` 决定是否渲染轨迹和途径点
- `_getDisplayName` 检查 `nameHistory`

### Step 3：详情面板层

- 新增 `motion` 渲染器（与旧 timeline 渲染器行为一致，不显示抵达/离开时间）
- 新增 `nameHistory` 渲染器
- 更新 `_getComponentLabel`/`_getComponentIcon` 添加 `motion` 类型

### Step 4：侧边栏层

- `renderResourceList` 中补充 `motion` 到筛选列表

---

## 五、注意事项

1. **旧数据兼容**：在 `map.js` 和 `detail.js` 中，每个检查 `motion` 的位置都需同时检查 `timeline` 作为备选
2. **命名一致**：`motion` 中的 waypoint 字段名与旧 `timeline` 完全一致，方便迁移
3. **不修改 HTML/CSS**：所有新功能只需修改 JS 文件和示例数据
4. **测试**：确保拖动时间轴时人物轨迹和地点显示均正常，undo/redo 正常
