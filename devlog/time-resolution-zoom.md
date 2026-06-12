# 时间分辨率缩放系统

## 整体架构

全局时间分辨率存于 `AppState.state.timeZoomLevel`（默认 `'year'`）。分辨率级别定义在 `TimeConfig.zoomLevels`，数组索引越大精度越高：

```
era → century → decade → year → halfyear → season → month → week → day → hour → minute
```

缩放即沿此数组上下移动索引值。

---

## 第一步：缩放按钮

### 位置
时间轴 `.timeline-container` 右侧，垂直排列两个按钮：放大（↑）和缩小（↓）。不占用时间轴内部空间，紧贴时间轴右边缘外侧。

```
+------------------------------------------+
|             timeline container            |  ↑ (放大)
+------------------------------------------+  ↓ (缩小)
```

### HTML
在 `myMap.html` 中，时间轴容器后添加：

```html
<div class="timeline-zoom-btns" id="timeline-zoom-btns">
    <button class="timeline-zoom-btn timeline-zoom-btn--in" id="timeline-zoom-in" title="放大分辨率">
        <span class="icon" data-name="zoomIn"></span>
    </button>
    <button class="timeline-zoom-btn timeline-zoom-btn--out" id="timeline-zoom-out" title="缩小分辨率">
        <span class="icon" data-name="zoomOut"></span>
    </button>
</div>
```

### CSS（timeline.css）
按钮容器与时间轴并列，样式仿照关闭按钮的液态玻璃风格：

```css
.timeline-zoom-btns {
    position: fixed;
    bottom: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 1000;
    /* left 由 JS 动态计算 = timeline 右边 + 间距 */
}

.timeline-zoom-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: rgba(25, 25, 25, 0.75);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    transition: all var(--animation-duration) ease;
}

.timeline-zoom-btn:hover {
    background-color: rgba(100, 100, 100, 0.8);
    transform: scale(1.1);
}

.timeline-zoom-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    pointer-events: none;
}
```

### 交互逻辑
- 放大按钮：`zoomIndex + 1`（精度增加），上限 `zoomLevels.length - 1`
- 缩小按钮：`zoomIndex - 1`（精度减少），下限 `0`
- 到达边界时按钮置灰（`disabled`）
- 点击后更新 `AppState.set('timeZoomLevel', newId)`

### JS 实现（Timeline 或独立模块）
点击放大/缩小 → `EventBus.emit('timeline:zoomIn')` / `EventBus.emit('timeline:zoomOut')` → `AppState.set('timeZoomLevel', ...)`

### 图标
需要添加 `zoomIn` 和 `zoomOut` 两个 SVG 图标到 `svg-icons.js`。

---

## 第二步：时间轴随时间分辨率缩放

设计待定，由用户后续补充。

---

## 第三步：waypoint 根据全局分辨率判断可见性

设计待定，由用户后续补充。

---

## 实施步骤（仅第一步）

1. `svg-icons.js` — 添加 `zoomIn` / `zoomOut` 图标
2. `myMap.html` — 添加缩放按钮 HTML
3. `css/timeline.css` — 添加按钮样式
4. `js/components/view/timeline.js` — 绑定按钮事件，更新 `timeZoomLevel` 状态