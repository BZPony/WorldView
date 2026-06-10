# Waypoint Place Binding 改建设计

## 数据结构变更

```js
// 旧格式
{ lat, lng, name, time: {...}, resolution, description }

// 新格式
{
  pos: { type: 'coords', lat: 30, lng: 110, name: '起源镇' }
    | { type: 'place', entityId: 'place_1' },
  time: { arrival: {...}, departure: {...} },
  resolution,
  description
}
```

## 受影响文件

1. `entities.js` — 示例数据 + `createMotionComponent` + `createPersonData`
2. `map.js` — 所有 `wp.lat/lng/name` → 通过 `getWaypointPosition()` 统一读取
3. `detail.js` — `_createMotionDefault` / `_computeDefaultPosition` / `_openSecondaryPanel`
4. `motion.js` — 主面板渲染
5. `motionItem.js` — 二级面板渲染

## 实施步骤

1. entities.js：`createMotionComponent` 规范化、示例数据转换、`createPersonData` 修改
2. map.js：封装 `_getWaypointPosition(wp)` 统一读取位置，替换所有 `wp.lat/lng/name`
3. detail.js：`_createMotionDefault` 创建 coords 类型、`_computeDefaultPosition` 适配
4. motion.js + motionItem.js：渲染适配