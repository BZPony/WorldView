/**
 * 详情面板模块（全局单例）
 * 职责：
 * - 监听 selectedItem 变化，自动打开/关闭面板并渲染内容
 * - 管理详情面板的可见状态（写入 AppState.isDetailPanelOpen，触发布局更新）
 * - 提供关闭按钮，清空选中项
 * - 响应 isDetailPanelOpen 状态，更新 body 类
 * - 支持单击属性值进行内联编辑，回车或失焦自动保存
 * - 支持 motion/nameHistory 途径点的添加和删除
 */
const DetailPanel = {
    // 缓存关键 DOM 元素
    elements: {},

    /**
     * 初始化详情面板：
     *   1. 缓存关键 DOM 元素
     *   2. 绑定关闭按钮点击事件
     *   3. 监听 AppState 变化
     *   4. 通过事件委托处理途径点按钮和属性值编辑的点击
     *   5. 根据初始 selectedItem 渲染面板
     */
    init() {
        // 1. 缓存关键 DOM
        this.elements.body = document.body;
        this.elements.panel = document.querySelector('.detail');
        this.elements.btnClose = document.getElementById('detail-btn-close');
        this.elements.content = document.querySelector('.detail-content');

        // 2. 关闭按钮点击时关闭面板
        this.elements.btnClose.addEventListener('click', () => this._toggle(false));

        // 3. 监听 AppState 变化，响应选中项/面板开关
        EventBus.on('state:change', this._onStateChange.bind(this));

        // 4. 事件委托：单击编辑 + 途径点操作按钮（统一监听，优先匹配按钮）
        this.elements.content.addEventListener('click', (e) => {
            // 途径点按钮优先匹配
            const btn = e.target.closest('.waypoint-btn');
            if (btn) {
                e.stopPropagation();
                this._handleWaypointAction(btn);
                return;
            }
            // 属性值编辑（仅限携带 data-field 的 .property-value）
            const valueEl = e.target.closest('.property-value');
            if (valueEl && valueEl.dataset.field) {
                this._makeEditable(valueEl);
            }
        });

        // 5. 根据初始选中状态渲染面板
        const initialItem = AppState.get('selectedItem');
        if (initialItem) {
            this.renderDetail(initialItem);
            this._toggle(true);
        } else {
            this._toggle(false);
        }
    },

    // ───── 状态响应 ─────

    /**
     * 响应 AppState 状态变化
     * - selectedItem：重新渲染详情内容，打开面板
     * - isDetailPanelOpen：更新面板 CSS 可见状态
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

    // ───── 渲染 ─────

    /**
     * 渲染详情面板内容
     * 1. 清空容器
     * 2. 添加实体名称标题
     * 3. 遍历所有组件，为每个组件生成折叠区块并添加到容器
     * @param {Object} entity - 选中项的完整数据对象（含 components）
     */
    renderDetail(entity) {
        if (!this.elements.content) return;

        this.elements.content.innerHTML = '';

        // 标题：显示实体名称
        const title = document.createElement('div');
        title.className = 'detail-content-title';
        title.textContent = entity.data.components.core.name || '';
        this.elements.content.appendChild(title);

        // 遍历所有组件并渲染
        Object.values(entity.data.components).forEach((comp) => {
            const section = this._renderComponentSection(comp);
            if (section) this.elements.content.appendChild(section);
        });
    },

    /**
     * 渲染单个组件的折叠区块
     * 1. 获取渲染器（返回 HTML 字符串或 null）
     * 2. 创建区块容器
     * 3. 创建标题栏（图标 + 标签）
     * 4. 创建内容区（渲染器输出的 HTML）
     * 5. 初始化区块内的图标
     * @param {Object} component - 组件对象
     * @returns {HTMLElement|null}
     */
    _renderComponentSection(component) {
        const type = component.type;
        // 获取渲染器，未知组件返回 null
        const renderer = this._getComponentRenderer(type);
        if (!renderer) return null;

        // 区块容器
        const wrapper = document.createElement('div');
        wrapper.className = 'detail-component-block';

        // 标题栏：图标 + 标签
        const header = document.createElement('div');
        header.className = 'detail-component-header';
        header.innerHTML = `
            <span class="icon" data-name="${this._getComponentIcon(type)}"></span>
            <span class="detail-component-type">${this._getComponentLabel(type)}</span>
        `;
        wrapper.appendChild(header);

        // 内容区：渲染器返回的 HTML
        const body = document.createElement('div');
        body.className = 'detail-component-body';
        body.innerHTML = renderer(component);
        wrapper.appendChild(body);

        // 初始化区块内的 SVG 图标
        initIconsForContainer(wrapper);
        return wrapper;
    },

    /**
     * 获取指定组件类型的渲染器函数
     * 每个渲染器接收组件对象，返回 HTML 字符串。
     * 可编辑的字段必须携带 data-component 和 data-field 属性以支持内联编辑。
     * @param {string} type - 组件类型名称
     * @returns {Function|null} 渲染器函数
     */
    _getComponentRenderer(type) {
        const self = this;
        const renderers = {
            // —— core 渲染器 ——
            core: comp => `
                <div class="detail-property"><span class="property-label">名称</span><span class="property-value" data-component="core" data-field="name">${comp.name}</span></div>
                <div class="detail-property"><span class="property-label">颜色</span><span class="property-value" data-component="core" data-field="color"><span class="color-swatch" style="background:${comp.color}"></span>${comp.color}</span></div>
                <div class="detail-property"><span class="property-label">默认图标</span><span class="property-value" data-component="core" data-field="icon">${comp.icon}</span></div>
            `,

            // —— motion 渲染器（运动轨迹） ——
            motion: comp => {
                // 提取当前选中实体和时间缩放级别
                const selectedItem = AppState.get('selectedItem');
                const entity = selectedItem ? selectedItem.data : null;
                const zoomLevel = AppState.get('timeZoomLevel') || 'year';
                const addIcon = getIcon('add', 14);

                // 顶部"在开头创建途径点"按钮
                const firstAdd = `<li class="waypoint-item waypoint-add-first" title="在开头创建途径点">
                    <button class="waypoint-btn" data-action="add-first-wp" data-component="motion">${addIcon}</button>
                </li>`;

                // 空数据时只显示顶部按钮
                if (!comp.waypoints || comp.waypoints.length === 0) {
                    return `<ul class="detail-waypoint-list">${firstAdd}</ul>`;
                }

                // 渲染每个途径点条目
                const listItems = comp.waypoints.map((wp, idx) => {
                    // 寿命异常标记
                    const isOutside = entity ? self._isWaypointOutsideLifespan(entity, wp.time.arrival || wp.time.departure || wp.time) : false;
                    const cls = isOutside ? 'waypoint-item waypoint-outside-lifespan' : 'waypoint-item';
                    // 提取抵达和离开时间
                    const arrival = wp.time.arrival || wp.time.departure || wp.time;
                    const departure = wp.time.departure || wp.time.arrival || wp.time;
                    const wpZoom = wp.resolution || zoomLevel;
                    const arrivalStr = TimeUtils.format(arrival, wpZoom);
                    const departureStr = TimeUtils.format(departure, wpZoom);
                    // 位置名称 / 坐标
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

            // —— nameHistory 渲染器（名称演变） ——
            nameHistory: comp => {
                const zoomLevel = AppState.get('timeZoomLevel') || 'year';
                const addIcon = getIcon('add', 14);

                // 顶部"在开头创建条目"按钮
                const firstAdd = `<li class="waypoint-item waypoint-add-first" title="在开头创建条目">
                    <button class="waypoint-btn" data-action="add-first-wp" data-component="nameHistory">${addIcon}</button>
                </li>`;

                // 空数据时只显示顶部按钮
                if (!comp.entries || comp.entries.length === 0) {
                    return `<ul class="detail-waypoint-list">${firstAdd}</ul>`;
                }

                // 渲染每个名称变更条目
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

            // —— place 渲染器（固定位置） ——
            place: comp => {
                const pos = comp.position;
                return `
                <div class="detail-property"><span class="property-label">位置</span><span class="property-value">${pos ? `(${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)})` : '未知'}</span></div>
                <div class="detail-property"><span class="property-label">描述</span><span class="property-value" data-component="place" data-field="description">${comp.description || '无'}</span></div>
                `;
            },

            // —— person 渲染器（人物信息） ——
            person: comp => `
                <div class="detail-property"><span class="property-label">出生时间</span><span class="property-value" data-component="person" data-field="birthTime">${comp.birthTime ? TimeUtils.format(comp.birthTime, 'year') : '未知'}</span></div>
                <div class="detail-property"><span class="property-label">死亡时间</span><span class="property-value" data-component="person" data-field="deathTime">${comp.deathTime ? TimeUtils.format(comp.deathTime, 'year') : '未知'}</span></div>
                <div class="detail-property"><span class="property-label">性别</span><span class="property-value" data-component="person" data-field="gender">${comp.gender ?? '未知'}</span></div>
                <div class="detail-property"><span class="property-label">描述</span><span class="property-value" data-component="person" data-field="description">${comp.description || '无'}</span></div>
            `,

            // —— organization 渲染器（组织信息） ——
            organization: comp => `
                <div class="detail-property"><span class="property-label">总部</span><span class="property-value" data-component="organization" data-field="headquarters">${comp.headquarters || '未知'}</span></div>
                <div class="detail-property"><span class="property-label">领袖</span><span class="property-value" data-component="organization" data-field="leader">${comp.leader || '未知'}</span></div>
                <div class="detail-property"><span class="property-label">成员</span><span class="property-value" data-component="organization" data-field="members">${comp.members || '未知'}</span></div>
            `,

            // —— regime 渲染器（政权信息） ——
            regime: comp => `
                <div class="detail-property"><span class="property-label">首都</span><span class="property-value" data-component="regime" data-field="capital">${comp.capital || '未知'}</span></div>
                <div class="detail-property"><span class="property-label">人口</span><span class="property-value" data-component="regime" data-field="population">${comp.population || '未知'}</span></div>
                <div class="detail-property"><span class="property-label">政体</span><span class="property-value" data-component="regime" data-field="governmentType">${comp.governmentType || '未知'}</span></div>
            `,

            // —— customTags 渲染器（自定义标签） ——
            customTags: comp => {
                const tags = comp.tags || [];
                return `<div class="detail-property"><span class="property-label">标签</span><span class="property-value">${tags.join(', ') || '无'}</span></div>`;
            }
        };

        if (renderers[type]) return renderers[type];

        // 兜底渲染器：未知组件类型时，过滤掉 type 字段后按键值对显示
        return comp => {
            const entries = Object.entries(comp).filter(([key]) => key !== 'type');
            if (entries.length === 0) return '<div class="detail-property">无额外属性</div>';
            return entries.map(([key, value]) =>
                `<div class="detail-property"><span class="property-label">${key}</span><span class="property-value">${value}</span></div>`
            ).join('');
        };
    },

    /**
     * 获取组件类型的中文标签
     * @param {string} type - 组件类型
     * @returns {string} 中文标签或原类型名
     */
    _getComponentLabel(type) {
        return ({
            core: '基本信息',
            motion: '运动轨迹',
            nameHistory: '名称演变',
            person: '人物信息',
            place: '地点信息',
            organization: '组织信息',
            regime: '政权信息',
            customTags: '自定义标签'
        })[type] || type;
    },

    /**
     * 获取组件类型对应的 SVG 图标名称
     * @param {string} type - 组件类型
     * @returns {string} 图标名称
     */
    _getComponentIcon(type) {
        return ({
            core: 'page',
            motion: 'timeline',
            nameHistory: 'calendar',
            person: 'person',
            place: 'place',
            organization: 'organization',
            regime: 'regime',
            customTags: 'tag'
        })[type] || 'tag';
    },

    /**
     * 判断一个时间点是否超出 person 组件的寿命区间（出生~死亡）
     * @param {Object} entity - 完整实体对象
     * @param {Object} time - 要检查的时间
     * @returns {boolean} 是否超出寿命
     */
    _isWaypointOutsideLifespan(entity, time) {
        const personComp = entity.components.person;
        if (!personComp) return false;
        const { birthTime, deathTime } = personComp;
        // 没有设置寿命限制 → 不标记
        if (birthTime == null && deathTime == null) return false;
        if (birthTime != null && TimeUtils.compare(time, birthTime) < 0) return true;
        if (deathTime != null && TimeUtils.compare(time, deathTime) > 0) return true;
        return false;
    },

    // ───── 内联编辑 ─────

    /**
     * 将属性值变为可编辑状态
     * 根据字段类型选择不同的编辑方式：
     * - color → 弹出原生颜色选择器
     * - icon  → 弹出图标选择器（Modal）
     * - 其他  → 启用 contenteditable 原地编辑
     * @param {HTMLElement} valueEl - .property-value 元素
     */
    _makeEditable(valueEl) {
        const field = valueEl.dataset.field;
        if (field === 'color') this._editColor(valueEl);
        else if (field === 'icon') this._editIcon(valueEl);
        else this._editText(valueEl);
    },

    /**
     * 颜色字段编辑：创建隐藏的原生 color picker，点击后自动弹出
     * 选择颜色后通过 _saveField 保存，失焦时恢复面板显示
     */
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

        // 清理颜色选择器 DOM
        const cleanup = () => { if (document.body.contains(input)) document.body.removeChild(input); };
        // 颜色选择（实时保存）
        input.addEventListener('input', () => {
            this._saveField({ component: input.dataset.component, field: 'color', rawValue: input.value });
            cleanup();
        });
        // 失焦（未选择时恢复）
        input.addEventListener('blur', () => {
            this.renderDetail(AppState.get('selectedItem'));
            cleanup();
        });
        input.click();
    },

    /**
     * 图标字段编辑：弹出图标选择器（Modal）
     * 选择新图标后直接通过 command:execute 保存
     */
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

    /**
     * 文本/数字字段编辑：启用 contenteditable 原地编辑
     * 1. 设置 contenteditable 为 true
     * 2. 全选文本
     * 3. 绑定 blur → 保存，Enter → 保存并失焦，Escape → 取消编辑
     */
    _editText(valueEl) {
        const currentText = valueEl.textContent;
        const isPlaceholder = currentText === '未知' || currentText === '无';

        // 启用 contenteditable
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

        // 编辑完成：失焦时保存
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
                valueEl.textContent = currentText; // 恢复原值
                this.renderDetail(AppState.get('selectedItem'));
            }
        });
    },

    /**
     * 保存字段编辑结果（统一入口）
     * 自动处理类型转换：
     * - birthTime/deathTime → { year: number }
     * - 原始值为 number 则保持数值类型
     * - 其他字段保持字符串
     * 值未变化则不执行操作，通过 command:execute 实现可撤销
     */
    _saveField({ component: componentType, field, rawValue }) {
        const selectedItem = AppState.get('selectedItem');
        if (!selectedItem) return;
        const entity = selectedItem.data;
        const component = entity.components[componentType];
        if (!component) return;

        const originalValue = component[field];
        let newValue;

        // birthTime/deathTime：输入数字转为 { year: number } 格式
        if (field === 'birthTime' || field === 'deathTime') {
            const parsed = rawValue === '' ? null : Number(rawValue);
            newValue = parsed != null && !isNaN(parsed) ? { year: parsed } : originalValue;
        } else if (typeof originalValue === 'number') {
            // 数值字段转为数字
            newValue = rawValue === '' ? originalValue : Number(rawValue);
        } else {
            // 字符串字段
            newValue = rawValue || originalValue;
        }

        // 值未变化 → 不操作，刷新面板显示
        if (newValue === originalValue || JSON.stringify(newValue) === JSON.stringify(originalValue)) {
            this.renderDetail(selectedItem);
            return;
        }

        // 通过命令模式保存，支持 Undo/Redo
        EventBus.emit('command:execute', {
            type: 'editEntityField',
            entityId: entity.id, componentType, field,
            oldValue: originalValue, newValue
        });
    },

    // ───── 途径点 CRUD ─────

    /**
     * 处理途径点操作按钮点击的具体逻辑
     * data-component 来源：
     * - add-first-wp → 按钮自带的 data-component
     * - delete-wp / add-after-wp → 父级 <li> 的 data-component
     * @param {HTMLElement} btn - 被点击的按钮元素
     */
    _handleWaypointAction(btn) {
        const action = btn.dataset.action;
        if (!action) return;

        // 获取选中实体
        const selectedItem = AppState.get('selectedItem');
        if (!selectedItem) return;
        const entity = selectedItem.data;

        // 获取组件类型：优先从按钮自身读取，其次从父级 <li> 读取
        const componentType = btn.dataset.component
            || (btn.closest('li[data-component]') || {}).dataset.component;
        if (!componentType) return;

        // 根据 action 类型分发操作
        if (action === 'add-first-wp' || action === 'add-after-wp') {
            const index = action === 'add-first-wp' ? -1 : parseInt(btn.dataset.wpIndex, 10);
            if (action === 'add-after-wp' && isNaN(index)) return;
            this._addWaypoint(entity, componentType, index);
        } else if (action === 'delete-wp') {
            const index = parseInt(btn.dataset.wpIndex, 10);
            if (isNaN(index)) return;
            this._deleteWaypoint(entity, componentType, index);
        }
    },

    /**
     * 获取组件内的条目数组
     * @param {Object} entity - 实体对象
     * @param {string} componentType - 'motion' 或 'nameHistory'
     * @returns {Array|null} 条目数组（waypoints 或 entries）
     */
    _getItems(entity, componentType) {
        const comp = entity.components[componentType];
        return componentType === 'motion' ? (comp && comp.waypoints) : (comp && comp.entries);
    },

    /**
     * 获取保存时 command 所需的 field 名称
     * @param {string} componentType - 'motion' 或 'nameHistory'
     * @returns {string} 'waypoints' 或 'entries'
     */
    _getItemsField(componentType) {
        return componentType === 'motion' ? 'waypoints' : 'entries';
    },

    /**
     * 删除指定索引的途径点
     * 通过 command:execute 实现可撤销操作
     */
    _deleteWaypoint(entity, componentType, index) {
        const items = this._getItems(entity, componentType);
        if (!items || index < 0 || index >= items.length) return;

        const oldValue = JSON.parse(JSON.stringify(items));
        const newValue = items.filter((_, i) => i !== index);

        EventBus.emit('command:execute', {
            type: 'editEntityField',
            entityId: entity.id, componentType,
            field: this._getItemsField(componentType),
            oldValue, newValue
        });
    },

    /**
     * 在指定位置插入新途径点
     * 通过 command:execute 实现可撤销操作
     * @param {Object} entity - 实体对象
     * @param {string} componentType - 'motion' 或 'nameHistory'
     * @param {number} afterIndex - 在此索引后插入（-1 表示在开头插入）
     */
    _addWaypoint(entity, componentType, afterIndex) {
        const items = this._getItems(entity, componentType);
        if (!items) return;

        const oldValue = JSON.parse(JSON.stringify(items));

        // 根据组件类型创建新条目默认值
        const newItem = componentType === 'motion'
            ? this._createMotionDefault(items, afterIndex)
            : this._createNameHistoryDefault(items, afterIndex);

        const newValue = [...items];
        newValue.splice(afterIndex === -1 ? 0 : afterIndex + 1, 0, newItem);

        EventBus.emit('command:execute', {
            type: 'editEntityField',
            entityId: entity.id, componentType,
            field: this._getItemsField(componentType),
            oldValue, newValue
        });
    },

    /**
     * 创建 motion 组件新途径点的默认值
     * - 默认时间：由 _computeDefaultTime 根据相邻途径点计算
     * - 默认位置：由 _computeDefaultPosition 根据相邻途径点计算
     * - 默认名称："新途径点"，描述："请输入描述"
     */
    _createMotionDefault(items, afterIndex) {
        const zoomLevel = AppState.get('timeZoomLevel') || 'year';
        const step = TimeUtils.getResolutionStep();

        // 计算默认时间
        const defaultTime = this._computeDefaultTime(items, afterIndex, step,
            // getPrev：取前一个 waypoint 的 departure 时间
            (item) => item.time.departure || item.time.arrival || item.time || { year: 0 },
            // getNext：取后一个 waypoint 的 arrival 时间
            (item) => item.time.arrival || item.time.departure || item.time || { year: 0 }
        );

        // 计算默认位置
        const defaultPos = this._computeDefaultPosition(items, afterIndex);

        return {
            time: { arrival: { ...defaultTime }, departure: { ...defaultTime } },
            lat: defaultPos.lat, lng: defaultPos.lng,
            name: '新途径点', description: '请输入描述',
            resolution: zoomLevel
        };
    },

    /**
     * 创建 nameHistory 组件新条目的默认值
     * - 默认时间：由 _computeDefaultTime 根据相邻条目计算
     * - 默认名称："新名称"，描述："请输入描述"
     */
    _createNameHistoryDefault(items, afterIndex) {
        const step = TimeUtils.getResolutionStep();
        const defaultTime = this._computeDefaultTime(items, afterIndex, step,
            (item) => item.time || { year: 0 },
            (item) => item.time || { year: 0 }
        );
        return { time: { ...defaultTime }, name: '新名称', description: '请输入描述' };
    },

    /**
     * 计算新途径点的默认位置
     * - 空列表    → (0, 0)
     * - 开头插入  → 后一个途径点的位置
     * - 中间插入  → 前后途径点的位置中点
     * - 末尾插入  → 前一个途径点的位置
     * @param {Array} items      - 现有条目数组
     * @param {number} afterIndex - 插入位置（-1 表示开头）
     * @returns {Object} { lat, lng }
     */
    _computeDefaultPosition(items, afterIndex) {
        if (items.length === 0) return { lat: 0, lng: 0 };
        if (afterIndex === -1) {
            return { lat: items[0].lat, lng: items[0].lng };
        }
        if (afterIndex < items.length - 1) {
            return {
                lat: (items[afterIndex].lat + items[afterIndex + 1].lat) / 2,
                lng: (items[afterIndex].lng + items[afterIndex + 1].lng) / 2
            };
        }
        return { lat: items[afterIndex].lat, lng: items[afterIndex].lng };
    },

    /**
     * 通用默认时间计算
     * 根据插入位置和相邻条目自动计算合理的时间值：
     * - 空列表    → 当前时间（来自 AppState）
     * - 开头插入  → 后一个条目时间 - 10 × step
     * - 中间插入  → 前后条目的时间中点（TimeUtils.lerp ratio=0.5）
     * - 末尾插入  → 前一个条目时间 + 10 × step
     * @param {Array}    items      - 现有条目数组
     * @param {number}   afterIndex - 插入位置（-1 表示开头）
     * @param {number}   step       - 步进值（minUnit）
     * @param {Function} getPrev    - 从条目提取"前一个"时间
     * @param {Function} getNext    - 从条目提取"后一个"时间
     * @returns {Object} 时间对象
     */
    _computeDefaultTime(items, afterIndex, step, getPrev, getNext) {
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
    },

    // ───── 面板开关 ─────

    /**
     * 设置面板开关状态（统一入口）
     * 写入 AppState.isDetailPanelOpen，自动触发布局重算
     * @param {boolean} open
     */
    _toggle(open) {
        AppState.set('isDetailPanelOpen', open);
    },

    /**
     * 根据 isDetailPanelOpen 更新 body 的 detail--closed 类
     * 控制面板的 CSS display 动画
     * @param {boolean} isOpen
     */
    _updateOpenState(isOpen) {
        this.elements.body.classList.toggle('detail--closed', !isOpen);
    }
};

window.DetailPanel = DetailPanel;