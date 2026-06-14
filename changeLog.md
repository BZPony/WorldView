# CHANGELOG

所有值得注意的项目变更都将记录在此文件中。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.7.0] - 2026-06-14

### Added

- **侧边栏筛选功能** — 筛选面板支持五个维度的叠加筛选：实体类型复选框（person/place/organization/regime/customTags + 全选/取消全选）、关键词搜索（debounce 300ms 模糊匹配）、时间范围筛选（跟随时间轴 / 自定义时段切换）、地图可视范围筛选（Toggle 开关，拖拽缩放地图实时过滤）、激活条件 badge 小红点
- **重置筛选按钮** — 一键恢复所有筛选条件为默认值
- 新增 `js/data/filter.js` — FilterEngine 纯数据筛选引擎，5 层流水线过滤
- 新增 `AppState.filterCriteria` 状态字段
- 新增筛选面板 CSS（Toggle 开关、复选框组、时间输入、badge 等 ~250 行样式）
- 新增空结果提示"没有匹配的实体"
- 新增 `MapView.map.getBounds()` 集成地图范围筛选

### Changed

- **readme.md 重写** — 从技术架构文档重构为情景教学式用户手册（423 行）。11 个场景从浅入深覆盖所有功能，面向零基础用户；开发者文档移至末尾
- 筛选面板实体类型图标从 emoji 替换为 SVG icon 系统（person/place/organization/regime/tag）

### Fixed

- 修复地图范围筛选不生效的问题（`renderResourceList()` 未传入 `mapBounds` 参数）
- 修复地图范围筛选不响应拖拽/缩放的问题（新增 Leaflet `moveend` 事件监听自动重新筛选）

## [0.6.0] - 2026-06-14

### Added

- **途径点位置绑定** — 途径点 `pos` 字段支持两种类型：`{ type: 'coords', lat, lng, name }` 直接坐标模式 和 `{ type: 'place', entityId }` 地点绑定模式，绑定后途径点自动跟随 place 实体位置变更
- **地点选择器（Location Picker）** — 途径点位置编辑新增"定位"按钮，点击后激活地图点选模式，可绑定地点实体或选取新坐标
- **时间轴缩放系统** — 支持百年 / 十年 / 年 / 月 / 日五级缩放级别，动态刻度再生 + 虚拟滚动（仅 ~14 个 DOM 节点），途径点按 `resolution` 分级过滤
- **Lifespan Bars** — 时间轴上方显示实体活跃时间段的彩色条带，Person 实体出生-死亡区间显示虚线 + 👶💀 图标，Motion 实体显示实线，底部向上堆叠排列
- **Thumbtack 图钉** — 详情面板"图钉"按钮可将实体固定到时间轴显示其 lifespan bar，按钮仅对有 motion 组件的实体可见
- **副面板（Secondary Panel）** — 支持同时编辑两个实体的详情面板，点击途径点标记或创建途径点后自动打开，数据修改后自动同步刷新
- **实体删除** — 详情面板红色删除按钮 + 侧边栏右键删除，统一走 `CommandHandler` 支持 undo/redo，删除选中实体时自动关闭面板
- **右键菜单动态架构** — `ContextMenu` 从静态 HTML 重构为动态场景渲染（`_buildMenuItems` / `_getMenuConfig`），地图右键显示创建菜单，侧边栏实体右键仅显示删除
- **右键创建 Place / Waypoint** — 地图右键菜单新增创建 Place 实体 和创建 Waypoint 到现有 motion 实体
- **途径点 CRUD** — 支持添加/编辑/删除 motion 实体的途径点，地图和详情面板联动更新
- **侧边栏状态保持** — `renderResourceList()` 刷新后保留面板展开/折叠状态
- **途径点标记点击交互** — 途径点标记从 `interactive:false` 改为可点击，点击后选中实体并打开副面板
- **时间轴精度提升** — 内部使用分钟级时间戳替代 `Math.round(year)`，像素到年份精度从 ±1 年提升到 ±1 分钟
- **颜色编辑器改进** — 使用内联 `<input type="color">` 替代弹出式选择器，解决浏览器安全策略阻止 `input.click()` 的问题
- 新增 `getLifespan()` 函数计算实体时间跨度
- 新增 `pinnedEntities` 状态字段
- 新增 Path、edit、newWindow、baby、skull SVG 图标

### Changed

- 途径点数据结构从 `lat/lng/name` 平铺改为 `pos` 嵌套对象
- `TimeUtils.toOffset/offsetToTime` 重命名为 `toTimestamp/timestampToTime` 避免与 Timeline 像素偏移概念混淆
- 时间轴刻度渲染改为操作独立的 `_ticksLayer` 容器，与 `_lifespanLayer` 分离避免 innerHTML 冲突
- 详情面板按钮布局从绝对定位改为 flex 列布局，支持 Thumbtack 按钮显示/隐藏时的自适应折叠
- `isVisible` 逻辑修正为 `zoomIdx >= resIdx`（放大时显示更多低精度途径点）
- 右键菜单初始化签约为 `ContextMenu.init(map)`，不再依赖静态 HTML

### Fixed

- 修复时间轴刻度渲染清空 lifespan layer 导致条带不显示的问题（分离 `_ticksLayer`）
- 修复副作用面板数据修改后内容不同步的问题（`_syncSecondaryPanelContent` 自动刷新）
- 修复颜色编辑器因 `click` 事件重新触发 `_editColor` 导致输入框被反复销毁重建的问题
- 修复 Thumbtack 按钮对无 motion 组件实体仍然显示的问题
- 修复 lifespan bars 在选中实体后丢失的问题（监听 `selectedItem` 和 `pinnedEntities` 变更）

## [0.5.0] - 2026-06-06

### Added

- **时间系统重构** — 引入 `TimeConfig` 全局时间配置和 `TimeUtils` 工具函数，支持自定义年月日换算规则和分辨率级别
- **ECS 组件拆分** — 将臃肿的 `timeline` 组件拆分为 `motion`（运动轨迹）和 `nameHistory`（名称演变），遵循单一职责原则
- **新增 `place` 组件类型** — 固定位置实体（地点、建筑等），自带 `position` 和 `description` 字段
- **Undo/Redo 操作回退** — 通过命令模式重构数据修改流程，所有应用数据修改统一走 `CommandHandler`
- 新增 `CommandHandler.execute()` / `undo()` / `redo()` 方法，基于 `_undoStack` / `_redoStack` 双栈快照管理
- 新增 `CommandHandler._cloneEntities()` 深拷贝函数，自动剥离 Leaflet 运行时属性
- 新增命令工厂 `createEditFieldCommand()` / `createCreateEntityCommand()`
- 快捷键支持：`Ctrl+Z` / `Cmd+Z`（撤销）、`Ctrl+Shift+Z` / `Cmd+Y`（重做）
- 新增 `TimeConfig` 配置模块（纪元起点、年月日换算规则、轨迹窗口、分辨率级别）
- 新增 `TimeUtils` 工具函数（`toOffset`、`lerp`、`compare`、`format`、`isVisible`、`subtract`）
- 途径点数据结构支持 `{ arrival, departure }` 双时间字段，为未来子轨迹展开奠定基础
- 轨迹显示窗口（`trackWindow`）过滤，窗口后 1/3 区域透明渐变避免轨迹生硬消失
- 地图标记实体名称标签，名称颜色随实体主色自动适配
- 新增 `adjustColor()` HSL 颜色调整工具函数
- 实体标记选中高亮效果 — 选中实体时灰色外环变为蓝色发光样式
- 途径点小圆点标记（12px 外环 + 8px 内圆），时间轴拖动时自动更新
- 详情面板单击内联编辑功能，使用 `contenteditable` 替代旧 input/textarea 方案，支持所有文本字段直接编辑
- 侧边栏自动跳转 — 点击地图标记时自动打开侧边栏、切换到资源管理 Tab、展开父面板并滚动到对应项
- 通用 Modal 弹窗系统，支持多种内容变体
- 图标选择器 — 按 `svg_icons_tag` 分组显示图标网格，支持实体 / 系统 / 操作分类
- 颜色选择器 — 原生 color picker 弹出选择
- `motion` 组件途径点名称、描述字段（`name` + `description`）
- `nameHistory` 组件时间线条目（`entries` 数组，含 `time` / `name` / `description`）
- 组件重构设计文档 (`devlog/component-refactor.md`) 和时间系统设计文档 (`devlog/time-system-design.md`)
- `place` 实体右键菜单创建支持
- 新增 `map`、`landmark`、`building`、`city`、`mountain`、`river`、`forest`、`fort`、`tower`、`explorer` SVG 图标
- 新增 `add`、`delete` 图标

### Changed

- 所有时间字段从单一整数改为对象格式 `{ year, month?, day?, hour?, minute? }`
- `state.js` 的 `currentTime` 默认值从 `0` 改为 `{ year: 0 }`，新增 `timeZoomLevel` 状态
- 地图实体标记样式重构为三层结构：28px 灰色外环 → 24px 颜色圆形 → 16px SVG 图标
- 详情面板中 `core` 组件（名称/颜色/默认图标）现在可编辑，不再隐藏
- 内联编辑从双击触发改为单击触发，使用 `contenteditable` 替代 `input`/`textarea` 元素
- 实体地图标记的点击事件改为只在首次创建时注册，避免重复监听
- 标记图标尺寸由 `[24, 24]` 调整为 `[200, 28]`，锚点由 `[12, 12]` 调整为 `[14, 14]`
- `detail.js` 的 `_saveEdit()` 改为发射 `command:execute` 事件，不直接操作 `AppState`
- 右键创建人物纳入命令模式，走 `CommandHandler.execute()`
- 引入 `L.layerGroup` 统一管理所有实体图层，支持 undo/redo 整体替换时清理旧图层
- 途径点插入不再硬过滤，由透明度控制显示，确保跨窗口边界的轨迹线不会生硬中断
- `entities.js` 工厂函数使用 `??` 替代 `||` 处理 `arrival`/`departure` 默认值
- 示例数据全部迁移为 `motion` / `nameHistory` / `place` 组件格式，旧 `timeline` 组件彻底移除
- 详情面板 `<span>` 属性值添加渐变背景和边框，hover 时高亮提示可编辑
- 详情面板数据字段使用 `data-component` + `data-field` 双属性标识，支持任意组件字段编辑
- `person` 组件的 `birthTime` / `deathTime` 编辑支持 `{ year }` 对象格式
- 地图标记点击事件自动打开侧边栏并跳转到对应实体
- `_getComponentRenderer()` 新增 `motion`、`nameHistory`、`place` 渲染器
- `detail.css` 属性值区域添加圆角边框、背景色、hover 高亮和 focus 取消轮廓线

### Removed

- 彻底移除臃肿的旧 `timeline` 组件及其所有消费端分支
- 移除旧的 input/textarea 编辑方案，全面改用 contenteditable
- 移除 `entities.js` 中所有旧 `timeline` 数据兼容代码

### Fixed

- 修复点击地图标记时图标重绘次数翻倍的恶性 bug（`addEventListener` 在每次 `renderTimelineEntities()` 时重复注册）
- 修复 undo/redo 后地图图标越堆越多的问题（实体整体替换后清理旧 Leaflet 图层引用）
- 修复时间轴拖动时 `startTime` 为对象导致的 `[object Object]` 字符串拼接 bug
- 修复 `entities.js` 中 `createRegimeEntity` 缺失分号
- 修复 Font Awesome 格式 SVG 图标（无 width/height 属性）无法显示的问题
- 修复图标选择器滚动溢出问题
- 修复 contenteditable 元素 focus 时出现浏览器默认轮廓线的问题
- 修复 `place` 组件描述字段不可编辑的问题

## [0.4.0] - 2026-05-14

### Added

- 新增 `sidebar.css` 中选择对象的高亮功能
- 新增 `sidebar-content-subitem` 对象的 `color` SVG 颜色图标
- 新增 `organization` 和 `regime` 的示例数据结构
- 在 `contextMenu.js` 中添加 `lastClickLatLng` 变量，便于向事件传递位置参数
- 新增 `commandHandler.js` 文件，负责 `AppState` 中应用数据的修改
- 在 `entities.js` 中新增 `createPersonData()`，返回一个默认人物数据
- 在 `svg-icons.js` 中新增 `initIconsForContainer()`，仅初始化指定容器中的图标

### Changed

- 修改 `sidebar.css` 中的布局格式，并添加选择高亮效果
- 将 `sidebar.js` 中 `init()` 函数中绑定人物事件功能提取为 `_initContentSubitemClick()`
- 将 `persons.js` 文件名修改为 `entities.js`
- 修改 `detail` 面板的布局结构
- `sidebar.js` 中的 `_initContentSubitemClick()` 不再负责更改具体的 DOM 元素，现在由 `_onStateChange()` 统一负责响应

### Fixed

- 修复 `map.js` 中函数 `getEntityPosition()` 当人物只存在一个途径点时函数错误返回 `undefined` 的缺陷
- 修复渲染人物列表时 `.icon` 无法正确显示 SVG 图片的问题
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

- 将上帝脚本 `myMap.html` 拆分为 12 个独立模块（CSS + JS）
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
