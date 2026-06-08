# 二级面板编辑功能设计

> 创建日期：2026-06-08
> 状态：待实现

---

## 一、背景与动机

目前二级详情面板（Secondary Panel）的渲染函数过于简陋，使用通用的 `Object.entries()` 遍历数据对象的键值对，生成的 `.property-value` 元素没有携带 `data-component` 和 `data-field` 属性。

缺少这些属性导致两个问题：

1. **无法编辑** — `_makeEditable` 通过 `valueEl.dataset.field` 判断字段类型，缺失此属性时单击不触发编辑
2. **无法区分字段类型** — 时间字段（`time`、`arrival`、`departure`）被当作普通字符串显示，没有像 Primary Panel 那样拆分为独立的年/月/日组件

## 二、目标

为 Secondary Panel 中的每个属性字段生成与 Primary Panel 相同结构的 `data-component` / `data-field` 属性，使其具备相同的编辑能力。

## 三、数据来源

Secondary Panel 展示的数据来自 `_openSecondaryPanel` 中构造的扁平对象：

```javascript
// motion waypoint 的 data 对象示例
{
    time: { arrival: { year: 0, month: 6, day: 15 }, departure: { year: 0, month: 6, day: 15 } },
    lat: 30,
    lng: 110,
    name: '起源镇',
    description: '在此地结识了第一位同伴',
    resolution: 'day',
    _componentType: 'motion',   // 内部字段，过滤
    _index: 0                    // 内部字段，过滤
}

// nameHistory entry 的 data 对象示例
{
    time: { year: -300 },
    name: '拜占庭',
    description: '古希腊殖民城市',
    _componentType: 'nameHistory',
    _index: 0
}
```

## 四、字段到 data-* 属性的映射规则

### 4.1 简单标量字段（lat, lng, name, description, resolution）

按字段名直接映射：

| 数据字段 | data-component | data-field | 显示 |
|---------|---------------|-----------|------|
| `lat` | `motion` | `lat` | 数值 |
| `lng` | `motion` | `lng` | 数值 |
| `name` | `motion` | `name` | 文本 |
| `description` | `motion` | `description` | 文本 |
| `resolution` | `motion` | `resolution` | 文本 |

### 4.2 嵌套时间对象（time, arrival, departure）

对于 `{ year, month, day }` 或 `{ year }` 格式的时间对象，拆分为三个独立元素：

```
[year]年 [month]月 [day]日
```

每个分量独立携带 data-field：

| 元素 | data-component | data-field |
|------|---------------|-----------|
| year | 基础字段名（如 `time`） | `time-year` |
| month 单位 | — | `property-value-font` |
| month | 基础字段名 | `time-month` |
| day 单位 | — | `property-value-font` |
| day | 基础字段名 | `time-day` |

对于 `motion` 组件中的 `time.arrival` / `time.departure`，字段名使用 `<父字段>-<子字段>` 格式：

| 渲染的字段 | data-field |
|-----------|-----------|
| arrival | `arrival`（作为整体用 `TimeUtils.format` 显示） |
| departure | `departure` |

### 4.3 data-component 的来源

`_componentType` 存储在 data 对象中，用于设置 `data-component` 属性的默认值。

## 五、渲染逻辑伪代码

```
renderDetail(content):
    1. 提取 title 和 data，过滤 _componentType 和 _index
    2. 为每个字段生成属性行：

    switch field:
    case 'time'/'arrival'/'departure':
        如果值是 { year, month, day } 对象:
            生成三个 .property-value（年/月/日）+ .property-value-font
        else:
            生成单个 .property-value

    case 'lat'/'lng'/'name'/'description'/'resolution':
        生成单个 .property-value，直接显示字符串/数值

    每个 .property-value 携带：
        data-component={_componentType}
        data-field={fieldName}(-year/-month/-day 如果已拆分)
```

## 六、影响范围

| 文件 | 改动内容 | 改动量 |
|------|----------|--------|
| `js/components/view/detail.js` | 重写 `SecondaryDetailPanel.renderDetail` | 中 |

现有 Primary Panel 的渲染器和编辑逻辑均无需改动。