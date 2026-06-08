/**
 * core 组件渲染器
 */

function renderCoreComponent(comp) {
    return `
        <div class="detail-property"><span class="property-label">名称</span><span class="property-value" data-component="core" data-field="name">${comp.name}</span></div>
        <div class="detail-property"><span class="property-label">颜色</span><span class="property-value" data-component="core" data-field="color"><span class="color-swatch" style="background:${comp.color}"></span>${comp.color}</span></div>
        <div class="detail-property"><span class="property-label">默认图标</span><span class="property-value" data-component="core" data-field="icon">${comp.icon}</span></div>
    `;
}