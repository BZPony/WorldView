/**
 * organization 组件渲染器 - 主面板
 */
function renderOrganizationComponent(comp) {
    return `
        <div class="detail-property"><span class="property-label">总部</span><span class="property-value" data-component="organization" data-field="headquarters">${comp.headquarters || '未知'}</span></div>
        <div class="detail-property"><span class="property-label">领袖</span><span class="property-value" data-component="organization" data-field="leader">${comp.leader || '未知'}</span></div>
        <div class="detail-property"><span class="property-label">成员</span><span class="property-value" data-component="organization" data-field="members">${comp.members || '未知'}</span></div>
    `;
}