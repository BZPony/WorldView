/**
 * person 组件渲染器 - 主面板
 */
function renderPersonComponent(comp) {
    const bt = comp.birthTime || { year: 0, month: 1, day: 1 };
    const dt = comp.deathTime || { year: 0, month: 1, day: 1 };
    return `
        <div class="detail-property"><span class="property-label">出生时间</span>
            <span class="property-value" data-component="person" data-field="birthTime-year">${bt.year}</span><span class="property-value-font">年</span>
            <span class="property-value" data-component="person" data-field="birthTime-month">${bt.month}</span><span class="property-value-font">月</span>
            <span class="property-value" data-component="person" data-field="birthTime-day">${bt.day}</span><span class="property-value-font">日</span>
        </div>
        <div class="detail-property"><span class="property-label">死亡时间</span>
            <span class="property-value" data-component="person" data-field="deathTime-year">${dt.year}</span><span class="property-value-font">年</span>
            <span class="property-value" data-component="person" data-field="deathTime-month">${dt.month}</span><span class="property-value-font">月</span>
            <span class="property-value" data-component="person" data-field="deathTime-day">${dt.day}</span><span class="property-value-font">日</span>
        </div>
        <div class="detail-property"><span class="property-label">性别</span><span class="property-value" data-component="person" data-field="gender">${comp.gender ?? '未知'}</span></div>
        <div class="detail-property"><span class="property-label">描述</span><span class="property-value" data-component="person" data-field="description">${comp.description || '无'}</span></div>
    `;
}