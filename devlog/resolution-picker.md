# Detail Picker 设计文档

## 背景

二级面板中修改 motion waypoint 的 `resolution` 属性时，需要用户手动输入精度字符串（如 `"year"`、`"month"`），不符合人机交互原则。需要改为下拉菜单选择，并且此交互方式应可复用——未来任何需要通过枚举选择修改的属性都可使用同一机制。

## 需求

1. 点击特定属性（如 `resolution`）的 `.property-value` 元素时，弹出悬浮下拉菜单
2. 菜单内容由调用方指定（选项列表 `{label, value}[]`）
3. 点击对应选项后立即保存修改，菜单关闭
4. 菜单失焦（点击外部或按 Escape）时自动关闭，不保存
5. 菜单悬浮于面板之上，不影响面板的排版布局
6. 与现有 `_editText`/`_editColor`/`_editIcon` 风格一致

## 方案选择

### 备选方案对比

| 方案 | 复杂度 | 复用度 | 说明 |
|------|--------|--------|------|
| 复用 ContextMenu | 低 | 低 | ContextMenu 设计为全局地图右键菜单，与属性编辑场景不匹配 |
| 独立 Picker 组件模块 | 中 | 中 | 新增一个可复用的悬浮选择器，适合属性编辑场景 |
| Factory `_editPicker` 通用方法 | 低 | 高 | 与 `_editText`/`_editColor`/`_editIcon` 风格一致，接受 options 参数 |

**选定方案：Factory 通用 `_editPicker` 方法**

`_editPicker(valueEl, options)` 接受 options 数组，分辨率选择时调用 `_editPicker(valueEl, TimeConfig.zoomLevels.map(z => ({label: z.label, value: z.id})))`。

## 实现设计

### 1. `_editPicker(valueEl, options)` 通用方法

```js
_editPicker(valueEl, options) {
    const currentValue = valueEl.dataset.value || valueEl.textContent.trim();

    const menu = document.createElement('div');
    menu.className = 'detail-picker';
    const rect = valueEl.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom) + 'px';

    options.forEach(opt => {
        const item = document.createElement('div');
        item.className = 'detail-picker-item';
        item.textContent = opt.label;
        if (opt.value === currentValue) item.classList.add('selected');
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this._saveField({
                component: valueEl.dataset.component,
                field: valueEl.dataset.field,
                rawValue: opt.value
            });
            cleanup();
        });
        menu.appendChild(item);
    });

    const cleanup = () => { if (document.body.contains(menu)) document.body.removeChild(menu); };
    menu.addEventListener('mousedown', (e) => e.stopPropagation());
    document.addEventListener('mousedown', cleanup, { once: true });
    
    document.body.appendChild(menu);
}
```

### 2. `motionItem.js` — 为 resolution 添加 `data-value`

```html
<span class="property-value" data-component="${compType}" data-field="resolution" data-picker data-value="${data.resolution}">${displayValue}</span>
```

`data-picker` 标记告知 `_makeEditable` 该字段使用下拉菜单。`data-value` 存储原始 id（如 `"year"`），供 `_editPicker` 读取用于高亮当前选项。

### 3. `_makeEditable` 路由

```js
_makeEditable(valueEl) {
    const field = valueEl.dataset.field;
    if (field === 'color') this._editColor(valueEl);
    else if (field === 'icon') this._editIcon(valueEl);
    else if ('picker' in valueEl.dataset) this._editPicker(valueEl, this._getPickerOptions(field));
    else this._editText(valueEl);
}
```

通过 `data-picker` 属性是否存在来判断，不硬编码字段名。

### 4. Picker Options 注册表

在 `DetailPanel` 上注册各字段的 options 获取函数：

```js
DetailPanel._pickerOptions = {
    resolution: () => TimeConfig.zoomLevels.map(z => ({ label: z.label, value: z.id }))
};
DetailPanel._getPickerOptions = function (field) {
    const fn = this._pickerOptions[field];
    return fn ? fn() : [];
};
```

新增字段时只需在此注册即可。

### 5. CSS 样式（新增至 `detail.css`）

```css
.detail-picker {
    position: fixed;
    background: rgba(30, 30, 30, 0.95);
    color: #fff;
    border-radius: 8px;
    padding: 4px 0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    z-index: 5000;
    min-width: 100px;
}
.detail-picker-item {
    padding: 4px 16px;
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
}
.detail-picker-item:hover {
    background: rgba(255, 255, 255, 0.1);
}
.detail-picker-item.selected {
    color: #ffd700;
}
```

## 数据流

```
点击 resolution 行的 .property-value（data-picker 存在）
  → DetailPanel._onClick → _makeEditable(valueEl)
    → _editPicker(valueEl, _getPickerOptions('resolution'))
      → 弹出菜单 → 点击"月"选项
        → _saveField({ component: 'motion', field: 'resolution', rawValue: 'month' })
          → command:execute → _setByPath(component, ['waypoints', 0, 'resolution'], 'month')
          → ✅ 更新完成