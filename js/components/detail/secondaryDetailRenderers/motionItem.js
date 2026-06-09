/**
 * 二级面板：渲染单个途径点条目的字段
 * @param {Object} data - 单个 waypoint 的扁平数据对象
 * @param {string} compType - 组件类型 'motion'
 * @param {HTMLElement} container - 父容器
 */
function renderMotionItem(data, compType, container) {
    const fieldLabels = {
        time: '时间', arrival: '抵达时间', departure: '离开时间',
        lat: '纬度', lng: '经度', name: '名称',
        description: '描述', resolution: '精度'
    };
    const fieldOrder = ['name', 'lat', 'lng', 'description', 'resolution'];

    // 先处理 time（含 arrival/departure 的嵌套结构）
    const timeVal = data.time;
    if (timeVal) {
        if (timeVal.arrival !== undefined || timeVal.departure !== undefined) {
            // { arrival, departure } 嵌套
            const zl = AppState.get('timeZoomLevel') || 'year';
            const aStr = timeVal.arrival ? TimeUtils.format(timeVal.arrival, zl) : '—';
            const dStr = timeVal.departure ? TimeUtils.format(timeVal.departure, zl) : '—';
            const row = document.createElement('div');
            row.className = 'detail-property';
            row.innerHTML = `<span class="property-label">时间</span>
                <span class="property-value-font">抵达 </span><span class="time-badge">${aStr}</span>
                <span class="property-value-font">离开 </span><span class="time-badge">${dStr}</span>`;
            container.appendChild(row);
        } else if (timeVal.year !== undefined) {
            // { year, month, day } 时间点
            const y = timeVal.year ?? 0;
            const m = timeVal.month ?? 1;
            const d = timeVal.day ?? 1;
            const row = document.createElement('div');
            row.className = 'detail-property';
            row.innerHTML = `
                <span class="property-label">时间</span>
                <span class="property-value" data-component="${compType}" data-field="time-year">${y}</span><span class="property-value-font">年</span>
                <span class="property-value" data-component="${compType}" data-field="time-month">${m}</span><span class="property-value-font">月</span>
                <span class="property-value" data-component="${compType}" data-field="time-day">${d}</span><span class="property-value-font">日</span>
            `;
            container.appendChild(row);
        }
    }

    // 再处理其他有序字段
    fieldOrder.forEach(key => {
        const displayValue = data[key] != null ? String(data[key]) : '未设置';
        const row = document.createElement('div');
        row.className = 'detail-property';
        row.innerHTML = `<span class="property-label">${fieldLabels[key] || key}</span><span class="property-value" data-component="${compType}" data-field="${key}">${displayValue}</span>`;
        container.appendChild(row);
    });
}