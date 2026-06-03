# 基于地图的时空可视化系统

## 项目简介

前排提示，本项目只是一个简单的课程作业，功能简陋，不过我确实希望逐步完善和丰富它。
基于 Leaflet 的时空可视化工具，可沿时间轴动态展示人物、组织、政权等实体的地理轨迹。采用模块化 ECS 架构，通过事件总线与状态管理器实现组件解耦。

## 核心设计

### 1. ECS 数据架构

实体（Entity）由多个组件（Component）组合而成，存储在 `entities` 数组中：

- **core** — 所有实体必有的基础组件（名称、颜色、默认图标）
- **timeline** — 包含途径点数组 `[{ time, lat, lng }]`，驱动实体在地图上的运动轨迹
- **person** — 人物特有信息（出生/死亡时间、性别、描述）
- **organization** — 组织信息（总部、领袖、成员）
- **regime** — 政权信息（首都、政体、执政时间）
- **customTags** — 用户自定义标签

### 2. 事件驱动 + 状态管理

所有跨模块通信均通过 `EventBus` 和 `AppState` 完成：

- **EventBus**：模块发出全局事件（如 `ui:select`、`layout:change`、`state:change`）。
- **AppState**：单一数据源，存储 `currentTime`、`isSidebarOpen`、`selectedItem`、`entities` 等共享状态。写入状态时自动通过 `EventBus` 广播 `state:change`。

模块之间**不直接调用**，只订阅自己关心的事件。

### 3. 布局系统

`LayoutManager` 统一计算所有左侧面板（侧边栏、详情面板）的总占宽，动态更新 CSS 变量 `--left-total` / `--right-total`，并触发 `layout:change` 事件。时间轴等模块监听该事件，在动画完成后同步位置。

### 4. 面板状态

侧边栏和详情面板的开启/关闭通过 `body` 上的 CSS 类（`.sidebar--closed` / `.detail--closed`）驱动动画，同时对应的 `AppState` 中的 `isSidebarOpen` / `isDetailPanelOpen` 驱动布局重算。

### 5. 对象选择与高亮

点击地图标记或侧边栏中的实体触发全局 `ui:select` 事件，`SelectManager` 负责查找完整数据并写入 `AppState.selectedItem`。选中后：

- **地图标记** — 灰色外环变为蓝色高亮发光效果
- **侧边栏** — 自动打开并切换到资源管理 Tab，展开父面板，滚动到对应项
- **详情面板** — 自动打开并渲染实体的所有组件信息

### 6. 地图标记

实体标记采用三层结构：

```
28px 灰色外环（选中时变为蓝色）
  └─ 24px 实体颜色圆形
       └─ 16px SVG 图标 + 右侧名称标签
```

途径点标记为 12px 小圆点，沿已走路径显示，支持时间轴拖动动态更新。

### 7. 内联编辑

详情面板支持双击属性值直接编辑，适用于 `person`、`organization`、`regime`、`core` 组件的字段。修改后自动保存到 `AppState`，地图标记和侧边栏同步更新。

### 8. Undo/Redo 操作回退

所有数据修改（内联编辑、创建实体等）统一通过 `CommandHandler` 的命令模式管理：

- **撤销** `Ctrl+Z` / `Cmd+Z` — 恢复到修改前的状态
- **重做** `Ctrl+Shift+Z` / `Cmd+Y` — 重新应用已撤销的修改
- 内部使用 `_undoStack` / `_redoStack` 双栈快照，每次执行自动保存 `entities` 的纯净深拷贝，支持无限次回退

## 快速开始

1. 克隆或下载项目，确保文件结构如上所示。
2. 直接在浏览器中打开 `myMap.html`（无需服务端，但某些资源 CDN 需要网络）。
3. 系统会自动初始化地图、时间轴、侧边栏等模块。

## 模块初始化顺序（myMap.html 内联脚本）

```javascript
AppState.set('entities', entities);
AppState.set('currentTime', 0);

MapView.init('map');
ContextMenu.init(MapView.map);
SelectManager.init();
CommandHandler.init();
LayoutManager.init();
Timeline.init({ startYear: -1000, endYear: 1000, ... });
Sidebar.init();
DetailPanel.init();

Sidebar.renderResourceList();   // 手动触发首次列表渲染
```

## 项目结构

```
WorldView/
├── myMap.html              # 入口页面
├── readme.md               # 项目文档
├── changeLog.md            # 版本变更日志
├── css/
│   ├── base.css            # 基础样式 + 地图标记样式 + 途径点样式
│   ├── sidebar.css         # 侧边栏样式
│   ├── detail.css          # 详情面板样式 + 内联编辑样式
│   ├── timeline.css        # 时间轴样式
│   └── context-menu.css    # 右键菜单样式
├── js/
│   ├── utils/
│   │   └── color.js        # 颜色工具函数（adjustColor）
│   ├── icons/
│   │   └── svg-icons.js    # SVG 图标库
│   ├── data/
│   │   └── entities.js     # 实体数据定义与工厂函数
│   ├── core/
│   │   ├── eventBus.js     # 事件总线（发布/订阅）
│   │   ├── state.js        # 全局状态管理
│   │   ├── selectManager.js # 选中项管理
│   │   └── commandHandler.js # 命令处理器
│   └── components/
│       └── view/
│           ├── map.js       # 地图视图（标记、轨迹、途径点）
│           ├── sidebar.js   # 侧边栏视图
│           ├── detail.js    # 详情面板视图
│           ├── timeline.js  # 时间轴视图
│           ├── layout.js    # 布局管理器
│           └── contextMenu.js # 右键菜单视图
```

## 依赖

- Leaflet 1.7.1（CDN 引入）
- 原生 JavaScript（无框架）
- 所有图标为内联 SVG，无需额外图标库

## 如何扩展

### 添加新的人物或实体

编辑 `js/data/entities.js`，使用工厂函数创建新实体，并确保 `id` 唯一。

```javascript
const newEntity = createPersonEntity({
    name: "新人物",
    color: "#e74c3c",
    birthTime: 500,
    deathTime: 600,
    waypoints: [{ time: 500, lat: 34.0, lng: 108.0 }, ...]
});
entities.push(newEntity);
```

### 添加新的组件类型（如物品、事件）

1. 在 `entities.js` 中定义组件工厂函数和实体工厂函数
2. 在 `sidebar.js` 的 `typeConfig` 中添加新类型的图标和标签
3. 在 `detail.js` 的 `_getComponentRenderer()` 中添加渲染器（含 `data-component` / `data-field` 属性以支持编辑）
4. 在 `svg-icons.js` 中添加对应的 SVG 图标
5. 在 `myMap.html` 右键菜单中添加创建菜单项
6. 在 `commandHandler.js` 中添加对应的创建命令处理

### 添加新的左侧/右侧面板

- 创建对应的 CSS（可复用 `.panel--left` 基类）。
- 创建 JS 模块，管理自己的 DOM、事件和状态。
- 在 `LayoutManager.panels` 中添加配置（`side`、`width`），并监听该面板的开关状态，重新 `compute()`。
- 时间轴会自动适配，无需额外修改。

## 调试

- `EventBus` 已挂载到 `window.EventBus`，可在浏览器控制台中直接查看 `EventBus.events`。
- 所有状态变化均会触发 `state:change` 事件，订阅该事件可追踪状态流。

## 未来优化方向

- 完善除人物外的其他资源对象（组织、政权、事件、物品等）。
- 完善右键地图创建资源功能。
- 添加筛选显示功能。
- 完善时间轴的显示功能。
- 添加时间轴缩放功能。
- 添加自定义地图功能。
- 添加资源分组功能。
- 添加历史大事件系统。
- mirrowfish大模型支持
- ...
