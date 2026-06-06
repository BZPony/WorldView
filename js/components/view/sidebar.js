/**
 * 侧边栏模块（全局单例）
 * 职责：
 * - 管理侧边栏的打开/关闭状态（写入 AppState）
 * - Tab 切换（筛选 / 资源管理器）
 * - 一级面板按钮的展开/折叠
 * - 动态渲染人物列表
 * - 响应时间变化（可选，为将来扩展）
 * -
 */
const Sidebar = {
    // 缓存的 DOM 元素
    elements: {},

    /**
     * 初始化侧边栏
     */
    init() {
        // 1. 缓存关键 DOM 元素
        this.elements.body = document.body;
        this.elements.btnClose = document.getElementById('sidebar-btn-close');
        this.elements.btnOpen = document.getElementById('sidebar-btn-open');
        this.elements.explorerPanel = document.querySelector('.sidebar-content-panel--explorer');

        // 2. 绑定开关按钮事件
        this.elements.btnClose.addEventListener('click', () => this._toggle(false));
        this.elements.btnOpen.addEventListener('click', () => this._toggle(true));

        // 3. 动态生成资源面板，并绑定点击事件
        this._initContentSubitemClick(this.elements.explorerPanel);

        // 3. 绑定 Tab 切换
        this._initTabSwitching();

        // 4. 监听 AppState 变化
        EventBus.on('state:change', this._onStateChange.bind(this));

        // 5. 根据初始状态设置 body 类
        if (AppState.get('isSidebarOpen') === false) {
            this.elements.body.classList.add('sidebar--closed');
        }
    },

    /**
     * 设置侧边栏开/关状态（统一修改入口）
     * @param {boolean} open - true 打开, false 关闭
     */
    _toggle(open) {
        AppState.set('isSidebarOpen', open);
    },



    /**
     * 初始化 Tab 切换逻辑
     */
    _initTabSwitching() {
        const tabButtons = document.querySelectorAll('.sidebar-tabs-btn');
        const panels = document.querySelectorAll('.sidebar-content-panel');

        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.name;

                // 更新按钮激活状态
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 切换面板
                panels.forEach(panel => panel.classList.remove('active'));
                const targetPanel = document.querySelector(`.sidebar-content-panel--${target}`);
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }
            });
        });
    },

    _initContentSubitemClick(container) {
        container.addEventListener('click', (e) => {
            const item = e.target.closest('.sidebar-content-subitem');
            if (!item) return;

            const entityId = item.dataset.entityId;
            if (entityId) {
                EventBus.emit('ui:select', {
                    type: item.dataset.type,
                    id: item.dataset.entityId,
                });
            }

        });
    },
    /**
     * 响应 AppState 变化
     */
    _onStateChange(data) {
        switch (data.key) {
            case 'isSidebarOpen':
                this._updateOpenState(data.value);
                break;
            case 'currentTime':
                // 预留
                break;
            case 'entities':
                // 如果人物数据变化，刷新列表
                this.renderResourceList();
                // 重新渲染后，如果之前有选中项，需重新高亮
                const currentSelected = AppState.get('selectedItem');
                if (currentSelected) {
                    this._highlightSelected(currentSelected);
                }
                break;
            case 'selectedItem':
                if (data.value) {
                    // 确保侧边栏打开
                    if (!AppState.get('isSidebarOpen')) {
                        AppState.set('isSidebarOpen', true);
                    }
                    // 切换到资源管理器 Tab
                    this._switchToTab('explorer');
                    // 高亮、展开、滚动
                    this._highlightAndReveal(data.value);
                } else {
                    this._highlightSelected(null);
                }
                break;

            // 其他状态变化...
        }
    },

    /**
    * 高亮当前选中的子项
     * @param {Object|null} selectedItem - { type, data } 或 null
     */
    _highlightSelected(selectedItem) {
        // 清除所有高亮
        const allItems = document.querySelectorAll('.sidebar-content-subitem.active');
        allItems.forEach(item => item.classList.remove('active'));

        if (!selectedItem) return;

        // selectedItem.data 现在是实体对象（SelectManager 改造后）
        const entityId = selectedItem.data.id;
        const item = document.querySelector(`.sidebar-content-subitem[data-entity-id="${entityId}"]`);
        if (item) {
            item.classList.add('active');
        }
    },

    _switchToTab(tabName) {
        const tabBtn = document.querySelector(`.sidebar-tabs-btn[data-name="${tabName}"]`);
        const targetPanel = document.querySelector(`.sidebar-content-panel--${tabName}`);
        if (tabBtn && targetPanel) {
            // 激活按钮
            document.querySelectorAll('.sidebar-tabs-btn').forEach(b => b.classList.remove('active'));
            tabBtn.classList.add('active');
            // 切换面板
            document.querySelectorAll('.sidebar-content-panel').forEach(p => p.classList.remove('active'));
            targetPanel.classList.add('active');
        }
    },

    _highlightAndReveal(selectedItem) {
        const entityId = selectedItem.data.id;
        const item = document.querySelector(`.sidebar-content-subitem[data-entity-id="${entityId}"]`);
        if (!item) return;

        // 清除所有高亮
        document.querySelectorAll('.sidebar-content-subitem.active').forEach(el => el.classList.remove('active'));
        // 设置高亮
        item.classList.add('active');

        // 展开包含该项的折叠面板
        const subPanel = item.closest('.sidebar-content-subpanel');
        if (subPanel) {
            const btn = subPanel.previousElementSibling;
            if (btn && btn.classList.contains('sidebar-content-panel-btn')) {
                btn.classList.add('active');
            }
        }

        // 滚动到该项
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    /**
     * 实际执行打开/关闭的 UI 更新
    * 由 state:change 触发，而不是直接调用
     */
    _updateOpenState(isOpen) {
        if (isOpen) {
            this.elements.body.classList.remove('sidebar--closed');
        } else {
            this.elements.body.classList.add('sidebar--closed');
        }
    },

    /**
    * 根据实体组件类型动态生成资源列表
    */
    renderResourceList() {
        const container = this.elements.explorerPanel;
        if (!container) return;

        const entities = AppState.get('entities') || [];

        //按组件类型分类，默认组件类型为人物、组织、政权、地点，还有用户自定义tag
        const groups = {};
        entities.forEach(entity => {
            for (const comp of Object.values(entity.components)) {
                if (comp.type !== 'person' && comp.type !== 'regime' &&
                    comp.type !== 'organization' && comp.type !== 'customTags' &&
                    comp.type !== 'place')
                    continue;

                if (comp.type === 'customTags') {
                    //自定义标签组件
                    const tags = comp.tags || [];
                    tags.forEach(tag => {
                        if (!groups[tag]) {
                            groups[tag] = []
                        }
                        groups[tag].push(entity);
                    });
                }
                else {
                    if (!groups[comp.type]) {
                        groups[comp.type] = [];
                    }
                    groups[comp.type].push(entity);
                }
            }
        })

        //清空面板
        container.innerHTML = '';

        //为每种组件创建折叠区块
        for (const [type, entitiesInGroup] of Object.entries(groups)) {
            // 类型配置：包含中文标签和对应的图标名，非用户自定义
            const typeConfig = {
                person: { label: '人物', icon: 'person' },
                place: { label: '地点', icon: 'place' },
                organization: { label: '组织', icon: 'organization' },
                regime: { label: '政权', icon: 'regime' }
            };

            const config = typeConfig[type] || { label: type, icon: 'tag' };   // 用户自定义类型默认使用 tag 图标
            const btn = document.createElement('div');
            btn.className = 'sidebar-content-panel-btn';
            btn.innerHTML = `
                <span class="icon" data-name="${config.icon}"></span>
                ${config.label}
                <span class="icon" data-name="rightArrow"></span>
            `;

            //子面板
            const subPanel = document.createElement('div');
            subPanel.className = 'sidebar-content-subpanel';

            //填充实体子项
            entitiesInGroup.forEach(entity => {
                const core = entity.components.core;
                const item = document.createElement('div');
                item.className = 'sidebar-content-subitem';
                item.dataset.entityId = entity.id;
                item.dataset.type = 'entity';

                //颜色图标
                const colorIcon = document.createElement('span');
                colorIcon.className = 'icon';
                colorIcon.dataset.name = 'color';
                colorIcon.style.color = core.color;

                //实体名称
                const textNode = document.createTextNode(core.name);

                item.appendChild(colorIcon);
                item.appendChild(textNode);
                subPanel.appendChild(item);
            });

            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
            });

            container.appendChild(btn);
            container.appendChild(subPanel);

            initIconsForContainer(btn);
            initIconsForContainer(subPanel);
        }
    },
};