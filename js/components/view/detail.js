/**
 * 详情面板模块（全局单例）
 * 职责：
 * - 监听 selectedItem 变化，自动打开/关闭面板并渲染内容
 * - 管理详情面板的可见状态（写入 AppState.isDetailPanelOpen，触发布局更新）
 * - 提供关闭按钮，清空选中项
 * - 响应 isDetailPanelOpen 状态，更新 body 类
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

        // 4. 根据初始状态设置面板
        const initialItem = AppState.get('selectedItem');
        if (initialItem) {
            console.log("selected Item");
            this.renderDetail(initialItem);
            this._toggle(true);
        } else {
            console.log("none selected Item");
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
        if (type === 'core') return null;
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
    */
    _getComponentRenderer(type) {
        const renderers = {
            core: comp => `
                <div class="detail-property"><span class="property-label">名称</span><span class="property-value">${comp.name}</span></div>
                <div class="detail-property"><span class="property-label">颜色</span><span class="property-value"><span class="color-swatch" style="background:${comp.color}"></span>${comp.color}</span></div>
                <div class="detail-property"><span class="property-label">默认图标</span><span class="property-value">${comp.icon}</span></div>
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
                <div class="detail-property"><span class="property-label">出生时间</span><span class="property-value">${comp.birthTime ?? '未知'}</span></div>
                <div class="detail-property"><span class="property-label">死亡时间</span><span class="property-value">${comp.deathTime ?? '未知'}</span></div>
                <div class="detail-property"><span class="property-label">性别</span><span class="property-value">${comp.gender ?? '未知'}</span></div>
                <div class="detail-property"><span class="property-label">描述</span><span class="property-value">${comp.description || '无'}</span></div>
            `,
            organization: comp => `
                <div class="detail-property"><span class="property-label">总部</span><span class="property-value">${comp.headquarters || '未知'}</span></div>
                <div class="detail-property"><span class="property-label">领袖</span><span class="property-value">${comp.leader || '未知'}</span></div>
                <div class="detail-property"><span class="property-label">成员</span><span class="property-value">${comp.members || '未知'}</span></div>
            `,
            regime: comp => `
                <div class="detail-property"><span class="property-label">首都</span><span class="property-value">${comp.capital || '未知'}</span></div>
                <div class="detail-property"><span class="property-label">人口</span><span class="property-value">${comp.population || '未知'}</span></div>
                <div class="detail-property"><span class="property-label">政体</span><span class="property-value">${comp.governmentType || '未知'}</span></div>
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

    _getComponentLabel(type) {
        const labels = {
            timeline: '时间轴轨迹',
            person: '人物属性',
            organization: '组织信息',
            regime: '政权信息',
            customTags: '自定义标签'
        };
        return labels[type] || type;
    },

    _getComponentIcon(type) {
        const icons = {
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