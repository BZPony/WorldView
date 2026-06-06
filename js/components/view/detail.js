/**
 * 详情面板模块（全局单例）
 * 职责：
 * - 监听 selectedItem 变化，自动打开/关闭面板并渲染内容
 * - 管理详情面板的可见状态（写入 AppState.isDetailPanelOpen，触发布局更新）
 * - 提供关闭按钮，清空选中项
 * - 响应 isDetailPanelOpen 状态，更新 body 类
 * - 支持单击属性值进行内联编辑，回车或失焦自动保存
 * - 支持 motion/nameHistory 途径点的添加和删除
 *
 * 与 Sidebar 的对应关系：
 *   - _toggle → 不再直接由按钮调用，面板打开由 selectedItem 驱动
 *   - 按钮事件 → 仅关闭按钮
 *   - _onStateChange → 处理 selectedItem / isDetailPanelOpen
 *   - _updateOpenState → 管理 body.detail--closed 类
 *   - renderDetail → 根据 selectedItem 动态渲染详情内容，每个组件独立渲染
 */
const DetailPanel = {
    // 缓存 DOM 元素
    elements: {},

    /**
     * 初始化详情面板
     */
    init() {
        // 1. 缓存关键 DOM
        this.elements.body = document.body;
        this.elements.panel = document.querySelector('.detail');
        this.elements.btnClose = document.getElementById('detail-btn-close');
        this.elements.content = document.querySelector('.detail-content');

        // 2. 关闭按钮点击
        this.elements.btnClose.addEventListener('click', () => this._toggle(false));

        // 3. 监听 AppState 变化
        EventBus.on('state:change', this._onStateChange.bind(this));

        // 4. 单击编辑功能（事件委托：property-value → contenteditable）
        this.elements.content.addEventListener('click', (e) => {
            const valueEl = e.target.closest('.property-value');
            if (!valueEl || !valueEl.dataset.field) return;
            this._makeEditable(valueEl);
        });

        // 5. 途径点操作按钮（事件委托：waypoint-btn → add/delete）
        this.elements.content.addEventListener('click', (e) => {
            const btn = e.target.closest('.waypoint-btn');
            if (!btn) return;
            e.stopPropagation();
            this._handleWaypointAction(btn);
        });

        // 6. 根据初始状态设置面板
        const initialItem = AppState.get('selectedItem');
        if (initialItem) {
            this.renderDetail(initialItem);
            this._toggle(true);
        } else {
            this._toggle(false);
        }
    },

    // ──────────────────── 状态响应 ────────────────────

    /**
     * 响应 AppState 变化
     * @param {Object} data - { key, value }
     */
    _onStateChange(data) {
        switch (data.key) {
            case 'selectedItem':
                if (data.value) {
                    this.renderDetail(data.value);
                    this._toggle(true);
                } else {
                    this._toggle(false);
                }
                break;

            case 'isDetailPanelOpen':
                this._updateOpenState(data.value);
                break;
        }
    },

    // ──────────────────── 渲染 ────────────────────

    /**
     * 渲染详情内容
     * @param {Object} entity
     */
    renderDetail(entity) {
        if (!this.elements.content) return;

        this.elements.content.innerHTML = '';

        const title = document.createElement('div');
        title.className = 'detail-content-title';
        title.textContent = entity.data.components.core.name || '';
        this.elements.content.appendChild(title);

        const components = Object.values(entity.data.components);
        components.forEach((comp) => {
            const section = this._renderComponentSection(comp);
            if (section) {
                this.elements.content.appendChild(section);
            }
        });
    },

    /**
     * 渲染单个组件的折叠区块
     * @param {Object} component - 组件对象
     * @returns {HTMLElement|null}
     */
    _renderComponentSection(component) {
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
    },

    // ───── 组件渲染器 ─────

    /**
     * 根据组件类型返回渲染函数（返回 HTML 字符串）
     * 每个 .property-value 需携带 data-component 和 data-field 属性以支持内联编辑
     */
    _getComponentRenderer(type) {
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
                    const btns = self._renderWaypointBtns(idx);
                    return `<li class="${cls}" data-wp-index="${idx}">
                        <div class="waypoint-item-content">
                            <div class="waypoint-name-row">${locationStr}</div>
                            <div class="waypoint-time-row"><span class="time-label">抵达</span><span class="time-badge">${arrivalStr}</span><span class="time-label">离开</span><span class="time-badge">${departureStr}</span></div>
                            ${descStr ? `<div class="waypoint-desc-row">${descStr}</div>` : ''}
                        </div>
                        ${btns}
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
                    const btns = self._renderWaypointBtns(idx);
                    return `<li class="waypoint-item" data-wp-index="${idx}">
                        <div class="waypoint-item-content">
                            <div class="waypoint-name-row">${e.name}</div>
                            <div class="waypoint-time-row"><span class="time-label">始于</span><span class="time-badge">${timeStr}</span></div>
                            ${e.description ? `<div class="waypoint-desc-row">${e.description}</div>` : ''}
                        </div>
                        ${btns}
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

            person: comp => `
                <div class="detail-property"><span class="property-label">出生时间</span><span class="property-value" data-component="person" data-field="birthTime">${comp.birthTime ? TimeUtils.format(comp.birthTime, 'year') : '未知'}</span></div>
                <div class="detail-property"><span class="property-label">死亡时间</span><span class="property-value" data-component="person" data-field="deathTime">${comp.deathTime ? TimeUtils.format(comp.deathTime, 'year') : '未知'}</span></div>
                <div class="detail-property"><span class="property-label">性别</span><span class="property-value" data-component="person" data-field="gender">${comp.gender ?? '未知'}</span></div>
                <div class="detail-property"><span class="property-label">描述</span><span class="property-value" data-component="person" data-field="description">${comp.description || '无'}</span></div>
            `,

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

        if (renderers[type]) return renderers[type];

        // 兜底渲染：未知组件直接用键值对显示
        return comp => {
            const entries = Object.entries(comp).filter(([key]) => key !== 'type');
            if (entries.length === 0) return '<div class="detail-property">无额外属性</div>';
            return entries.map(([key, value]) =>
                `<div class="detail-property"><span class="property-label">${key}</span><span class="property-value">${value}</span></div>`
            ).join('');
        };
    },

    /**
     * 生成途径点按钮组的 HTML（删除 + 在此后插入）
     * @param {number} index - 途径点索引
     * @returns {string}
     */
    _renderWaypointBtns(index) {
        const deleteIcon = getIcon('delete', 12);
        const addIcon = getIcon('add', 12);
        return `
            <div class="waypoint-btn-group">
                <button class="waypoint-btn" data-action="delete-wp" data-wp-index="${index}" title="删除">${deleteIcon}</button>
                <button class="waypoint-btn" data-action="add-after-wp" data-wp-index="${index}" title="在此后插入">${addIcon}</button>
            </div>
        `;
    },

    /**
     * 判断一个途径点是否超出实体的寿命区间（仅限 person 组件）
     * @param {Object} entity - 实体对象（含 components）
     * @param {Object} time - 途径点时间对象
     * @returns {boolean} 是否超出寿命
     */
    _isWaypointOutsideLifespan(entity, time) {
        const personComp = entity.components.person;
        if (!personComp) return false;
        const { birthTime, deathTime } = personComp;
        if (birthTime == null && deathTime == null) return false;
        if (birthTime != null && TimeUtils.compare(time, birthTime) < 0) return true;
        if (deathTime != null && TimeUtils.compare(time, deathTime) > 0) return true;
        return false;
    },

    _getComponentLabel(type) {
        const labels = {
            core: '基本信息',
            motion: '运动轨迹',
            nameHistory: '名称演变',
            person: '人物信息',
            place: '地点信息',
            organization: '组织信息',
            regime: '政权信息',
            customTags: '自定义标签'
        };
        return labels[type] || type;
    },

    _getComponentIcon(type) {
        const icons = {
            core: 'page',
            motion: 'timeline',
            nameHistory: 'calendar',
            person: 'person',
            place: 'place',
            organization: 'organization',
            regime: 'regime',
            customTags: 'tag'
        };
        return icons[type] || 'tag';
    },

    // ──────────────────── 内联编辑 ────────────────────

    /**
     * 将属性值变为可编辑状态（contenteditable / 颜色选择器 / 图标选择器）
     * @param {HTMLElement} valueEl - .property-value 元素
     */
    _makeEditable(valueEl) {
        const field = valueEl.dataset.field;

        // 颜色字段：弹出原生颜色选择器
        if (field === 'color') {
            this._editColor(valueEl);
            return;
        }

        // 图标字段：弹出图标选择器
        if (field === 'icon') {
            this._editIcon(valueEl);
            return;
        }

        // 其他文本/数字字段：使用 contenteditable 直接编辑
        this._editText(valueEl);
    },

    /** 颜色字段编辑：弹出原生 color picker */
    _editColor(valueEl) {
        const input = document.createElement('input');
        input.type = 'color';
        const colorMatch = valueEl.textContent.match(/#[0-9a-fA-F]{6}/);
        input.value = colorMatch ? colorMatch[0] : '#4f454f';
        input.className = 'detail-edit-color';
        input.style.position = 'absolute';
        input.style.opacity = '0';
        input.style.pointerEvents = 'none';
        input.dataset.component = valueEl.dataset.component;
        input.dataset.field = 'color';
        document.body.appendChild(input);

        const saveHandler = () => {
            this._saveField({
                component: input.dataset.component,
                field: 'color',
                rawValue: input.value
            });
            document.body.removeChild(input);
        };
        input.addEventListener('input', saveHandler);
        input.addEventListener('blur', () => {
            if (document.body.contains(input)) {
                this.renderDetail(AppState.get('selectedItem'));
                document.body.removeChild(input);
            }
        });
        input.click();
    },

    /** 图标字段编辑：弹出图标选择器弹窗 */
    _editIcon(valueEl) {
        const currentIcon = valueEl.textContent.trim() || 'tag';
        Modal.openIconPicker(currentIcon, (newIcon) => {
            if (currentIcon === newIcon) return;
            EventBus.emit('command:execute', {
                type: 'editEntityField',
                entityId: AppState.get('selectedItem').data.id,
                componentType: 'core',
                field: 'icon',
                oldValue: currentIcon,
                newValue: newIcon
            });
        });
    },

    /** 文本/数字字段编辑：启用 contenteditable */
    _editText(valueEl) {
        const currentText = valueEl.textContent;
        const isPlaceholder = currentText === '未知' || currentText === '无';

        valueEl.contentEditable = true;
        valueEl.textContent = isPlaceholder ? '' : currentText;
        valueEl.focus();

        // 全选文本
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
            if (e.key === 'Enter') {
                e.preventDefault();
                valueEl.blur();
            }
            if (e.key === 'Escape') {
                valueEl.contentEditable = false;
                valueEl.textContent = currentText;
                this.renderDetail(AppState.get('selectedItem'));
            }
        });
    },

    /**
     * 保存字段编辑（统一入口：contenteditable + 颜色选择器共用）
     * 自动处理时间字段（birthTime/deathTime → { year }）和数值字段
     */
    _saveField({ component: componentType, field, rawValue }) {
        const selectedItem = AppState.get('selectedItem');
        if (!selectedItem) return;

        const entity = selectedItem.data;
        const component = entity.components[componentType];
        if (!component) return;

        const originalValue = component[field];
        let newValue;

        // 时间字段（birthTime/deathTime）：输入数字转为 { year: num }
        if (field === 'birthTime' || field === 'deathTime') {
            const parsed = rawValue === '' ? null : Number(rawValue);
            newValue = parsed != null && !isNaN(parsed) ? { year: parsed } : originalValue;
        } else if (typeof originalValue === 'number') {
            newValue = rawValue === '' ? originalValue : Number(rawValue);
        } else {
            newValue = rawValue || originalValue;
        }

        if (newValue === originalValue || JSON.stringify(newValue) === JSON.stringify(originalValue)) {
            this.renderDetail(selectedItem);
            return;
        }

        EventBus.emit('command:execute', {
            type: 'editEntityField',
            entityId: entity.id,
            componentType,
            field,
            oldValue: originalValue,
            newValue
        });
    },

    // ──────────────────── 途径点 CRUD ────────────────────

    /**
     * 获取当前时间分辨率对应的 minUnit 步进值
     * @returns {number} 偏移量（minUnit）
     */
    _getResolutionStep() {
        const zoomLevel = AppState.get('timeZoomLevel') || 'year';
        const scale = TimeConfig.getScale();
        const level = TimeConfig.zoomLevels.find(z => z.id === zoomLevel);
        if (!level) return scale.year;
        const unitScale = scale[level.minUnit] || scale.year;
        return unitScale * (level.step || 1);
    },

    /**
     * 计算两个时间对象的平均值
     * @param {Object} t1
     * @param {Object} t2
     * @returns {Object}
     */
    _averageTime(t1, t2) {
        if (!t1 && !t2) return { year: 0 };
        if (!t1) return t2;
        if (!t2) return t1;
        const off1 = TimeUtils.toOffset(t1);
        const off2 = TimeUtils.toOffset(t2);
        return TimeUtils.offsetToTime(Math.round((off1 + off2) / 2));
    },

    /**
     * 处理途径点操作按钮点击
     * @param {HTMLElement} btn - 被点击的按钮
     */
    _handleWaypointAction(btn) {
        const action = btn.dataset.action;
        if (!action) return;

        const selectedItem = AppState.get('selectedItem');
        if (!selectedItem) return;
        const entity = selectedItem.data;

        // add-first 按钮直接读 data-component
        if (action === 'add-first-wp') {
            const compFromBtn = btn.dataset.component;
            if (compFromBtn) {
                this._addWaypoint(entity, compFromBtn, -1);
            }
            return;
        }

        // 其他按钮：从组件区块标题获取组件类型
        const componentBlock = btn.closest('.detail-component-block');
        if (!componentBlock) return;
        const typeEl = componentBlock.querySelector('.detail-component-type');
        const componentType = typeEl ? this._getComponentTypeFromLabel(typeEl.textContent) : null;
        if (!componentType) return;

        const index = parseInt(btn.dataset.wpIndex, 10);
        if (isNaN(index)) return;

        switch (action) {
            case 'delete-wp':
                this._deleteWaypoint(entity, componentType, index);
                break;
            case 'add-after-wp':
                this._addWaypoint(entity, componentType, index);
                break;
        }
    },

    /**
     * 从中文标签获取组件类型
     * @param {string} label
     * @returns {string|null}
     */
    _getComponentTypeFromLabel(label) {
        const map = {
            '运动轨迹': 'motion',
            '名称演变': 'nameHistory'
        };
        return map[label] || null;
    },

    /**
     * 删除途径点
     * @param {Object} entity
     * @param {string} componentType - 'motion' 或 'nameHistory'
     * @param {number} index - 要删除的索引
     */
    _deleteWaypoint(entity, componentType, index) {
        const items = componentType === 'motion'
            ? entity.components.motion.waypoints
            : entity.components.nameHistory.entries;
        if (!items || index < 0 || index >= items.length) return;

        const oldValue = JSON.parse(JSON.stringify(items));
        const newItems = items.filter((_, i) => i !== index);

        EventBus.emit('command:execute', {
            type: 'editEntityField',
            entityId: entity.id,
            componentType,
            field: componentType === 'motion' ? 'waypoints' : 'entries',
            oldValue,
            newValue: newItems
        });
    },

    /**
     * 添加途径点（计算默认值后发射 command）
     * @param {Object} entity
     * @param {string} componentType - 'motion' 或 'nameHistory'
     * @param {number} afterIndex - 在此索引后插入；-1 表示在开头插入
     */
    _addWaypoint(entity, componentType, afterIndex) {
        const items = componentType === 'motion'
            ? entity.components.motion.waypoints
            : entity.components.nameHistory.entries;
        if (!items) return;

        const oldValue = JSON.parse(JSON.stringify(items));
        const newItem = componentType === 'motion'
            ? this._createMotionDefault(items, afterIndex)
            : this._createNameHistoryDefault(items, afterIndex);

        const newItems = [...items];
        newItems.splice(afterIndex === -1 ? 0 : afterIndex + 1, 0, newItem);

        EventBus.emit('command:execute', {
            type: 'editEntityField',
            entityId: entity.id,
            componentType,
            field: componentType === 'motion' ? 'waypoints' : 'entries',
            oldValue,
            newValue: newItems
        });
    },

    /**
     * 创建 motion 新途径点默认值
     */
    _createMotionDefault(items, afterIndex) {
        const zoomLevel = AppState.get('timeZoomLevel') || 'year';
        const step = this._getResolutionStep();
        const defaultTime = this._computeDefaultTime(
            items, afterIndex, step,
            // getPrev: 取前一个 waypoint 的 departure 时间（flat time object）
            (item) => item.time.departure || item.time.arrival || item.time || { year: 0 },
            // getNext: 取后一个 waypoint 的 arrival 时间（flat time object）
            (item) => item.time.arrival || item.time.departure || item.time || { year: 0 }
        );
        // 空列表时使用地图中心
        const center = items.length === 0 ? this._getMapCenter() : { lat: 0, lng: 0 };
        return {
            time: {
                arrival: { ...defaultTime },
                departure: { ...defaultTime }
            },
            lat: center.lat,
            lng: center.lng,
            name: '新途径点',
            description: '请输入描述',
            resolution: zoomLevel
        };
    },

    /**
     * 创建 nameHistory 新条目默认值
     */
    _createNameHistoryDefault(items, afterIndex) {
        const step = this._getResolutionStep();
        const defaultTime = this._computeDefaultTime(
            items, afterIndex, step,
            (item) => item.time || { year: 0 },
            (item) => item.time || { year: 0 }
        );
        return {
            time: { ...defaultTime },
            name: '新名称',
            description: '请输入描述'
        };
    },

    /**
     * 通用默认时间计算
     * @param {Array} items - 现有条目数组
     * @param {number} afterIndex - 插入位置
     * @param {number} step - 步进值（minUnit）
     * @param {Function} getPrev - 获取"前一个"时间的函数
     * @param {Function} getNext - 获取"后一个"时间的函数
     * @returns {Object} 时间对象
     */
    _getCurrentTime() {
        return AppState.get('currentTime') || { year: 0 };
    },

    _getMapCenter() {
        try {
            const center = MapView.map.getCenter();
            return { lat: center.lat, lng: center.lng };
        } catch (e) {
            return { lat: 0, lng: 0 };
        }
    },

    _computeDefaultTime(items, afterIndex, step, getPrev, getNext) {
        // 空列表时使用当前时间
        if (items.length === 0) {
            return this._getCurrentTime();
        }
        if (afterIndex === -1) {
            // 在开头插入
            const nextTime = getNext(items[0]);
            const nextOff = TimeUtils.toOffset(nextTime);
            return TimeUtils.offsetToTime(nextOff - 10 * step);
        }
        if (afterIndex < items.length - 1) {
            // 在两条目之间插入：前后平均
            const prevTime = getPrev(items[afterIndex]);
            const nextTime = getNext(items[afterIndex + 1]);
            return this._averageTime(prevTime, nextTime);
        }
        // 在末尾插入：后推
        const lastTime = getPrev(items[afterIndex]);
        const lastOff = TimeUtils.toOffset(lastTime);
        return TimeUtils.offsetToTime(lastOff + 10 * step);
    },

    // ──────────────────── 面板开关 ────────────────────

    /**
     * 设置开/关状态（统一修改入口）
     * @param {boolean} open
     */
    _toggle(open) {
        AppState.set('isDetailPanelOpen', open);
    },

    /**
     * 根据 isDetailPanelOpen 状态更新 body 类
     * @param {boolean} isOpen
     */
    _updateOpenState(isOpen) {
        if (isOpen) {
            this.elements.body.classList.remove('detail--closed');
        } else {
            this.elements.body.classList.add('detail--closed');
        }
    }
};

window.DetailPanel = DetailPanel;