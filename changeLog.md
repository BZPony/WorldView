# CHANGELOG

所有值得注意的项目变更都将记录在此文件中。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased] - 开发中

### Added

### Changed

### Fixed

## [0.4.0] - 2026-05-14

### Added

- 新增 `sidebar.css` 中选择对象的高亮功能
- 新增 `sidebar-content-subitem` 对象的`color`svg颜色图标
- 新增 `organization` 和`regime`的示例数据结构
- 在 `contextMenu.js` 中添加 `lastClickLatLng` 变量，便于向事件传递位置参数
- 新增 `commandHandler.js` 文件，负责 `AppState`中应用数据的修改
- 在 `entities.js` 中新增 `createPersonData()` ，返回一个默认人物数据
- 在 `svg-icons.js` 中新增 `initIconsForContainer()`，仅初始化指定容器中的图标

### Changed

- 修改 `sidebar.css`，中的布局格式，并添加选择高亮效果
- 将 `sidebar.js` 中 `init()` 函数中绑定人物事件功能提取为 `_initContentSubitemClick()`
- 将 `persons.js` 文件名修改为 `entities.js`
- 修改 `detail` 面板的布局结构
- `sidebar.js` 中的 `_initContentSubitemClick()` 不再负责更改具体的DOM元素，现在由 `_onStateChange()` 统一负责响应

### Fixed

- 修复 `map.js` 中函数 `getPersonPosition()` 当人物只存在一个途径点时函数错误返回 `undefined` 的缺陷
- 修复渲染人物列表时 `.icon` 无法正确显示svg图片的问题
- 修复由于 `CommandHandler` 和 `LayoutManager` 初始化顺序问题引起的布局错误缺陷

## [0.3.0] - 2026-05-11

### Added

- 新增 `SelectManager` 模块，统一管理 `ui:select` 事件与实体查找逻辑
- 新增 `DetailPanel` 组件，支持点击人物在弹出面板中查看详细信息
- 新增 `detail.css`，定义详情面板的视觉样式与滑入动画
- 新增 `cross` 图标（SVG），用于详情面板的关闭按钮

### Changed

- 重构 `LayoutManager`，现在同时管理侧边栏与详情面板的占宽计算
- `--detail-left` CSS 变量现在由 `LayoutManager` 动态设置，以支持面板跟随侧边栏移动
- 将 `Sidebar.renderPersonList()` 中的选中逻辑改为发射 `ui:select` 事件，不再直接操作 `selectedItem`

### Fixed

- 修复关闭详情面板时错误地将 `selectedItem` 设为 `null` 的问题

## [0.2.0] - 2026-05-10

### Added

- 引入全局 `EventBus` 与 `AppState` 架构，实现模块间解耦通信
- 新增 `ContextMenu` 模块，支持地图右键菜单
- 新增 `LayoutManager` 模块，统一计算面板布局与 CSS 变量
- 新增 `layout:change` 事件，支持时间轴监听布局变化并延迟渲染

### Changed

- 将上帝脚本 `index.html` 拆分为 12 个独立模块（CSS + JS）
- 将侧边栏、时间轴、右键菜单的业务逻辑全部移入各自组件
- 统一命名规范：CSS 类名采用 BEM 变体（区域-组件-层级），状态类统一为 `.active`、`.is-hidden`

### Fixed

- 修复侧边栏关闭时时间轴在动画结束前就重新渲染导致的错位问题
- 修复时间轴 `resize` 事件与 `layout:change` 事件重复触发的问题

## [0.1.0] - 2026-05-07

### Added

- 初始化 Leaflet 地图，使用 OSM 瓦片源
- 添加时间轴组件，支持拖动与刻度显示
- 添加侧边栏 UI，包含筛选 / 资源管理 Tab
- 添加五个示例人物数据，支持在地图上显示人物标记与轨迹
- 添加人物位置线性插值工具函数
