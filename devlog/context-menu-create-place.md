# 右键创建地点功能

## 当前右键创建人物流程（复述）

```
地图右键 → ContextMenu._onMapRightClick()
  ↓ 保存 latlng、显示菜单
点击"创建人物" → _onMenuItemClick()
  ↓ EventBus.emit('contextMenu:action', { action: 'createPerson', latlng })
CommandHandler._handleContextMenuAction()
  ↓ case 'createPerson' → _handleCreatePerson(latlng)
_handleCreatePerson()
  ↓ createPersonData({ name: "新人物", lat, lng })
  ↓ createCreateEntityCommand({ description, entity, selectAfter: true })
execute()
  ↓ AppState.set('entities', [...entities, entity])
  ↓ AppState.set('selectedItem', { type: 'entity', data: entity })
状态联动
  → DetailPanel 打开 → MapView 渲染 → Sidebar 刷新
```

## 需要创建的 place 实体数据结构

place entity 的组件：

```js
{
  id: 'place_N',
  components: {
    core:    { name: '新地点', color: '#4a90d9', icon: 'place' },
    place:   { position: { lat: xx, lng: yy } }
  }
}
```

- `core` 与其他实体一致
- `place` 组件包含 `position` 经纬度，即右键点击的地图位置

## 需要修改的文件

### 1. `myMap.html` — 添加菜单项

```html
<div class="context-menu-item" data-action="createPlace">创建地点</div>
```

### 2. `js/data/entities.js` — 添加地点创建函数

仿照 `createPersonData`，复用已有的 `createPlaceEntity`：

```js
function createPlaceData({ name, lat, lng }) {
    const newId = Date.now().toString();
    const currentTime = AppState.get('currentTime') || { year: 0, month: 1, day: 1 };
    return createPlaceEntity({
        id: newId,
        name: name,
        color: '#4a90d9',
        icon: 'place',
        position: { lat, lng },
        nameHistory: [{ time: currentTime, name: name }],
        description: '新地点'
    });
}
```

### 3. `js/core/commandHandler.js` — 添加处理逻辑

```js
// 在 _handleContextMenuAction 中添加
case 'createPlace':
    this._handleCreatePlace(latlng);
    break;

// 新增方法
_handleCreatePlace(latlng) {
    const newPlace = createPlaceData({ lat: latlng.lat, lng: latlng.lng });
    const command = this.createCreateEntityCommand({
        description: '创建地点',
        entity: newPlace,
        selectAfter: true
    });
    this.execute(command);
}
```

## 实施步骤

1. `myMap.html` — 添加 `data-action="createPlace"` 菜单项
2. `entities.js` — 添加 `createPlaceData()` 函数
3. `commandHandler.js` — 添加 `case 'createPlace'` + `_handleCreatePlace()`