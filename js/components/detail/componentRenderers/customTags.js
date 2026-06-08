/**
 * customTags 组件渲染器 - 主面板
 */
function renderCustomTagsComponent(comp) {
    const tags = comp.tags || [];
    return `<div class="detail-property"><span class="property-label">标签</span><span class="property-value">${tags.join(', ') || '无'}</span></div>`;
}