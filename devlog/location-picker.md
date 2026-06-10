# 定位按钮设计文档

## 需求概述

在二级面板（编辑单个途径点时）添加一个"定位"按钮，点击后地图进入选取模式：
- 点击地图空白处 → 获取经纬度 → 设置 `pos: { type: 'coords', lat, lng, name: '' }`
- 点击 place 实体 → 获取实体 ID → 设置 `pos: { type: 'place', entityId }`

## 交互流程

```
用户打开二级面板 → 点击"定位"按钮
  ↓
地图进入选取模式（光标变为 crosshair）
  ↓
用户点击地图：
  1) 点击空白处 → 弹窗确认/直接设置经纬度
  2) 点击 place 实体 → 自动绑定到该实体
  ↓
关闭选取模式
二级面板刷新显示新位置
```

## 涉及的文件

### 1. `js/core/state.js`
新增状态：
```js
isLocationPickerActive: false     // 定位选取模式是否激活
locationPickerTarget: null        // 目标途径点的索引和组件类型 { componentType, index }
```

### 2. `js/components/view/map.js`
新增方法：
- `_enableLocationPicker(target)` — 开启选取模式（设置光标样式、绑定事件）
- `_disableLocationPicker()` — 关闭选取模式（恢复光标、解绑事件）
- `_onLocationPickerClick(e)` — 处理地图点击：
  - 通过 `map.eachLayer` 检测点击位置是否有 place 实体的 marker
  - 如果有 → 获取实体 → 执行命令设置 `pos: { type: 'place', entityId }`
  - 如果没有 → 弹出确认框或直接设置 `pos: { type: 'coords', lat, lng, name: '' }`

在 `init` 中增加对 `isLocationPickerActive` 状态变化的监听。

### 3. `js/components/detail/secondaryDetailRenderers/motionItem.js`
在 `renderPositionFields` 区域添加"定位"按钮：
- 始终显示在位置区域下方（无论 coords/place）
- 按钮样式与现有 waypoint-btn 一致

### 4. `js/components/view/detail.js`
- `SecondaryDetailPanel` 中需要处理从定位选取返回后的刷新

### 5. `css/detail.css`
新增定位按钮样式（可复用现有 `.waypoint-btn` 风格）

### 6. 实现要点

#### place 实体识别
遍历地图上所有 marker，判断点击位置附近是否有 place entity 的 marker：
- 方案：利用 `map.on('click', e)` 获取经纬度 → `map.eachLayer(layer => ...)` 查找最近的 place marker
- 判定距离阈值：约 20px（与 Leaflet 的 click 容差一致）

#### 与选中实体的冲突处理
- 进入选取模式时，临时禁用 `contextmenu` 事件
- 退出选取模式时恢复

#### 命令执行
定位完成后通过 `EventBus.emit('command:execute', ...)` 执行编辑命令，路径格式：
- coords：`['waypoints', index, 'pos']`
- place：`['waypoints', index, 'pos']`

## 实施步骤

1. state.js 添加新状态
2. map.js 添加选取模式逻辑
3. motionItem.js 添加定位按钮 UI
4. detail.js 处理面板刷新
5. detail.css 添加按钮样式（若需要）