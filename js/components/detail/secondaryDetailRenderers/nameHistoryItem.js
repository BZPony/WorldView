/**
 * 二级面板：渲染单个名称变更条目的字段
 * @param {Object} data - 名称变更条目的扁平数据
 * @param {string} compType - 组件类型 'nameHistory'
 * @param {HTMLElement} container - 父容器
 */
function renderNameHistoryItem(data, compType, container) {
    // 先处理 time
    const timeVal = data.time;
    if (timeVal && timeVal.year !== undefined) {
        const y = timeVal.year ?? 0;
        const m = timeVal.month ?? 1;
        const d = timeVal.day ?? 1;
        const row = document.createElement('div');
        row.className = 'detail-property';
        row.innerHTML = `
            <span class="property-label">始于</span>
            <span class="property-value" data-component="${compType}" data-field="time-year">${y}</span><span class="property-value-font">年</span>
            <span class="property-value" data-component="${compType}" data-field="time-month">${m}</span><span class="property-value-font">月</span>
            <span class="property-value" data-component="${compType}" data-field="time-day">${d}</span><span class="property-value-font">日</span>
        `;
        container.appendChild(row);
    }

    // name
    if ('name' in data) {
        const displayValue = data.name != null ? String(data.name) : '未知';
        const row = document.createElement('div');
        row.className = 'detail-property';
        row.innerHTML = `<span class="property-label">名称</span><span class="property-value" data-component="${compType}" data-field="name">${displayValue}</span>`;
        container.appendChild(row);
    }

    // description
    if ('description' in data) {
        const displayValue = data.description != null ? String(data.description) : '未知';
        const row = document.createElement('div');
        row.className = 'detail-property';
        row.innerHTML = `<span class="property-label">描述</span><span class="property-value" data-component="${compType}" data-field="description">${displayValue}</span>`;
        container.appendChild(row);
    }
}