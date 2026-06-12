# 实体删除功能设计文档

## 需求概述

在一级面板右上角添加删除按钮，仿照现有关闭按钮的格式，红色主题。点击后弹出确认框，确认后先关闭一级面板，再删除当前选中的实体。

## UI 设计

### 按钮位置

关闭按钮和删除按钮纵向排列，关闭在上，删除在下：

```
<div class="detail-header">
    <button class="detail-toggle-btn--close" id="detail-btn-close">
        <span class="icon" data-name="cross"></span>
    </button>
    <button class="detail-toggle-btn--delete" id="detail-btn-delete">
        <span class="icon" data-name="delete"></span>
    </button>
</div>
```

### 按钮样式（detail.css）

```css
.detail-toggle-btn--delete {
    position: absolute;
    top: 48px;      /* 紧接关闭按钮下方 10+32+6 */
    right: 10px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: rgba(200, 40, 40, 0.75);
    border: 1px solid rgba(255, 80, 80, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ff6b6b;
    cursor: pointer;
    z-index: 1001;
    transition: all var(--animation-duration) ease;
}

.detail-toggle-btn--delete:hover {
    background-color: rgba(220, 30, 30, 0.9);
    border-color: rgba(255, 100, 100, 0.6);
    transform: scale(1.1);
}
```

## 交互流程

```
用户查看一级面板中的实体
  ↓
点击红色删除按钮
  ↓
Modal 弹窗确认："确定要删除 [实体名称] 吗？" → 取消 / 确认
  ↓ 确认
先关闭一级面板（AppState.set('selectedItem', null)）
若存在二级面板同时关闭（AppState.set('isSecondaryPanelOpen', false)）
  ↓
CommandHandler 执行删除命令（从 entities 中移除该实体）
  ↓
MapView 重新渲染（移除 marker 和轨迹）
```

## 确认框复用

复用现有的 `Modal` 模块（`js/components/view/modal.js`）。`Modal.open()` 支持自定义标题和正文。在 `DetailPanel.init()` 中绑定删除按钮：

```js
const btnDelete = document.querySelector('#detail-btn-delete');
btnDelete.addEventListener('click', () => {
    const selectedItem = AppState.get('selectedItem');
    if (!selectedItem) return;
    const entity = selectedItem.data;
    const name = entity.components.core.name || '未命名实体';
    Modal.open({
        title: '删除实体',
        body: `<p>确定要删除 <strong>${name}</strong> 吗？此操作可通过 Ctrl+Z 撤销。</p>`,
        onConfirm: () => {
            // 先关闭面板
            AppState.set('isSecondaryPanelOpen', false);
            AppState.set('selectedItem', null);
            // 再执行删除命令
            EventBus.emit('command:execute', {
                type: 'deleteEntity',
                entityId: entity.id
            });
        }
    });
});
```

## 涉及的文件

### 1. myMap.html

一级面板 `.detail-header` 中添加删除按钮 HTML。

### 2. css/detail.css

新增 `.detail-toggle-btn--delete` 及 hover 样式（纵向排列在关闭按钮下方）。

### 3. js/core/commandHandler.js

`_handleCommand` 中新增 `deleteEntity` case：

```js
case 'deleteEntity':
    this._handleDeleteEntity(payload.entityId);
    break;
```

新增 `_handleDeleteEntity(entityId)` 方法：

```js
_handleDeleteEntity(entityId) {
    const entities = AppState.get('entities');
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return;
    this.execute({
        type: 'deleteEntity',
        description: `删除实体 ${entity.components.core?.name || entityId}`,
        execute: () => {
            AppState.set('entities', entities.filter(e => e.id !== entityId));
        }
    });
}
```

### 4. js/components/view/detail.js

在 `DetailPanel.init()` 中获取删除按钮并绑定点击事件。

## 实施步骤

1. myMap.html — 添加删除按钮 HTML
2. detail.css — 添加红色按钮样式（纵向排列）
3. commandHandler.js — 新增 deleteEntity 命令
4. detail.js — 绑定删除按钮点击事件

## 执行顺序

**先关闭面板，后删除实体**，防止 `_syncSelectedItem` / `_syncSecondaryPanelContent` 在实体已被删除后仍尝试读取数据导致渲染错误。
