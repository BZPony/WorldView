/**
 * nameHistory 组件渲染器 - 主面板
 * @param {Object} comp - nameHistory 组件对象
 * @param {Object} helpers - { entity, zoomLevel, isWaypointOutsideLifespan }
 */
function renderNameHistoryComponent(comp, helpers) {
    const zoomLevel = (helpers && helpers.zoomLevel) || 'year';
    const addIcon = getIcon('add', 14);

    const firstAdd = `<li class="waypoint-item waypoint-add-first" title="在开头创建条目">
        <button class="waypoint-btn" data-action="add-first-wp" data-component="nameHistory">${addIcon}</button>
    </li>`;

    if (!comp.entries || comp.entries.length === 0) {
        return `<ul class="detail-waypoint-list">${firstAdd}</ul>`;
    }

    const listItems = comp.entries.map((e, idx) => {
        const timeStr = TimeUtils.format(e.time, e.time.month ? (e.time.day ? 'day' : 'month') : zoomLevel);
        return `<li class="waypoint-item" data-component="nameHistory" data-wp-index="${idx}">
            <div class="waypoint-item-content">
                <div class="waypoint-name-row">${e.name}</div>
                <div class="waypoint-time-row"><span class="time-label">始于</span><span class="time-badge">${timeStr}</span></div>
                ${e.description ? `<div class="waypoint-desc-row">${e.description}</div>` : ''}
            </div>
            <div class="waypoint-btn-group">
                <button class="waypoint-btn" data-action="delete-wp" data-wp-index="${idx}" title="删除">${getIcon('delete', 12)}</button>
                <button class="waypoint-btn" data-action="add-after-wp" data-wp-index="${idx}" title="在此后插入">${getIcon('add', 12)}</button>
            </div>
        </li>`;
    }).join('');
    return `<ul class="detail-waypoint-list">${firstAdd}${listItems}</ul>`;
}