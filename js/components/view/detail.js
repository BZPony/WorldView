/**
 * 详情面板工厂
 * 创建可编辑的详情面板实例。Primary Panel 和 Secondary Panel 共享所有编辑方法，
 * 但渲染逻辑各自独立（Primary 按 ECS 组件渲染，Secondary 按扁平数据渲染）。
 */

/**
 * 创建一个详情面板实例
 * @param {Object} config
 *   - stateKey：AppState 中控制面板开关的 key
 *   - bodyClosedClass：面板关闭时 body 上的 CSS 类名
 *   - allowEdit：是否启用编辑（事件委托），默认 false（secondary 不编辑）
 * @returns {Object}
 */
function createDetailPanel(config) {
    const panel = {
        config,
        elements: {},

        // ───── 初始化 ─────

        /**
         * @param {Object} opts
         *   - containerSelector：DOM 容器选择器
         *   - contentSelector：内容区 DOM 选择器
         *   - btnCloseSelector：关闭按钮 DOM 选择器
         *   - allowEdit：是否启用编辑（默认 false）
         */
        init(opts) {
            this.elements.body = document.body;
            this.elements.panel = document.querySelector(opts.containerSelector);
            this.elements.content = document.querySelector(opts.contentSelector);
            this.elements.btnClose = document.querySelector(opts.btnCloseSelector);
            this._allowEdit = opts.allowEdit !== false;

            // 关闭按钮
            this.elements.btnClose.addEventListener('click', () => this._toggle(false));

            // 监听 AppState
            EventBus.on('state:change', this._onStateChange.bind(this));

            // 编辑事件委托
            this.elements.content.addEventListener('click', (e) => {
                if (!this._allowEdit) return;
                const valueEl = e.target.closest('.property-value');
                if (valueEl && valueEl.dataset.field) {
                    this._makeEditable(valueEl);
                }
            });
        },

        // ───── 状态响应 ─────

        /**
         * 子类必须覆盖此方法，处理自己关注的状态变化
         */
        _onStateChange(data) {
            // 在子类实例中覆盖
        },

        // ───── 面板开关 ─────

        _toggle(open) {
            AppState.set(this.config.stateKey, open);
        },

        _updateOpenState(isOpen) {
            this.elements.body.classList.toggle(this.config.bodyClosedClass, !isOpen);
        },

        // ───── 内联编辑 ─────

        _makeEditable(valueEl) {
            const field = valueEl.dataset.field;
            if (field === 'color') this._editColor(valueEl);
            else if (field === 'icon') this._editIcon(valueEl);
            else this._editText(valueEl);
        },

        _editColor(valueEl) {
            const input = document.createElement('input');
            input.type = 'color';
            const colorMatch = valueEl.textContent.match(/#[0-9a-fA-F]{6}/);
            input.value = colorMatch ? colorMatch[0] : '#4f454f';
            input.className = 'detail-edit-color';
            input.style.cssText = 'position:absolute;opacity:0;pointer-events:none';
            input.dataset.component = valueEl.dataset.component;
            input.dataset.field = 'color';
            document.body.appendChild(input);

            const cleanup = () => { if (document.body.contains(input)) document.body.removeChild(input); };
            input.addEventListener('input', () => {
                this._saveField({ component: input.dataset.component, field: 'color', rawValue: input.value });
                cleanup();
            });
            input.addEventListener('blur', () => {
                this.renderDetail(this._lastData);
                cleanup();
            });
            input.click();
        },

        _editIcon(valueEl) {
            const currentIcon = valueEl.textContent.trim() || 'tag';
            Modal.openIconPicker(currentIcon, (newIcon) => {
                if (currentIcon === newIcon) return;
                const selectedItem = AppState.get('selectedItem');
                if (!selectedItem) return;
                EventBus.emit('command:execute', {
                    type: 'editEntityField',
                    entityId: selectedItem.data.id,
                    componentType: 'core', field: 'icon',
                    oldValue: currentIcon, newValue: newIcon
                });
            });
        },

        _editText(valueEl) {
            const currentText = valueEl.textContent;
            const isPlaceholder = currentText === '未知' || currentText === '无';

            valueEl.contentEditable = true;
            valueEl.textContent = isPlaceholder ? '' : currentText;
            valueEl.focus();

            if (typeof window.getSelection !== 'undefined' && typeof document.createRange !== 'undefined') {
                const range = document.createRange();
                range.selectNodeContents(valueEl);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }

            const finishEdit = () => {
                if (!valueEl.contentEditable) return;
                valueEl.contentEditable = false;
                this._saveField({
                    component: valueEl.dataset.component,
                    field: valueEl.dataset.field,
                    rawValue: valueEl.textContent
                });
            };

            valueEl.addEventListener('blur', finishEdit, { once: true });
            valueEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); valueEl.blur(); }
                if (e.key === 'Escape') {
                    valueEl.contentEditable = false;
                    valueEl.textContent = currentText;
                    this.renderDetail(this._lastData);
                }
            });
        },

        _saveField({ component: componentType, field, rawValue }) {
            const selectedItem = AppState.get('selectedItem');
            if (!selectedItem) return;
            const entity = selectedItem.data;
            const component = entity.components[componentType];
            if (!component) return;

            let originalValue, newValue;

            // 复合字段名：birthTime-year, deathTime-month 等
            const timeParts = field.match(/^(birthTime|deathTime)-(year|month|day)$/);
            if (timeParts) {
                const [, baseField, part] = timeParts;
                const currentTime = component[baseField] || { year: 0, month: 1, day: 1 };
                originalValue = { ...currentTime };
                const parsed = rawValue === '' ? null : Number(rawValue);
                if (parsed == null || isNaN(parsed)) {
                    this.renderDetail(this._lastData);
                    return;
                }
                currentTime[part] = parsed;
                newValue = currentTime;
                field = baseField;
            } else {
                originalValue = component[field];
                if (typeof originalValue === 'number') {
                    newValue = rawValue === '' ? originalValue : Number(rawValue);
                } else {
                    newValue = rawValue || originalValue;
                }
            }

            if (newValue === originalValue || JSON.stringify(newValue) === JSON.stringify(originalValue)) {
                this.renderDetail(this._lastData);
                return;
            }

            EventBus.emit('command:execute', {
                type: 'editEntityField',
                entityId: entity.id, componentType, field,
                oldValue: originalValue, newValue
            });
        },

        // ───── 渲染（子类覆盖） ─────

        renderDetail(data) {
            this._lastData = data;
            // 由子类实现
        }
    };

    return panel;
}

// =====================================================================
// Primary Detail Panel — 渲染 ECS 组件 + 途径点 CRUD
// =====================================================================

const DetailPanel = createDetailPanel({
    stateKey: 'isDetailPanelOpen',
    bodyClosedClass: 'detail--closed'
});

// 渲染器生成函数
DetailPanel._getComponentRenderer = function () {
    const self = this;
    const renderers = {
        core: comp => `
            <div class="detail-property"><span class="property-label">名称</span><span class="property-value" data-component="core" data-field="name">${comp.name}</span></div>
            <div class="detail-property"><span class="property-label">颜色</span><span class="property-value" data-component="core" data-field="color"><span class="color-swatch" style="background:${comp.color}"></span>${comp.color}</span></div>
            <div class="detail-property"><span class="property-label">默认图标</span><span class="property-value" data-component="core" data-field="icon">${comp.icon}</span></div>
        `,

        motion: comp => {
            const selectedItem = AppState.get('selectedItem');
            const entity = selectedItem ? selectedItem.data : null;
            const zoomLevel = AppState.get('timeZoomLevel') || 'year';
            const addIcon = getIcon('add', 14);

            const firstAdd = `<li class="waypoint-item waypoint-add-first" title="在开头创建途径点">
                <button class="waypoint-btn" data-action="add-first-wp" data-component="motion">${addIcon}</button>
            </li>`;

            if (!comp.waypoints || comp.waypoints.length === 0) {
                return `<ul class="detail-waypoint-list">${firstAdd}</ul>`;
            }

            const listItems = comp.waypoints.map((wp, idx) => {
                const isOutside = entity ? self._isWaypointOutsideLifespan(entity, wp.time.arrival || wp.time.departure || wp.time) : false;
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
        },

        nameHistory: comp => {
            const zoomLevel = AppState.get('timeZoomLevel') || 'year';
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
        },

        place: comp => {
            const pos = comp.position;
            return `
            <div class="detail-property"><span class="property-label">位置</span><span class="property-value">${pos ? `(${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)})` : '未知'}</span></div>
            <div class="detail-property"><span class="property-label">描述</span><span class="property-value" data-component="place" data-field="description">${comp.description || '无'}</span></div>
            `;
        },

        person: comp => {
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
        },

        organization: comp => `
            <div class="detail-property"><span class="property-label">总部</span><span class="property-value" data-component="organization" data-field="headquarters">${comp.headquarters || '未知'}</span></div>
            <div class="detail-property"><span class="property-label">领袖</span><span class="property-value" data-component="organization" data-field="leader">${comp.leader || '未知'}</span></div>
            <div class="detail-property"><span class="property-label">成员</span><span class="property-value" data-component="organization" data-field="members">${comp.members || '未知'}</span></div>
        `,

        regime: comp => `
            <div class="detail-property"><span class="property-label">首都</span><span class="property-value" data-component="regime" data-field="capital">${comp.capital || '未知'}</span></div>
            <div class="detail-property"><span class="property-label">人口</span><span class="property-value" data-component="regime" data-field="population">${comp.population || '未知'}</span></div>
            <div class="detail-property"><span class="property-label">政体</span><span class="property-value" data-component="regime" data-field="governmentType">${comp.governmentType || '未知'}</span></div>
        `,

        customTags: comp => {
            const tags = comp.tags || [];
            return `<div class="detail-property"><span class="property-label">标签</span><span class="property-value">${tags.join(', ') || '无'}</span></div>`;
        }
    };

    return function (type) {
        if (renderers[type]) return renderers[type];
        return comp => {
            const entries = Object.entries(comp).filter(([key]) => key !== 'type');
            if (entries.length === 0) return '<div class="detail-property">无额外属性</div>';
            return entries.map(([key, value]) =>
                `<div class="detail-property"><span class="property-label">${key}</span><span class="property-value">${value}</span></div>`
            ).join('');
        };
    };
};

DetailPanel._getComponentLabel = function (type) {
    return ({
        core: '基本信息', motion: '运动轨迹', nameHistory: '名称演变',
        person: '人物信息', place: '地点信息', organization: '组织信息',
        regime: '政权信息', customTags: '自定义标签'
    })[type] || type;
};

DetailPanel._getComponentIcon = function (type) {
    return ({
        core: 'page', motion: 'timeline', nameHistory: 'calendar',
        person: 'person', place: 'place', organization: 'organization',
        regime: 'regime', customTags: 'tag'
    })[type] || 'tag';
};

DetailPanel._isWaypointOutsideLifespan = function (entity, time) {
    const personComp = entity.components.person;
    if (!personComp) return false;
    const { birthTime, deathTime } = personComp;
    if (birthTime == null && deathTime == null) return false;
    if (birthTime != null && TimeUtils.compare(time, birthTime) < 0) return true;
    if (deathTime != null && TimeUtils.compare(time, deathTime) > 0) return true;
    return false;
};

/**
 * 初始化 Primary Panel（覆盖 factory 的 init）
 */
DetailPanel.init = function () {
    this.elements.body = document.body;
    this.elements.panel = document.querySelector('.detail:not(.detail-secondary)');
    this.elements.content = document.querySelector('#detail-content');
    this.elements.btnClose = document.querySelector('#detail-btn-close');
    this._allowEdit = true;

    this.elements.btnClose.addEventListener('click', () => this._toggle(false));
    EventBus.on('state:change', this._onStateChange.bind(this));

    // 事件委托：编辑 + waypoint 操作 + 二级面板
    this.elements.content.addEventListener('click', (e) => {
        const btn = e.target.closest('.waypoint-btn');
        if (btn) { e.stopPropagation(); this._handleWaypointAction(btn); return; }
        const wpLi = e.target.closest('.waypoint-item:not(.waypoint-add-first)');
        if (wpLi) { e.stopPropagation(); this._openSecondaryPanel(wpLi); return; }
        const valueEl = e.target.closest('.property-value');
        if (valueEl && valueEl.dataset.field) { this._makeEditable(valueEl); }
    });

    const initialItem = AppState.get('selectedItem');
    if (initialItem) {
        this.renderDetail(initialItem);
        this._toggle(true);
    } else {
        this._toggle(false);
    }
};

DetailPanel._onStateChange = function (data) {
    switch (data.key) {
        case 'selectedItem':
            // 选中新实体时关闭 Secondary Panel
            if (AppState.get('isSecondaryPanelOpen')) {
                AppState.set('isSecondaryPanelOpen', false);
            }
            if (data.value) { this.renderDetail(data.value); this._toggle(true); }
            else { this._toggle(false); }
            break;
        case 'isDetailPanelOpen':
            this._updateOpenState(data.value);
            break;
        case 'isSecondaryPanelOpen':
            // Secondary 打开 → 隐藏 primary
            if (data.value) { this.elements.panel.classList.add('detail--covered'); }
            else { this.elements.panel.classList.remove('detail--covered'); }
            break;
    }
};

DetailPanel._renderComponentSection = function (component) {
    const type = component.type;
    const renderer = this._getComponentRenderer(type);
    if (!renderer) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'detail-component-block';

    const header = document.createElement('div');
    header.className = 'detail-component-header';
    header.innerHTML = `
        <span class="icon" data-name="${this._getComponentIcon(type)}"></span>
        <span class="detail-component-type">${this._getComponentLabel(type)}</span>
    `;
    wrapper.appendChild(header);

    const body = document.createElement('div');
    body.className = 'detail-component-body';
    body.innerHTML = renderer(component);
    wrapper.appendChild(body);

    initIconsForContainer(wrapper);
    return wrapper;
};

DetailPanel.renderDetail = function (entity) {
    if (!this.elements.content) return;
    this._lastData = entity;

    this.elements.content.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'detail-content-title';
    title.textContent = entity.data.components.core.name || '';
    this.elements.content.appendChild(title);

    Object.values(entity.data.components).forEach((comp) => {
        const section = this._renderComponentSection(comp);
        if (section) this.elements.content.appendChild(section);
    });
};

DetailPanel._openSecondaryPanel = function (wpLi) {
    const idx = parseInt(wpLi.dataset.wpIndex, 10);
    if (isNaN(idx)) return;

    // 从 DOM 中查找对应的组件类型
    const componentType = wpLi.dataset.component
        || (wpLi.closest('[data-component]') && wpLi.closest('[data-component]').dataset.component);
    if (!componentType) return;

    const selectedItem = AppState.get('selectedItem');
    if (!selectedItem) return;
    const comp = selectedItem.data.components[componentType];
    if (!comp) return;

    // 取对应条目
    const items = componentType === 'motion' ? comp.waypoints : comp.entries;
    if (!items || idx >= items.length) return;

    const item = items[idx];
    const title = componentType === 'motion'
        ? (item.name || `途径点 ${idx + 1}`)
        : (item.name || `名称条目 ${idx + 1}`);

    // 构造扁平数据（用 data- 属性标记以便编辑）
    const data = { ...item, _componentType: componentType, _index: idx };

    AppState.set('secondaryPanelContent', { title, data });
    AppState.set('isSecondaryPanelOpen', true);
};

// ───── 途径点 CRUD ─────

DetailPanel._handleWaypointAction = function (btn) {
    const action = btn.dataset.action;
    if (!action) return;
    const selectedItem = AppState.get('selectedItem');
    if (!selectedItem) return;
    const entity = selectedItem.data;

    const componentType = btn.dataset.component
        || (btn.closest('li[data-component]') || {}).dataset.component;
    if (!componentType) return;

    if (action === 'add-first-wp' || action === 'add-after-wp') {
        const index = action === 'add-first-wp' ? -1 : parseInt(btn.dataset.wpIndex, 10);
        if (action === 'add-after-wp' && isNaN(index)) return;
        this._addWaypoint(entity, componentType, index);
    } else if (action === 'delete-wp') {
        const index = parseInt(btn.dataset.wpIndex, 10);
        if (isNaN(index)) return;
        this._deleteWaypoint(entity, componentType, index);
    }
};

DetailPanel._getItems = function (entity, componentType) {
    const comp = entity.components[componentType];
    return componentType === 'motion' ? (comp && comp.waypoints) : (comp && comp.entries);
};

DetailPanel._getItemsField = function (componentType) {
    return componentType === 'motion' ? 'waypoints' : 'entries';
};

DetailPanel._deleteWaypoint = function (entity, componentType, index) {
    const items = this._getItems(entity, componentType);
    if (!items || index < 0 || index >= items.length) return;
    const oldValue = JSON.parse(JSON.stringify(items));
    const newValue = items.filter((_, i) => i !== index);
    EventBus.emit('command:execute', {
        type: 'editEntityField', entityId: entity.id, componentType,
        field: this._getItemsField(componentType), oldValue, newValue
    });
};

DetailPanel._addWaypoint = function (entity, componentType, afterIndex) {
    const items = this._getItems(entity, componentType);
    if (!items) return;
    const oldValue = JSON.parse(JSON.stringify(items));
    const newItem = componentType === 'motion'
        ? this._createMotionDefault(items, afterIndex)
        : this._createNameHistoryDefault(items, afterIndex);
    const newValue = [...items];
    newValue.splice(afterIndex === -1 ? 0 : afterIndex + 1, 0, newItem);
    EventBus.emit('command:execute', {
        type: 'editEntityField', entityId: entity.id, componentType,
        field: this._getItemsField(componentType), oldValue, newValue
    });
};

DetailPanel._createMotionDefault = function (items, afterIndex) {
    const zoomLevel = AppState.get('timeZoomLevel') || 'year';
    const step = TimeUtils.getResolutionStep();
    const defaultTime = this._computeDefaultTime(items, afterIndex, step,
        (item) => item.time.departure || item.time.arrival || item.time || { year: 0 },
        (item) => item.time.arrival || item.time.departure || item.time || { year: 0 }
    );
    const defaultPos = this._computeDefaultPosition(items, afterIndex);
    return {
        time: { arrival: { ...defaultTime }, departure: { ...defaultTime } },
        lat: defaultPos.lat, lng: defaultPos.lng,
        name: '新途径点', description: '请输入描述', resolution: zoomLevel
    };
};

DetailPanel._createNameHistoryDefault = function (items, afterIndex) {
    const step = TimeUtils.getResolutionStep();
    const defaultTime = this._computeDefaultTime(items, afterIndex, step,
        (item) => item.time || { year: 0 }, (item) => item.time || { year: 0 }
    );
    return { time: { ...defaultTime }, name: '新名称', description: '请输入描述' };
};

DetailPanel._computeDefaultPosition = function (items, afterIndex) {
    if (items.length === 0) return { lat: 0, lng: 0 };
    if (afterIndex === -1) return { lat: items[0].lat, lng: items[0].lng };
    if (afterIndex < items.length - 1) {
        return {
            lat: (items[afterIndex].lat + items[afterIndex + 1].lat) / 2,
            lng: (items[afterIndex].lng + items[afterIndex + 1].lng) / 2
        };
    }
    return { lat: items[afterIndex].lat, lng: items[afterIndex].lng };
};

DetailPanel._computeDefaultTime = function (items, afterIndex, step, getPrev, getNext) {
    if (items.length === 0) return AppState.get('currentTime') || { year: 0 };
    if (afterIndex === -1) {
        const nextOff = TimeUtils.toOffset(getNext(items[0]));
        return TimeUtils.offsetToTime(nextOff - 10 * step);
    }
    if (afterIndex < items.length - 1) {
        return TimeUtils.lerp(getPrev(items[afterIndex]), getNext(items[afterIndex + 1]), 0.5);
    }
    const lastOff = TimeUtils.toOffset(getPrev(items[afterIndex]));
    return TimeUtils.offsetToTime(lastOff + 10 * step);
};

DetailPanel._getComponentRenderer = DetailPanel._getComponentRenderer();
window.DetailPanel = DetailPanel;

// =====================================================================
// Secondary Detail Panel — 渲染扁平数据 + 只读展示
// =====================================================================

const SecondaryDetailPanel = createDetailPanel({
    stateKey: 'isSecondaryPanelOpen',
    bodyClosedClass: 'detail-secondary--closed'
});

// 先在定义阶段覆盖 _onStateChange，init 在 myMap.html 中调用
SecondaryDetailPanel._onStateChange = function (data) {
    switch (data.key) {
        case 'secondaryPanelContent':
            if (data.value && data.value.data) {
                this.renderDetail(data.value);
            }
            break;
        case 'isSecondaryPanelOpen':
            this._updateOpenState(data.value);
            break;
    }
};

SecondaryDetailPanel.renderDetail = function (content) {
    if (!this.elements.content) return;
    this._lastData = content;
    const data = content.data || {};
    const title = content.title || '详情';
    const compType = data._componentType || 'motion';

    this.elements.content.innerHTML = '';

    const titleEl = document.createElement('div');
    titleEl.className = 'detail-content-title';
    titleEl.textContent = title;
    this.elements.content.appendChild(titleEl);

    // 字段标签映射
    const fieldLabels = {
        time: '时间', arrival: '抵达时间', departure: '离开时间',
        lat: '纬度', lng: '经度', name: '名称',
        description: '描述', resolution: '精度',
        gender: '性别', birthTime: '出生', deathTime: '死亡'
    };

    // 遍历扁平数据，为每个字段生成带 data-component / data-field 的 DOM
    Object.entries(data).forEach(([key, value]) => {
        if (key === '_componentType' || key === '_index') return;

        const label = fieldLabels[key] || key;
        const row = document.createElement('div');
        row.className = 'detail-property';

        // { year, month, day } 时间对象：拆为三个可编辑分量
        if (typeof value === 'object' && value !== null && value.year !== undefined) {
            const y = value.year ?? 0;
            const m = value.month ?? 1;
            const d = value.day ?? 1;
            row.innerHTML = `
                <span class="property-label">${label}</span>
                <span class="property-value" data-component="${compType}" data-field="${key}-year">${y}</span><span class="property-value-font">年</span>
                <span class="property-value" data-component="${compType}" data-field="${key}-month">${m}</span><span class="property-value-font">月</span>
                <span class="property-value" data-component="${compType}" data-field="${key}-day">${d}</span><span class="property-value-font">日</span>
            `;
            // { arrival, departure } 嵌套时间：只读格式化显示
        } else if (typeof value === 'object' && value !== null && (value.arrival !== undefined || value.departure !== undefined)) {
            const zl = AppState.get('timeZoomLevel') || 'year';
            const aStr = value.arrival ? TimeUtils.format(value.arrival, zl) : '—';
            const dStr = value.departure ? TimeUtils.format(value.departure, zl) : '—';
            row.innerHTML = `<span class="property-label">${label}</span>
                <span class="property-value-font">抵达 </span><span class="time-badge">${aStr}</span>
                <span class="property-value-font">离开 </span><span class="time-badge">${dStr}</span>`;
            // 简单标量字段（可编辑）
        } else {
            const displayValue = value != null ? String(value) : '未知';
            row.innerHTML = `<span class="property-label">${label}</span><span class="property-value" data-component="${compType}" data-field="${key}">${displayValue}</span>`;
        }

        this.elements.content.appendChild(row);
    });
};

window.SecondaryDetailPanel = SecondaryDetailPanel;