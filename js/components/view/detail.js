/**
 * 详情面板模块（全局单例）
 * 职责：
 * - 监听 selectedItem 变化，自动打开/关闭面板并渲染内容
 * - 管理详情面板的可见状态（写入 AppState.isDetailPanelOpen，触发布局更新）
 * - 提供关闭按钮，清空选中项
 * - 响应 isDetailPanelOpen 状态，更新 body 类
 * - 支持双击属性值进行内联编辑，回车或失焦自动保存
 *
 * 与 Sidebar 的对应关系：
 *   - _toggle  → 不再直接由按钮调用，面板打开由 selectedItem 驱动
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

        // 4. 双击编辑功能（事件委托）
        this.elements.content.addEventListener('dblclick', (e) => {
            const valueEl = e.target.closest('.property-value');
            if (!valueEl || !valueEl.dataset.field) return;
            this._makeEditable(valueEl);
        });

        // 5. 根据初始状态设置面板
        const initialItem = AppState.get('selectedItem');
        if (initialItem) {
            this.renderDetail(initialItem);
            this._toggle(true);
        } else {
            this._toggle(false);
        }
    },

    /**
     * 响应状态变化
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

        //获取实体所有组件
        const components = Object.values(entity.data.components);

        //为每个组件生成一个折叠区块
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
    * @returns {HTMLElement}
    */
    _renderComponentSection(component) {
        const type = component.type;
        //core组件不参与渲染
        //if (type === 'core') return null;
        //获取渲染器
        const renderer = this._getComponentRenderer(type);
        if (!renderer) return null;//未知组件不渲染

        //创建区块容器
        const wrapper = document.createElement('div');
        wrapper.className = 'detail-component-block';

        //区块标题
        const header = document.createElement('div');
        header.className = 'detail-component-header';
        header.innerHTML = `
            <span class="icon" data-name="${this._getComponentIcon(type)}"></span>
            <span class="detail-component-type">${this._getComponentLabel(type)}</span>
        `;
        wrapper.appendChild(header);

        //属性内容
        const body = document.createElement('div');
        body.className = 'detail-component-body';
        body.innerHTML = renderer(component);
        wrapper.appendChild(body);

        //初始化图标
        initIconsForContainer(wrapper);

        return wrapper;
    },

    /**
     * 根据组件类型返回渲染函数，函数返回 HTML 字符串
     * 每个 .property-value 需携带 data-component 和 data-field 属性以支持双击编辑
    */
    _getComponentRenderer(type) {
        const renderers = {
            core: comp => `
                <div class="detail-property"><span class="property-label">名称</span><span class="property-value" data-component="core" data-field="name">${comp.name}</span></div>
                <div class="detail-property"><span class="property-label">颜色</span><span class="property-value" data-component="core" data-field="color"><span class="color-swatch" style="background:${comp.color}"></span>${comp.color}</span></div>
                <div class="detail-property"><span class="property-label">默认图标</span><span class="property-value" data-component="core" data-field="icon">${comp.icon}</span></div>
            `,
            timeline: comp => {
                if (!comp.waypoints || comp.waypoints.length === 0) {
                    return '<div class="detail-property">无轨迹数据</div>';
                }
                const listItems = comp.waypoints.map(wp =>
                    `<li class="waypoint-item"><span class="time-badge">${wp.time}</span> (${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)})</li>`
                ).join('');
                return `<ul class="detail-waypoint-list">${listItems}</ul>`;
            },
            person: comp => `
                <div class="detail-property"><span class="property-label">出生时间</span><span class="property-value" data-component="person" data-field="birthTime">${comp.birthTime ?? '未知'}</span></div>
                <div class="detail-property"><span class="property-label">死亡时间</span><span class="property-value" data-component="person" data-field="deathTime">${comp.deathTime ?? '未知'}</span></div>
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

        return comp => {
            const entries = Object.entries(comp).filter(([key]) => key !== 'type');
            if (entries.length === 0) return '<div class="detail-property">无额外属性</div>';
            return entries.map(([key, value]) =>
                `<div class="detail-property"><span class="property-label">${key}</span><span class="property-value">${value}</span></div>`
            ).join('');
        };
    },

    /**
     * 将属性值变为可编辑输入框
     * @param {HTMLElement} valueEl - .property-value 元素
     */
    _makeEditable(valueEl) {
        const currentText = valueEl.textContent;
        const field = valueEl.dataset.field;

        // 长文本字段使用 textarea
        const useTextarea = field === 'description';

        const input = useTextarea ? document.createElement('textarea') : document.createElement('input');

        // 显示值为 '未知' 或 '无' 时输入框留空
        const isPlaceholder = currentText === '未知' || currentText === '无';
        const initialValue = isPlaceholder ? '' : currentText;

        if (useTextarea) {
            input.value = initialValue;
            input.className = 'detail-edit-textarea';
        } else {
            // 数字字段使用 number 类型
            if (field === 'birthTime' || field === 'deathTime') {
                input.type = 'number';
            } else {
                input.type = 'text';
            }
            input.value = initialValue;
            input.className = 'detail-edit-input';
        }

        input.dataset.component = valueEl.dataset.component;
        input.dataset.field = field;

        // 替换内容
        valueEl.textContent = '';
        valueEl.appendChild(input);
        input.focus();
        input.select();

        // 保存回调
        const saveHandler = () => this._saveEdit(input);

        input.addEventListener('blur', saveHandler);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !useTextarea) {
                e.preventDefault();
                input.blur();
            }
            if (e.key === 'Escape') {
                // 取消编辑，重新渲染面板还原
                this.renderDetail(AppState.get('selectedItem'));
            }
        });
    },

    /**
     * 保存编辑内容到实体数据，同步到 AppState
     * @param {HTMLInputElement|HTMLTextAreaElement} input
     */
    _saveEdit(input) {
        const componentType = input.dataset.component;
        const field = input.dataset.field;
        const rawValue = input.value;

        const selectedItem = AppState.get('selectedItem');
        if (!selectedItem) return;

        const entity = selectedItem.data;
        const component = entity.components[componentType];
        if (!component) return;

        // 保持与原始值类型一致（数字/字符串）
        const originalValue = component[field];
        let newValue;
        if (typeof originalValue === 'number') {
            newValue = rawValue === '' ? originalValue : Number(rawValue);
        } else {
            newValue = rawValue || originalValue;
        }

        // 值未变化则不更新
        if (newValue === originalValue) {
            this.renderDetail(selectedItem);
            return;
        }

        // 通过命令模式执行编辑，支持 Undo/Redo
        EventBus.emit('command:execute', {
            type: 'editEntityField',
            entityId: entity.id,
            componentType: componentType,
            field: field,
            oldValue: originalValue,
            newValue: newValue
        });
    },

    _getComponentLabel(type) {
        const labels = {
            core: '基本信息',
            timeline: '时间轴轨迹',
            person: '人物信息',
            organization: '组织信息',
            regime: '政权信息',
            customTags: '自定义标签'
        };
        return labels[type] || type;
    },

    _getComponentIcon(type) {
        const icons = {
            core: 'page',
            timeline: 'timeline',
            person: 'person',
            organization: 'organization',
            regime: 'regime',
            customTags: 'tag'
        };
        return icons[type] || 'tag';
    },

    /**
     * 设置开/关状态（统一修改入口）
     * @param {boolean} open - true 打开, false 关闭
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