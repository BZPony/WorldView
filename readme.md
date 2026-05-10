# 基于地图的时空可视化系统

## 项目简介
基于 Leaflet 的时空可视化工具，可沿时间轴动态展示人物、组织、政权的地理轨迹。采用模块化架构，通过事件总线与状态管理器实现组件解耦。

## 核心设计

### 1. 事件驱动 + 状态管理
所有跨模块通信均通过 `EventBus` 和 `AppState` 完成：
- **EventBus**：模块发出全局事件（如 `ui:select`、`layout:change`、`state:change`）。
- **AppState**：单一数据源，存储 `currentTime`、`isSidebarOpen`、`selectedItem` 等共享状态。写入状态时自动通过 `EventBus` 广播 `state:change`。

模块之间**不直接调用**，只订阅自己关心的事件。

### 2. 布局系统
`LayoutManager` 统一计算所有左侧面板（侧边栏、详情面板）的总占宽，动态更新 CSS 变量 `--left-total` / `--right-total`，并触发 `layout:change` 事件。时间轴等模块监听该事件，在动画完成后同步位置。

### 3. 面板状态
侧边栏和详情面板的开启/关闭通过 `body` 上的 CSS 类（`.sidebar--closed` / `.detail--closed`）驱动动画，同时对应的 `AppState` 中的 `isSidebarOpen` / `isDetailPanelOpen` 驱动布局重算。

### 4. 对象选择
点击侧边栏中的人物（或其他实体）触发全局 `ui:select` 事件，`SelectManager` 负责查找完整数据并写入 `AppState.selectedItem`。`DetailPanel` 监听到 `selectedItem` 变化后自动打开并渲染详情。

## 快速开始

1. 克隆或下载项目，确保文件结构如上所示。
2. 直接在浏览器中打开 `myMap.html`（无需服务端，但某些资源 CDN 需要网络）。
3. 系统会自动初始化地图、时间轴、侧边栏等模块。

## 模块初始化顺序（index.html 内联脚本）

```javascript
AppState.set('persons', persons);
AppState.set('currentTime', 0);

MapView.init('map');
ContextMenu.init(MapView.map);
SelectManager.init();
Timeline.init({ startYear: -1000, endYear: 1000, ... });
Sidebar.init();
DetailPanel.init();
LayoutManager.init();

Sidebar.renderPersonList();   // 手动触发首次列表渲染
```
## 依赖
- Leaflet 1.7.1（CDN 引入）
- 原生 JavaScript（无框架）
- 所有图标为内联 SVG，无需额外图标库

## 如何扩展

### 添加新的人物或实体
编辑 `js/data/persons.js`，在数组中增加新对象，并确保 `id` 唯一。

### 添加新的可选对象类型（如组织、国家）
- 在侧边栏列表中渲染时，为每个项设置 `data-id` 和 `data-type` 属性。
- 点击项会发射 `ui:select` 事件，`SelectManager` 根据 `type` 从对应数据源查找。
- `DetailPanel.renderDetail()` 增加对新类型的内容渲染分支。

### 添加新的左侧/右侧面板
- 创建对应的 CSS（可复用 `.panel--left` 基类）。
- 创建 JS 模块，管理自己的 DOM、事件和状态。
- 在 `LayoutManager.panels` 中添加配置（`side`、`width`），并监听该面板的开关状态，重新 `compute()`。
- 时间轴会自动适配，无需额外修改。

## 调试
- `EventBus` 已挂载到 `window.EventBus`，可在浏览器控制台中直接查看 `EventBus.events`。
- 所有状态变化均会触发 `state:change` 事件，订阅该事件可追踪状态流。

## 未来优化方向
- 完善除人物外的其他资源对象。
- 完善右键地图创建资源功能。
- 添加筛选显示功能。
- 完善时间轴的显示功能。
- 添加时间轴缩放功能。
- 添加自定义地图功能。
- 添加资源分组功能。
- 添加历史大事件系统。
- ...