/**
 * place 组件渲染器 - 主面板
 */
function renderPlaceComponent(comp) {
    const pos = comp.position;
    return `
        <div class="detail-property"><span class="property-label">位置</span><span class="property-value">${pos ? `(${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)})` : '未知'}</span></div>
        <div class="detail-property"><span class="property-label">描述</span><span class="property-value" data-component="place" data-field="description">${comp.description || '无'}</span></div>
    `;
}