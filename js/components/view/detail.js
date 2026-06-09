/**
 * 详情面板工厂
 * 创建可编辑的详情面板实例。Primary Panel 和 Secondary Panel 共享所有编辑方法，
 * 但渲染逻辑各自独立（Primary 按 ECS 组件渲染，Secondary 按条目渲染）。
 */

/**
 * 创建一个详情面板实例
 * @param {Object} config
 *   - stateKey：AppState 中控制面板开关的 key
 *   - bodyClosedClass：面板关闭时 body 上的 CSS 类名
 * @returns {Object}
 */
function createDetailPanel(config) {
    const panel = {
        config,
        elements: {},

        init(opts) {
            this.elements.body = document.body;
            this.elements.panel = document.querySelector(opts.containerSelector);
            this.elements.content = document.querySelector(opts.contentSelector);
            this.elements.btnClose = document.querySelector(opts.btnCloseSelector);
            this._allowEdit = opts.allowEdit !== false;

            this.elements.btnClose.addEventListener('click', () => this._toggle(false));
            EventBus.on('state:change', this._onStateChange.bind(this));

            this.elements.content.addEventListener('click', (e) => {
                if (!this._allowEdit) return;
                const valueEl = e.target.closest('.property-value');
                if (valueEl && valueEl.dataset.field) {
                    this._makeEditable(valueEl);
                }
            });
        },

        _onStateChange(data) { },

        _toggle(open) {
            AppState.set(this.config.stateKey, open);
        },

        _updateOpenState(isOpen) {
            this.elements.body.classList.toggle(this.config.bodyClosedClass, !isOpen);
        },

        _makeEditable(valueEl) {
            const field = valueEl.dataset.field;
            if (field === 'color') this._editColor(valueEl);
            else if (field === 'icon') this._editIcon(valueEl);
            else if ('picker' in valueEl.dataset) this._editPicker(valueEl, this._getPickerOptions(field));
            else this._editText(valueEl);
        },

        _editPicker(valueEl, options) {
            const currentValue = valueEl.dataset.value || valueEl.textContent.trim();
            const rect = valueEl.getBoundingClientRect();

            const menu = document.createElement('div');
            menu.className = 'detail-picker';
            menu.style.left = rect.left + 'px';
            menu.style.top = (rect.bottom) + 'px';

            options.forEach(opt => {
                const item = document.createElement('div');
                item.className = 'detail-picker-item';
                item.textContent = opt.label;
                if (opt.value === currentValue) item.classList.add('selected');
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    // 先更新 DOM 显示，再保存数据
                    valueEl.textContent = opt.label;
                    valueEl.dataset.value = opt.value;
                    this._saveField({
                        component: valueEl.dataset.component,
                        field: valueEl.dataset.field,
                        rawValue: opt.value
                    });
                    cleanup();
                });
                menu.appendChild(item);
            });

            const cleanup = () => { if (document.body.contains(menu)) document.body.removeChild(menu); };
            menu.addEventListener('mousedown', (e) => e.stopPropagation());
            document.addEventListener('mousedown', cleanup, { once: true });

            document.body.appendChild(menu);
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
                    componentType: 'core', path: ['icon'],
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

            // —— 判断是否处于二级面板的嵌套编辑 ——
            const secContent = AppState.get('secondaryPanelContent');
            const index = secContent?.data?._index;
            const itemsField = componentType === 'motion' ? 'waypoints'
                : componentType === 'nameHistory' ? 'entries' : null;
            const isNestedEdit = index != null && itemsField != null;

            // 从正确路径读取原始值
            const getValue = (key) => isNestedEdit
                ? component[itemsField][index][key]
                : component[key];
            // 构造命令路径
            const buildPath = (key) => isNestedEdit
                ? [itemsField, index, key]
                : [key];

            // —— 时间复合字段（birthTime-year / time-month / arrival-year 等）——
            const timeMatch = field.match(/^(birthTime|deathTime|time|arrival|departure)-(year|month|day)$/);
            if (timeMatch) {
                const [, baseField, part] = timeMatch;
                // arrival/departure 嵌套在 time 下，需特殊处理路径
                const isTimeSubField = baseField === 'arrival' || baseField === 'departure';
                let originalTime, timePath;
                if (isNestedEdit && isTimeSubField) {
                    const item = component[itemsField][index];
                    originalTime = item.time?.[baseField] || { year: 0, month: 1, day: 1 };
                    timePath = [itemsField, index, 'time', baseField];  // e.g. ['waypoints', 0, 'time', 'arrival']
                } else {
                    originalTime = getValue(baseField) || { year: 0, month: 1, day: 1 };
                    timePath = buildPath(baseField);
                }
                const parsed = rawValue === '' ? null : Number(rawValue);
                if (parsed == null || isNaN(parsed)) {
                    this.renderDetail(this._lastData);
                    return;
                }
                const newValue = { ...originalTime, [part]: parsed };
                if (JSON.stringify(newValue) === JSON.stringify(originalTime)) {
                    this.renderDetail(this._lastData);
                    return;
                }
                EventBus.emit('command:execute', {
                    type: 'editEntityField',
                    entityId: entity.id,
                    componentType,
                    path: timePath,
                    oldValue: originalTime, newValue
                });
                return;
            }

            // —— 普通字段 ——
            const originalValue = getValue(field);
            const newValue = typeof originalValue === 'number'
                ? (rawValue === '' ? originalValue : Number(rawValue))
                : (rawValue || originalValue);

            if (newValue === originalValue) {
                this.renderDetail(this._lastData);
                return;
            }

            EventBus.emit('command:execute', {
                type: 'editEntityField',
                entityId: entity.id,
                componentType,
                path: buildPath(field),
                oldValue: originalValue, newValue
            });
        },

        renderDetail(data) {
            this._lastData = data;
        },

        // ───── Picker 选项注册表（通用，所有面板共享） ─────
        _pickerOptions: {
            resolution: () => TimeConfig.zoomLevels.map(z => ({ label: z.label, value: z.id }))
        },

        _getPickerOptions(field) {
            const fn = this._pickerOptions[field];
            return fn ? fn() : [];
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

// 组件渲染器路由
DetailPanel._getComponentRenderer = function (type) {
    const helpers = {
        entity: (AppState.get('selectedItem') || {}).data || null,
        zoomLevel: AppState.get('timeZoomLevel') || 'year',
        isWaypointOutsideLifespan: (entity, time) => {
            const personComp = entity.components.person;
            if (!personComp) return false;
            const { birthTime, deathTime } = personComp;
            if (birthTime == null && deathTime == null) return false;
            if (birthTime != null && TimeUtils.compare(time, birthTime) < 0) return true;
            if (deathTime != null && TimeUtils.compare(time, deathTime) > 0) return true;
            return false;
        }
    };

    const renderers = {
        core: comp => renderCoreComponent(comp),
        motion: comp => renderMotionComponent(comp, helpers),
        nameHistory: comp => renderNameHistoryComponent(comp, helpers),
        place: comp => renderPlaceComponent(comp),
        person: comp => renderPersonComponent(comp),
        organization: comp => renderOrganizationComponent(comp),
        regime: comp => renderRegimeComponent(comp),
        customTags: comp => renderCustomTagsComponent(comp)
    };

    if (renderers[type]) return renderers[type];

    // 兜底渲染
    return comp => {
        const entries = Object.entries(comp).filter(([key]) => key !== 'type');
        if (entries.length === 0) return '<div class="detail-property">无额外属性</div>';
        return entries.map(([key, value]) =>
            `<div class="detail-property"><span class="property-label">${key}</span><span class="property-value">${value}</span></div>`
        ).join('');
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

// ───── 初始化 ─────

DetailPanel.init = function () {
    this.elements.body = document.body;
    this.elements.panel = document.querySelector('.detail:not(.detail-secondary)');
    this.elements.content = document.querySelector('#detail-content');
    this.elements.btnClose = document.querySelector('#detail-btn-close');
    this._allowEdit = true;

    this.elements.btnClose.addEventListener('click', () => this._toggle(false));
    EventBus.on('state:change', this._onStateChange.bind(this));

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

// ───── 状态响应 ─────

DetailPanel._onStateChange = function (data) {
    switch (data.key) {
        case 'selectedItem':
            // 如果 Secondary Panel 打开且选中的是同一实体（数据同步），不关闭面板
            if (data.value && AppState.get('isSecondaryPanelOpen')) {
                const currentEntityId = this._lastData?.data?.id;
                const newEntityId = data.value.data.id;
                if (currentEntityId !== newEntityId) {
                    AppState.set('isSecondaryPanelOpen', false);
                }
            }
            // 没有 Secondary Panel 时，正常切换
            if (!AppState.get('isSecondaryPanelOpen')) {
                if (data.value) { this.renderDetail(data.value); this._toggle(true); }
                else { this._toggle(false); }
            }
            break;
        case 'isDetailPanelOpen':
            this._updateOpenState(data.value);
            break;
        case 'isSecondaryPanelOpen':
            if (data.value) {
                this.elements.panel.classList.add('detail--covered');
            } else {
                this.elements.panel.classList.remove('detail--covered');
                // 二级面板关闭时，用最新数据重新渲染一级面板
                const selectedItem = AppState.get('selectedItem');
                if (selectedItem) {
                    this.renderDetail(selectedItem);
                    this._toggle(true);
                }
            }
            break;
    }
};

// ───── 渲染 ─────

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

// ───── 二级面板触发 ─────

DetailPanel._openSecondaryPanel = function (wpLi) {
    const idx = parseInt(wpLi.dataset.wpIndex, 10);
    if (isNaN(idx)) return;

    const componentType = wpLi.dataset.component
        || (wpLi.closest('[data-component]') && wpLi.closest('[data-component]').dataset.component);
    if (!componentType) return;

    const selectedItem = AppState.get('selectedItem');
    if (!selectedItem) return;
    const comp = selectedItem.data.components[componentType];
    if (!comp) return;

    const items = componentType === 'motion' ? comp.waypoints : comp.entries;
    if (!items || idx >= items.length) return;

    const item = items[idx];
    const title = componentType === 'motion'
        ? (item.name || `途径点 ${idx + 1}`)
        : (item.name || `名称条目 ${idx + 1}`);

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
        type: 'editEntityField',
        entityId: entity.id, componentType,
        path: [this._getItemsField(componentType)],
        oldValue,
        newValue
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
        type: 'editEntityField',
        entityId: entity.id,
        componentType,
        path: [this._getItemsField(componentType)],
        oldValue,
        newValue
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

window.DetailPanel = DetailPanel;

// =====================================================================
// Secondary Detail Panel — 按 _componentType 分发到对应条目渲染器
// =====================================================================

const SecondaryDetailPanel = createDetailPanel({
    stateKey: 'isSecondaryPanelOpen',
    bodyClosedClass: 'detail-secondary--closed'
});

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

/**
 * 二级面板条目渲染器注册表
 * 新增组件类型时在此注册即可
 */
const secondaryItemRenderers = {
    motion: renderMotionItem,
    nameHistory: renderNameHistoryItem
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

    // 按 _componentType 分发到对应条目渲染器
    const renderer = secondaryItemRenderers[compType];
    if (renderer) {
        renderer(data, compType, this.elements.content);
    } else {
        // 兜底：通用字段遍历
        Object.entries(data).forEach(([key, value]) => {
            if (key === '_componentType' || key === '_index') return;
            if (typeof value === 'object' && value !== null && value.year !== undefined) {
                const y = value.year ?? 0;
                const m = value.month ?? 1;
                const d = value.day ?? 1;
                const row = document.createElement('div');
                row.className = 'detail-property';
                row.innerHTML = `
                    <span class="property-label">${key}</span>
                    <span class="property-value" data-component="${compType}" data-field="${key}-year">${y}</span><span class="property-value-font">年</span>
                    <span class="property-value" data-component="${compType}" data-field="${key}-month">${m}</span><span class="property-value-font">月</span>
                    <span class="property-value" data-component="${compType}" data-field="${key}-day">${d}</span><span class="property-value-font">日</span>
                `;
                this.elements.content.appendChild(row);
            } else {
                const displayValue = value != null ? String(value) : '未知';
                const row = document.createElement('div');
                row.className = 'detail-property';
                row.innerHTML = `<span class="property-label">${key}</span><span class="property-value" data-component="${compType}" data-field="${key}">${displayValue}</span>`;
                this.elements.content.appendChild(row);
            }
        });
    }
};

window.SecondaryDetailPanel = SecondaryDetailPanel;