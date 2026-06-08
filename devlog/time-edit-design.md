# 人物出生/死亡时间精确到日编辑功能

> 创建日期：2026-06-08
> 状态：待实现

---

## 一、背景与动机

目前人物实体（person 组件）的 `birthTime` 和 `deathTime` 仅精确到年（`{ year }` 格式）。为实现更精确的时间线编辑，需将时间精度提升到日（`{ year, month, day }` 格式），并在详情面板中提供独立的年/月/日编辑字段。

## 二、需求描述

### 2.1 数据结构

person 组件中的 `birthTime` 和 `deathTime` 从 `{ year }` 改为 `{ year, month, day }` 格式：

```javascript
// 旧格式
{ year: -50 }

// 新格式
{ year: -50, month: 3, day: 15 }
```

### 2.2 详情面板显示样式

person 组件中"出生时间"和"死亡时间"属性拆分为三个独立的 `.property-value` 元素，分别对应年、月、日：

```
+------------------------------------------+
|  出生时间  [____年] [__月] [__日]          |
|  死亡时间  [____年] [__月] [__日]          |
+------------------------------------------+
```

其中每个 `[____]` 是一个独立的 `.property-value` 元素，显示对应的数字。

### 2.3 编辑方式

每个 `.property-value` 元素默认显示为数字文本（如 "-50年"、"3月"、"15日"）。点击某个元素时触发与现有字段完全相同的 contenteditable 内联编辑流程（`_editText` → `_saveField`）。

### 2.4 保存逻辑

编辑某个分量（年/月/日）后，需要更新整个 `{ year, month, day }` 对象，保持其他分量不变。例如编辑"月"字段时，年和日保持不变。

### 2.5 默认值

数据初始化时，缺省的月默认为 1，缺省的日默认为 1。

## 三、影响范围

| 文件 | 改动内容 | 改动量 |
|------|----------|--------|
| `js/data/entities.js` | `createPersonComponent` 中 `birthTime`/`deathTime` 默认值改为 `{ year, month, day }` | 小 |
| `js/components/view/detail.js` | person 渲染器：出生/死亡时间拆分为三个独立 property-value 字段，带有 `data-field` 标识 | 中 |
| `css/detail.css` | 可能需调整 `.property-value` 在行内多个元素时的间距 | 小 |

## 四、字段命名约定

每个时间分量使用 `data-field` 命名规则：

```
<field>-<part>
```

例如 `birthTime` 字段的三个分量：

- 年：`data-field="birthTime-year"`
- 月：`data-field="birthTime-month"`
- 日：`data-field="birthTime-day"`

`deathTime` 同理：

- 年：`data-field="deathTime-year"`
- 月：`data-field="deathTime-month"`
- 日：`data-field="deathTime-day"`

## 五、保存策略

`_saveField` 中需要识别这种复合命名规则：

1. 检测 `field` 是否包含 `-year` / `-month` / `-day` 后缀
2. 如果是，提取基础字段名（如 `birthTime`）和分量（如 `year`）
3. 读取当前组件中的完整时间对象
4. 仅更新对应分量，其余保持不变
5. 保存完整时间对象

示例：

```javascript
// 用户编辑了 "birthTime-month"，输入值为 "3"
// 原始数据：{ year: -50, month: 1, day: 15 }
// 更新后：{ year: -50, month: 3, day: 15 }
```

## 六、实施步骤

### Step 1：更新实体数据层

- `entities.js` 中 `createPersonComponent` 的默认值改为 `{ year, month, day }` 格式
- 示例数据中所有 `birthTime`/`deathTime` 补全 `month` 和 `day` 字段

### Step 2：更新 person 渲染器

- 将出生/死亡时间从单个 `.property-value` 拆分为三个 `.property-value`
- 每个分量使用 `data-component="person" data-field="<field>-<part>"` 标识
- 显示格式：年显示数字 + "年"，月显示数字 + "月"，日显示数字 + "日"

### Step 3：更新保存逻辑

- `_saveField` 中检测 `-year`/`-month`/`-day` 后缀
- 解析基础字段名和分量名
- 读取当前时间对象，仅更新对应分量
