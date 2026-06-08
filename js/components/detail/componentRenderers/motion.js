/**
 * motion 组件渲染器 - 主面板
 * @param {Object} comp - motion 组件对象
 * @param {Object} helpers - { entity, zoomLevel, isWaypointOutsideLifespan }
 * @returns {string} HTML 字符串
 */
function renderMotionComponent(comp, helpers) {
    const entity = helpers.entity;
    const zoomLevel = helpers.zoomLevel || 'year';
    const addIcon = getIcon('add', 14);

    const firstAdd = `<li class="waypoint-item waypoint-add-first" title="在开头创建途径点">
        <button class="waypoint-btn" data-action="add-first-wp" data-component="motion">${addIcon}</button>
    </li>`;

    if (!comp.waypoints || comp.waypoints.length === 0) {
        return `<ul class="detail-waypoint-list">${firstAdd}</ul>`;
    }

    const listItems = comp.waypoints.map((wp, idx) => {
        const isOutside = entity ? helpers.isWaypointOutsideLifespan(entity, wp.time.arrival || wp.time.departure || wp.time) : false;
        const cls = isOutside ? 'waypoint-item waypoint-outside-lifespan' : 'waypoint-item';
        const arrival = wp.time.arrival || wp.time.departure || wp.time;
        const departure = wp.time.departure || wp.time.arrival || wp.time;
        const wpZoom = wp.resolution || zoomLevel;
        const arrivalStr = TimeUtils.format(arrival, wpZoom);
        const departureStr = TimeUtils.format(departure, wpZoom);
        const locationStr = wp.name || `(${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)})`;
        const descStr = wp.description || '';
        return `<li class="${cls}" data-component="motion" data-wp-index="${idx}">
            <div class="waypoint-item-content">
                <div class="waypoint-name-row">${locationStr}</div>
                <div class="waypoint-time-row"><span class="time-label">抵达</span><span class="time-badge">${arrivalStr}</span><span class="time-label">离开</span><span class="time-badge">${departureStr}</span></div>
                ${descStr ? `<div class="waypoint-desc-row">${descStr}</div>` : ''}
            </div>
            <div class="waypoint-btn-group">
                <button class="waypoint-btn" data-action="delete-wp" data-wp-index="${idx}" title="删除">${getIcon('delete', 12)}</button>
                <button class="waypoint-btn" data-action="add-after-wp" data-wp-index="${idx}" title="在此后插入">${getIcon('add', 12)}</button>
            </div>
        </li>`;
    }).join('');
    return `<ul class="detail-waypoint-list">${firstAdd}${listItems}</ul>`;
}