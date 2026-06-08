/**
 * 渲染器聚合文件
 * 按组件类型导入所有渲染器，挂载到 window 对象上供 detail.js 使用。
 *
 * 每个组件类型的渲染器文件应导出两个函数：
 *   render<Type>Component(comp)      — Primary Panel 组件级渲染（返回 HTML 字符串）
 *   render<Type>Entry(data, compType) — Secondary Panel 条目级渲染（返回 HTMLElement）
 */

// 渲染器按组件类型独立维护，新增组件类型只需在此目录下新建文件