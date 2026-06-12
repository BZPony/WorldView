# 动态右键菜单架构

## 现状

右键菜单是静态 HTML 模板，始终显示固定的三行。`ContextMenu._onMapRightClick` → `show(x, y)` — 显示位置 + waypoint 菜单项可用性检查。

## 需求

1. **地图右键**：保持原有三项（创建人物 / 创建地点 / 创建途径点）
2. **Sidebar 实体右键**：仅显示「删除」一项，点击后弹出 Modal 确认弹窗，确认后执行删除命令
3. **架构通用**：后续新增右键场景时，只需注册菜单项配置，无需修改核心逻辑
4. **关键约束**：Sidebar 右键删除的 entity 不一定是当前选中的 entity；删除命令不应关闭面板

## 方案

### 两条删除路径（修正后）

```
路径A（DetailPanel按钮）
  点击 → Modal 确认 → 关闭面板 → EventBus.emit('command:execute', { type: 'deleteEntity', entityId })
    → _handleCommand → _handleDeleteEntity

路径B（Sidebar右键）
  右键 → ContextMenu → EventBus.emit('contextMenu:action', { action: 'deleteEntity', context: { entityId } })
    → _handleContextMenuAction → Modal.openConfirm 确认 → EventBus.emit('command:execute', { type: 'deleteEntity', entityId })
    → _handleCommand → _handleDeleteEntity
```

**`_handleDeleteEntity` 保持原有逻辑不变**（不负责关闭面板）。Sidebar 删除不关闭面板、不修改 selectedItem。

### `CommandHandler._handleContextMenuAction` 中新增 `deleteEntity` case

```js
case 'deleteEntity':
    const entityId = payload.context.entityId;
    const entities = AppState.get('entities') || [];
    const entity = entities.find(e => e.id === entityId);
    if (!entity) break;
    const name = entity.components.core?.name || '未命名实体';
    Modal.openConfirm({
        title: '删除实体',
        message: `确定要删除 <strong>${name}</strong> 吗？`,
        hint: '此操作可通过 Ctrl+Z 撤销。',
        onConfirm: () => {
            EventBus.emit('command:execute', { type: 'deleteEntity', entityId });
        }
    });
    break;
```

### `ContextMenu` 动态架构

| 方法 | 说明 |
|------|------|
| `show(x, y, context)` | 新增 context 参数，调用 `_buildMenuItems` |
| `_buildMenuItems(context)` | 根据 context.type 动态生成 DOM，保存 context 到 `this._context` |
| `_getMenuConfig(context)` | 场景 → 菜单项映射（map / sidebar-entity） |
| `_onItemClick(action)` | 携带 context 发出 `contextMenu:action` 事件 |

### Sidebar 右键绑定

```js
container.addEventListener('contextmenu', (e) => {
    const item = e.target.closest('.sidebar-content-subitem');
    if (!item) return;
    e.preventDefault();
    const entityId = item.dataset.entityId;
    ContextMenu.show(e.clientX, e.clientY, { type: 'sidebar-entity', entityId });
});
```

## 需要修改的文件

| 文件 | 改动 |
|------|------|
| `js/components/view/contextMenu.js` | 动态菜单架构：`_buildMenuItems`、`_getMenuConfig`、传递 context |
| `js/components/view/sidebar.js` | 绑定 `contextmenu` 事件 |
| `js/core/commandHandler.js` | `_handleContextMenuAction` 新增 `deleteEntity` case |
| `myMap.html` | 清空静态菜单项 |

## 实施步骤

1. `contextMenu.js` — 动态菜单架构
2. `myMap.html` — 清空 `#context-menu` 内部静态项
3. `commandHandler.js` — `_handleContextMenuAction` 增加 `deleteEntity` case
4. `sidebar.js` — 绑定 `contextmenu` 事件