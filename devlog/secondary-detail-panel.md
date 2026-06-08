# 二级详情面板设计

> 创建日期：2026-06-08
> 状态：待实现

---

## 一、背景与动机

一级详情面板（Primary Panel）以只读+内联编辑的方式展示实体数据。但对于复杂结构（如 motion 的每个 waypoint、nameHistory 的每个条目），用户需要更深入的阅读和编辑体验。二级详情面板（Secondary Panel）为此而生：点击 waypoint-item 等可展开元素时，从左侧滑出一个全新面板，专门展示该条目的完整数据。

## 二、交互流程

```
初始状态：Primary Panel 显示实体详情
    │
    ├── 点击 waypoint-item → Secondary Panel 从左侧滑入
    │   ├── Primary Panel 隐藏（opacity: 0 / pointer-events: none）
    │   ├── Secondary Panel 覆盖在同一位置
    │   └── Secondary Panel 内渲染该 waypoint 的完整详情
    │
    └── 点击 Secondary Panel 关闭按钮 → 逆向
        ├── Secondary Panel 向左滑出
        └── Primary Panel 重新显示
```

## 三、架构设计

### 3.1 Panel Factory

采用 factory 模式创建 Panel 实例。factory 封装的是"可编辑面板"的通用能力：
- 面板开关（`_toggle` / `_updateOpenState`）
- 事件委托与编辑（`_makeEditable` / `_editText` / `_saveField` 等）

渲染逻辑**不共享**，因为 Primary Panel 按 ECS 组件渲染，而 Secondary Panel 渲染扁平数据条目，两者结构不同。

```javascript
function createPanel(config) {
    return {
        elements: {},

        init() {
            // 绑定 DOM 元素（根据 config.containerSelector）
            // 绑定关闭按钮
            // 注册 AppState 监听
            // 事件委托：property-value 单击编辑
        },

        // ───── 面板开关（共享） ─────
        _toggle(open) { AppState.set(config.stateKey, open); },
        _updateOpenState(isOpen) { /* classList.toggle */ },

        // ───── 内联编辑（共享，只定义一次） ─────
        _makeEditable(valueEl) { /* 路由到具体编辑方式 */ },
        _editText(valueEl) { /* contenteditable */ },
        _editColor(valueEl) { /* color picker */ },
        _editIcon(valueEl) { /* modal icon picker */ },
        _saveField({ componentType, field, rawValue }) { /* 保存 */ },

        // ───── 渲染（各自实现，不共享） ─────
        renderDetail(data) {
            // Primary → 遍历 entity.components
            // Secondary → 渲染扁平字段
        }
    };
}
```

### 3.2 Primary 与 Secondary 的差异

| 维度 | Primary Panel | Secondary Panel |
|------|--------------|----------------|
| DOM 容器 | `.detail` | `.detail-secondary` |
| z-index | 999 | 1000 |
| 状态 key | `isDetailPanelOpen` | `isSecondaryPanelOpen` |
| 数据源 | `selectedItem.data.components`（ECS 组件） | `secondaryPanelContent.data`（扁平对象） |
| 渲染方式 | 遍历 components，按 type 分发到渲染器 | 按字段名直接渲染属性行 |
| 关闭时影响 | 自身隐藏 | 自身隐藏 + 恢复 Primary Panel |

### 3.3 DOM 结构

```html
<!-- Primary Panel -->
<aside class="detail">
    <div class="detail-header">
        <button class="detail-toggle-btn--close" id="detail-btn-close">...</button>
    </div>
    <div class="detail-content" id="detail-content"></div>
</aside>

<!-- Secondary Panel -->
<aside class="detail detail-secondary">
    <div class="detail-header">
        <button class="detail-toggle-btn--close" id="detail-secondary-btn-close">...</button>
    </div>
    <div class="detail-content" id="detail-secondary-content"></div>
</aside>
```

### 3.4 CSS

```css
/* Secondary Panel 继承所有 .detail 样式，仅覆盖层级 */
.detail-secondary {
    z-index: 1000;
}

/* Primary Panel 被 Secondary 覆盖时 */
.detail--covered {
    opacity: 0;
    pointer-events: none;
}

/* Secondary Panel 关闭状态 */
.detail-secondary--closed .detail-secondary {
    left: -330px;
}
```

## 四、状态管理

在 `AppState` 中新增：

```javascript
{
    // 已有
    selectedItem: { type: 'entity', data: entity },
    isDetailPanelOpen: boolean,
    
    // 新增
    isSecondaryPanelOpen: boolean,
    secondaryPanelContent: {
        title: string,   // 面板标题，如"途径点详情"
        data: Object     // 要渲染的扁平数据对象的 JavaScript 对象
    }
}
```

## 五、影响范围

| 文件 | 改动内容 | 改动量 |
|------|----------|--------|
| `myMap.html` | 新增 Secondary Panel DOM；初始化时调用两个 panel 的 init | 小 |
| `css/detail.css` | 新增 `.detail-secondary`、`.detail--covered`、`.detail-secondary--closed` | 小 |
| `js/components/view/detail.js` | 重构为 `createPanel()` factory，提取编辑方法；`DetailPanel` 和 `SecondaryDetailPanel` 各自实现 renderDetail | 中 |
| `js/core/state.js` | 新增 `isSecondaryPanelOpen`、`secondaryPanelContent` | 小 |
| `js/components/view/layout.js` | 无需改动（复用 `--detail-left`） | 无 |

## 六、实施步骤

### Step 1：HTML + CSS

1. 在 `myMap.html` 中 Primary Panel 后面添加 Secondary Panel DOM
2. 在 `detail.css` 中添加 `.detail-secondary`、`.detail--covered`、`.detail-secondary--closed`

### Step 2：状态

1. 在 `state.js` 的默认状态中添加 `isSecondaryPanelOpen: false`、`secondaryPanelContent: null`

### Step 3：重构 detail.js

1. 将编辑方法提取到 `createPanel()` factory 中
2. `DetailPanel` 用 factory 创建 + 实现自己的 `renderDetail`（遍历组件渲染）
3. `SecondaryDetailPanel` 用 factory 创建 + 实现自己的 `renderDetail`（扁平字段渲染）
4. 在 `myMap.html` 中初始化两个 panel

### Step 4：触发入口

1. waypoint-item 点击时构造 `secondaryPanelContent` 并打开 Secondary Panel
2. Secondary Panel 关闭时恢复 Primary Panel 显示