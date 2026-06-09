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

    // 再处理其他有序字段
    fieldOrder.forEach(key => {
        const displayValue = data[key] != null ? String(data[key]) : '未设置';
        const row = document.createElement('div');
        row.className = 'detail-property';
        // picker 类型的字段添加 data-picker 标记和 data-value 原始值
        const pickerAttr = key === 'resolution'
            ? ` data-picker data-value="${data[key] ?? ''}"`
            : '';
        row.innerHTML = `<span class="property-label">${fieldLabels[key] || key}</span><span class="property-value" data-component="${compType}" data-field="${key}"${pickerAttr}>${displayValue}</span>`;
        container.appendChild(row);
    });
}