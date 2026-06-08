/**
 * regime 组件渲染器 - 主面板
 */
function renderRegimeComponent(comp) {
    return `
        <div class="detail-property"><span class="property-label">首都</span><span class="property-value" data-component="regime" data-field="capital">${comp.capital || '未知'}</span></div>
        <div class="detail-property"><span class="property-label">人口</span><span class="property-value" data-component="regime" data-field="population">${comp.population || '未知'}</span></div>
        <div class="detail-property"><span class="property-label">政体</span><span class="property-value" data-component="regime" data-field="governmentType">${comp.governmentType || '未知'}</span></div>
    `;
}