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
        this.elements.filterPanel = document.querySelector('.sidebar-content-panel--filter');
        this.elements.filterTabBtn = document.querySelector('.sidebar-tabs-btn[data-name="filter"]');

        // 2. 绑定开关按钮事件
        this.elements.btnClose.addEventListener('click', () => this._toggle(false));
        this.elements.btnOpen.addEventListener('click', () => this._toggle(true));

        // 3. 初始化筛选面板
        this._initFilterPanel();

        // 4. 动态生成资源面板，并绑定点击事件
        this._initContentSubitemClick(this.elements.explorerPanel);

        // 5. 绑定 Tab 切换
        this._initTabSwitching();

        // 4. 监听 AppState 变化
        EventBus.on('state:change', this._onStateChange.bind(this));

        // 5. 根据初始状态设置 body 类
        if (AppState.get('isSidebarOpen') === false) {
            this.elements.body.classList.add('sidebar--closed');
        }

        // 6. 监听地图移动/缩放，当地图范围筛选启用时刷新列表
        if (MapView.map) {
            MapView.map.on('moveend', () => {
                const criteria = AppState.get('filterCriteria');
                if (criteria && criteria.mapBounds && criteria.mapBounds.enabled) {
                    this.renderResourceList();
                }
            });
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
     * 初始化筛选面板 UI
     */
    _initFilterPanel() {
        const container = this.elements.filterPanel;
        if (!container) return;

        const criteria = AppState.get('filterCriteria');

        container.innerHTML = `
            <div class="filter-section" data-section="keyword">
                <input type="text" class="filter-search-input" id="filter-search-input" placeholder="搜索实体名称..." value="${this._escapeHtml(criteria.keyword)}">
            </div>
            <div class="filter-section" data-section="entityTypes">
                <div class="filter-section-header">
                    <span class="filter-section-title">实体类型</span>
                </div>
                <div class="filter-checkbox-group" id="filter-type-checkboxes">
                    <label class="filter-checkbox"><input type="checkbox" data-type="person" ${criteria.entityTypes.person ? 'checked' : ''}> <span class="icon" data-name="person"></span>人物</label>
                    <label class="filter-checkbox"><input type="checkbox" data-type="place" ${criteria.entityTypes.place ? 'checked' : ''}> <span class="icon" data-name="place"></span>地点</label>
                    <label class="filter-checkbox"><input type="checkbox" data-type="organization" ${criteria.entityTypes.organization ? 'checked' : ''}> <span class="icon" data-name="organization"></span>组织</label>
                    <label class="filter-checkbox"><input type="checkbox" data-type="regime" ${criteria.entityTypes.regime ? 'checked' : ''}> <span class="icon" data-name="regime"></span>政权</label>
                    <label class="filter-checkbox"><input type="checkbox" data-type="customTags" ${criteria.entityTypes.customTags ? 'checked' : ''}> <span class="icon" data-name="tag"></span>自定义标签</label>
                </div>
                <div class="filter-type-actions">
                    <button class="filter-btn-sm" id="filter-type-all">全选</button>
                    <button class="filter-btn-sm" id="filter-type-none">取消全选</button>
                </div>
            </div>
            <div class="filter-section" data-section="time">
                <div class="filter-section-header">
                    <span class="filter-section-title">时间筛选</span>
                    <label class="filter-toggle">
                        <input type="checkbox" id="filter-time-toggle" ${criteria.timeFilter.enabled ? 'checked' : ''}>
                        <span class="filter-toggle-slider"></span>
                    </label>
                </div>
                <div class="filter-time-body" id="filter-time-body" style="display:${criteria.timeFilter.enabled ? 'block' : 'none'}">
                    <label class="filter-radio"><input type="radio" name="filter-time-mode" value="followTimeline" ${criteria.timeFilter.followTimeline ? 'checked' : ''}> 跟随时间轴</label>
                    <label class="filter-radio"><input type="radio" name="filter-time-mode" value="custom" ${!criteria.timeFilter.followTimeline ? 'checked' : ''}> 自定义时间</label>
                    <div class="filter-time-custom" id="filter-time-custom" style="display:${!criteria.timeFilter.followTimeline ? 'flex' : 'none'}">
                        <input type="number" class="filter-time-input" id="filter-time-from-year" placeholder="年" value="${criteria.timeFilter.from?.year ?? ''}" min="-9999" max="9999">
                        <input type="number" class="filter-time-input" id="filter-time-from-month" placeholder="月" value="${criteria.timeFilter.from?.month ?? ''}" min="1" max="12">
                        <span class="filter-time-sep">—</span>
                        <input type="number" class="filter-time-input" id="filter-time-to-year" placeholder="年" value="${criteria.timeFilter.to?.year ?? ''}" min="-9999" max="9999">
                        <input type="number" class="filter-time-input" id="filter-time-to-month" placeholder="月" value="${criteria.timeFilter.to?.month ?? ''}" min="1" max="12">
                    </div>
                </div>
            </div>
            <div class="filter-section" data-section="mapBounds">
                <div class="filter-section-header">
                    <span class="filter-section-title">地图范围</span>
                    <label class="filter-toggle">
                        <input type="checkbox" id="filter-map-toggle" ${criteria.mapBounds.enabled ? 'checked' : ''}>
                        <span class="filter-toggle-slider"></span>
                    </label>
                </div>
                <div class="filter-section-hint">仅显示当前地图视野内的实体</div>
            </div>
            <div class="filter-section" data-section="reset">
                <button class="filter-reset-btn" id="filter-reset-btn">重置所有筛选</button>
            </div>
        `;

        // 初始化 SVG 图标
        initIconsForContainer(container);

        // 绑定事件
        this._bindFilterEvents(container);
    },

    /**
     * 绑定筛选面板事件
     */
    _bindFilterEvents(container) {
        // 类型复选框
        const typeCheckboxes = container.querySelectorAll('#filter-type-checkboxes input[type="checkbox"]');
        typeCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => this._onTypeFilterChange());
        });

        // 全选 / 取消全选
        container.querySelector('#filter-type-all').addEventListener('click', () => {
            typeCheckboxes.forEach(cb => { cb.checked = true; });
            this._onTypeFilterChange();
        });
        container.querySelector('#filter-type-none').addEventListener('click', () => {
            typeCheckboxes.forEach(cb => { cb.checked = false; });
            this._onTypeFilterChange();
        });

        // 搜索框 (debounce 300ms)
        const searchInput = container.querySelector('#filter-search-input');
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this._updateFilterCriteria({ keyword: searchInput.value });
            }, 300);
        });

        // 时间筛选 Toggle
        container.querySelector('#filter-time-toggle').addEventListener('change', (e) => {
            const enabled = e.target.checked;
            container.querySelector('#filter-time-body').style.display = enabled ? 'block' : 'none';
            const criteria = AppState.get('filterCriteria');
            this._updateFilterCriteria({
                timeFilter: { ...criteria.timeFilter, enabled }
            });
        });

        // 时间模式切换
        container.querySelectorAll('input[name="filter-time-mode"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const followTimeline = radio.value === 'followTimeline';
                container.querySelector('#filter-time-custom').style.display = followTimeline ? 'none' : 'flex';
                const criteria = AppState.get('filterCriteria');
                this._updateFilterCriteria({
                    timeFilter: { ...criteria.timeFilter, followTimeline }
                });
            });
        });

        // 自定义时间输入
        const timeInputs = container.querySelectorAll('#filter-time-from-year, #filter-time-from-month, #filter-time-to-year, #filter-time-to-month');
        timeInputs.forEach(input => {
            input.addEventListener('change', () => this._onTimeCustomChange(container));
        });

        // 地图范围 Toggle
        container.querySelector('#filter-map-toggle').addEventListener('change', (e) => {
            this._updateFilterCriteria({
                mapBounds: { enabled: e.target.checked }
            });
        });

        // 重置按钮
        container.querySelector('#filter-reset-btn').addEventListener('click', () => {
            const defaultCriteria = {
                entityTypes: { person: true, place: true, organization: true, regime: true, customTags: true },
                timeFilter: { enabled: false, mode: 'moment', from: null, to: null, followTimeline: true },
                mapBounds: { enabled: false },
                keyword: '',
                tags: []
            };
            AppState.set('filterCriteria', defaultCriteria);
            this._initFilterPanel(); // 重建 UI
        });
    },

    /**
     * 类型筛选变化处理
     */
    _onTypeFilterChange() {
        const checkboxes = this.elements.filterPanel.querySelectorAll('#filter-type-checkboxes input[type="checkbox"]');
        const entityTypes = {};
        checkboxes.forEach(cb => {
            entityTypes[cb.dataset.type] = cb.checked;
        });
        this._updateFilterCriteria({ entityTypes });
    },

    /**
     * 自定义时间变化处理
     */
    _onTimeCustomChange(container) {
        const fromYear = parseInt(container.querySelector('#filter-time-from-year').value) || 0;
        const fromMonth = parseInt(container.querySelector('#filter-time-from-month').value) || 1;
        const toYear = parseInt(container.querySelector('#filter-time-to-year').value) || 0;
        const toMonth = parseInt(container.querySelector('#filter-time-to-month').value) || 1;

        const criteria = AppState.get('filterCriteria');
        this._updateFilterCriteria({
            timeFilter: {
                ...criteria.timeFilter,
                from: { year: fromYear, month: fromMonth, day: 1 },
                to: { year: toYear, month: toMonth, day: 1 }
            }
        });
    },

    /**
     * 更新筛选条件（局部合并）
     */
    _updateFilterCriteria(delta) {
        const current = AppState.get('filterCriteria');
        const merged = { ...current, ...delta };
        AppState.set('filterCriteria', merged);
    },

    /**
     * HTML 转义
     */
    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * 更新筛选 Tab badge
     */
    _updateFilterBadge() {
        if (!this.elements.filterTabBtn) return;
        const criteria = AppState.get('filterCriteria');
        const count = FilterEngine.getActiveFilterCount(criteria);

        let badge = this.elements.filterTabBtn.querySelector('.filter-badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'filter-badge';
                this.elements.filterTabBtn.appendChild(badge);
            }
            badge.textContent = count;
            badge.style.display = 'flex';
        } else if (badge) {
            badge.style.display = 'none';
        }
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

        container.addEventListener('contextmenu', (e) => {
            const item = e.target.closest('.sidebar-content-subitem');
            if (!item) return;
            e.preventDefault();
            const entityId = item.dataset.entityId;
            if (entityId) {
                ContextMenu.show(e.clientX, e.clientY, {
                    type: 'sidebar-entity',
                    entityId
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
                // 若启用了时间筛选且跟随时间轴，刷新列表
                const filterCriteria = AppState.get('filterCriteria');
                if (filterCriteria && filterCriteria.timeFilter && filterCriteria.timeFilter.enabled && filterCriteria.timeFilter.followTimeline) {
                    this.renderResourceList();
                }
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
            case 'filterCriteria':
                // 筛选条件变化 → 刷新资源列表 + 更新 badge
                this.renderResourceList();
                this._updateFilterBadge();
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

        const allEntities = AppState.get('entities') || [];
        const criteria = AppState.get('filterCriteria');
        const currentTime = AppState.get('currentTime');
        const mapBounds = MapView.map ? MapView.map.getBounds() : null;

        // 应用筛选
        const entities = FilterEngine.apply(allEntities, criteria, { currentTime, mapBounds });

        // 保存当前展开状态
        const expandedTypes = new Set();
        container.querySelectorAll('.sidebar-content-panel-btn.active').forEach(btn => {
            const type = btn.dataset.type;
            if (type) expandedTypes.add(type);
        });

        //清空面板
        container.innerHTML = '';

        // 空结果提示
        if (entities.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'sidebar-content-empty';
            emptyMsg.textContent = '没有匹配的实体';
            container.appendChild(emptyMsg);
            return;
        }

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
            btn.dataset.type = type;
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

            // 恢复展开状态
            if (expandedTypes.has(type)) {
                btn.classList.add('active');
            }

            container.appendChild(btn);
            container.appendChild(subPanel);

            initIconsForContainer(btn);
            initIconsForContainer(subPanel);
        }
    },
};