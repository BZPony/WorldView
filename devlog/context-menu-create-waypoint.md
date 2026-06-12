# 右键创建途径点功能

## 现有创建途径点流程（DetailPanel 中）

```
DetailPanel.init() → 监听点击事件
  ↓ btn = e.target.closest('.waypoint-btn')
_handleWaypointAction(btn)
  ↓ action = btn.dataset.action
  ↓ index = action === 'add-first-wp' ? -1 : parseInt(btn.dataset.wpIndex)
_addWaypoint(entity, 'motion', afterIndex)
  ↓ items = entity.components.motion.waypoints
  ↓ newItem = _createMotionDefault(items, afterIndex)
  ↓     → zoomLevel = AppState.get('timeZoomLevel')
  ↓     → step = TimeUtils.getResolutionStep()
  ↓     → defaultTime = _computeDefaultTime(items, afterIndex, step, ...)
  ↓     → defaultPos = _computeDefaultPosition(items, afterIndex)
  ↓     → return { time, pos: { type: 'coords', lat, lng, name }, description, resolution }
  ↓ newValue = [...items]; newValue.splice(afterIndex+1, 0, newItem)
EventBus.emit('command:execute', { type: 'editEntityField', entityId, componentType: 'motion', path: ['waypoints'], oldValue, newValue })
CommandHandler._handleCommand → createEditFieldCommand → execute()
```

## 方案

### 关键差异

| 人物/地点 | Waypoint |
|-----------|----------|
| 创建新实体 | 修改现有实体的 waypoints 数组 |
| `createCreateEntityCommand` | `createEditFieldCommand` |
| `createPersonData(latlng)` | 复用 `DetailPanel._createMotionDefault` |

### 菜单可用条件

仅当 `AppState.selectedItem` 存在且 `selectedItem.data.components.motion` 存在时，菜单项可用。否则菜单项置灰。

### 右键点击时执行

1. 在当前 `selectedItem` 的 waypoints 找到离开时间小于当前时间的最后一个 waypoint，在其后插入
2. 位置取右键点击的 `latlng`
3. 时间取 `AppState.currentTime`
4. 通过 `editEntityField` 命令执行

## 需要修改的文件

### 1. `js/components/view/contextMenu.js` — 显示前检查

```js
show(x, y) {
    const waypointItem = this.menu.querySelector('[data-action="createWaypoint"]');
    if (waypointItem) {
        const selectedItem = AppState.get('selectedItem');
        const hasMotion = selectedItem && selectedItem.data.components.motion;
        waypointItem.classList.toggle('context-menu-item--disabled', !hasMotion);
    }
    // ... 原有显示逻辑
}
```

### 2. `css/context-menu.css` — 添加置灰样式

```css
.context-menu-item--disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
}
```

### 3. `js/core/commandHandler.js` — 添加处理

```js
case 'createWaypoint':
    this._handleCreateWaypoint(latlng);
    break;

_handleCreateWaypoint(latlng) {
    const selectedItem = AppState.get('selectedItem');
    if (!selectedItem) return;
    const entity = selectedItem.data;
    const waypoints = entity.components.motion?.waypoints;
    if (!waypoints) return;

    const items = waypoints;
    const currentTime = AppState.get('currentTime') || { year: 0 };
    const newItem = DetailPanel._createMotionDefault(items, items.length - 1);
    newItem.time = {
        arrival: { ...currentTime },
        departure: { ...currentTime }
    };
    newItem.pos = { type: 'coords', lat: latlng.lat, lng: latlng.lng, name: '新途径点' };

    // 按时间插入：找到离开时间小于当前时间的最后一个 waypoint，在其后插入
    let insertIdx = items.length;
    for (let i = 0; i < items.length; i++) {
        const dep = items[i].time.departure || items[i].time.arrival || items[i].time;
        if (TimeUtils.compare(dep, currentTime) > 0) {
            insertIdx = i;
            break;
        }
    }

    const oldValue = JSON.parse(JSON.stringify(items));
    const newValue = [...items];
    newValue.splice(insertIdx, 0, newItem);

    EventBus.emit('command:execute', {
        type: 'editEntityField',
        entityId: entity.id,
        componentType: 'motion',
        path: ['waypoints'],
        oldValue,
        newValue
    });
}
```

### 4. `myMap.html` — 已存在，无需修改

```html
<div class="context-menu-item" data-action="createWaypoint">创建途径点</div>
```

## 实施步骤

1. `contextMenu.js` — 在 `show()` 中控制菜单项可用性
2. `context-menu.css` — 添加禁用样式
3. `commandHandler.js` — 添加 `case 'createWaypoint'` + `_handleCreateWaypoint()`
