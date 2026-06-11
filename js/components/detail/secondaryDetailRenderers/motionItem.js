/**
 * 二级面板：渲染单个途径点条目的字段
 * @param {Object} data - 单个 waypoint 的数据对象
 * @param {string} compType - 组件类型 'motion'
 * @param {HTMLElement} container - 父容器
 */
function renderMotionItem(data, compType, container) {
    // 处理 arrival / departure 时间
    const timeVal = data.time;
    if (timeVal) {
        // 抵达时间
        if (timeVal.arrival) {
            const a = timeVal.arrival;
            const row = document.createElement('div');
            row.className = 'detail-property';
            row.innerHTML = `
                <span class="property-label">抵达时间</span>
                <span class="property-value" data-component="${compType}" data-field="arrival-year">${a.year ?? 0}</span><span class="property-value-font">年</span>
                <span class="property-value" data-component="${compType}" data-field="arrival-month">${a.month ?? 1}</span><span class="property-value-font">月</span>
                <span class="property-value" data-component="${compType}" data-field="arrival-day">${a.day ?? 1}</span><span class="property-value-font">日</span>
            `;
            container.appendChild(row);
        }

        // 离开时间
        if (timeVal.departure) {
            const d = timeVal.departure;
            const row = document.createElement('div');
            row.className = 'detail-property';
            row.innerHTML = `
                <span class="property-label">离开时间</span>
                <span class="property-value" data-component="${compType}" data-field="departure-year">${d.year ?? 0}</span><span class="property-value-font">年</span>
                <span class="property-value" data-component="${compType}" data-field="departure-month">${d.month ?? 1}</span><span class="property-value-font">月</span>
                <span class="property-value" data-component="${compType}" data-field="departure-day">${d.day ?? 1}</span><span class="property-value-font">日</span>
            `;
            container.appendChild(row);
        }
    }

    // 处理位置 —— 根据 pos 类型决定 UI
    renderPositionFields(data, compType, container);

    // 描述
    const descRow = document.createElement('div');
    descRow.className = 'detail-property';
    descRow.innerHTML = `<span class="property-label">描述</span><span class="property-value" data-component="${compType}" data-field="description">${data.description || '未设置'}</span>`;
    container.appendChild(descRow);

    // 精度
    let resDisplay, resPickerAttr;
    if (data.resolution) {
        const zl = TimeConfig.zoomLevels.find(z => z.id === data.resolution);
        resDisplay = zl ? zl.label : String(data.resolution);
        resPickerAttr = ` data-picker data-value="${data.resolution}"`;
    } else {
        resDisplay = '未设置';
        resPickerAttr = '';
    }
    const resRow = document.createElement('div');
    resRow.className = 'detail-property';
    resRow.innerHTML = `<span class="property-label">精度</span><span class="property-value" data-component="${compType}" data-field="resolution"${resPickerAttr}>${resDisplay}</span>`;
    container.appendChild(resRow);
}

/**
 * 渲染位置字段，根据 pos 类型显示不同 UI
 *   coords：显示可编辑的 经度/纬度/名称
 *   place： 显示只读的 place entity 名称
 */
function renderPositionFields(data, compType, container) {
    const pos = data.pos;

    if (pos.type === 'coords') {
        renderCoordsFields(pos.lat, pos.lng, pos.name, compType, container);
    } else if (pos.type === 'place') {
        renderPlaceField(pos.entityId, compType, container);
    }
    renderLocateButton(data._index, container);
}

/**
 * 渲染"定位"按钮
 */
function renderLocateButton(index, container) {
    const btnRow = document.createElement('div');
    btnRow.className = 'waypoint-btn-group';
    btnRow.innerHTML = `<button class="waypoint-btn" data-action="locate" data-wp-index="${index}">${getIcon('crosshair', 14)}</button>`;
    container.appendChild(btnRow);
}

function renderCoordsFields(lat, lng, name, compType, container) {
    // 纬度/经度行
    const posRow = document.createElement('div');
    posRow.className = 'detail-property';
    posRow.innerHTML = `
        <span class="property-label">位置</span>
        <span class="property-value-font">纬度 </span>
        <span class="property-value" data-component="${compType}" data-field="pos-lat">${lat != null ? Number(lat).toFixed(3) : 0}</span>
        <span class="property-value-font">经度</span>
        <span class="property-value" data-component="${compType}" data-field="pos-lng">${lng != null ? Number(lng).toFixed(3) : 0}</span>
    `;
    container.appendChild(posRow);

    // 名称行
    const nameRow = document.createElement('div');
    nameRow.className = 'detail-property';
    nameRow.innerHTML = `<span class="property-label">名称</span><span class="property-value" data-component="${compType}" data-field="pos-name">${name || ''}</span>`;
    container.appendChild(nameRow);
}

function renderPlaceField(entityId, compType, container) {
    const entities = AppState.get('entities') || [];
    const place = entities.find(e => e.id === entityId);
    const placeName = (place && place.components.core) ? place.components.core.name : (entityId || '未知');

    const row = document.createElement('div');
    row.className = 'detail-property';
    // 使用 data-field="pos-place" 标记，但无 data-component 可编辑属性（只读）
    row.innerHTML = `<span class="property-label">位置</span><span class="property-value property-value--readonly">${placeName}</span>`;
    container.appendChild(row);
}
