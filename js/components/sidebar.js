/**
 * 侧边栏模块（全局单例）
 * 职责：
 * - 管理侧边栏的打开/关闭状态（写入 AppState）
 * - Tab 切换（筛选 / 资源管理器）
 * - 一级面板按钮的展开/折叠
 * - 动态渲染人物列表
 * - 响应时间变化（可选，为将来扩展）
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
        this.elements.personList = document.getElementById('person-list');

        // 2. 绑定开关按钮事件
        this.elements.btnClose.addEventListener('click', () => this._toggle(false));
        this.elements.btnOpen.addEventListener('click', () => this._toggle(true));

        // 3. 绑定 Tab 切换
        this._initTabSwitching();

        // 4. 绑定面板按钮的展开/折叠
        this._initPanelAccordion();

        // 5. 监听 AppState 变化
        EventBus.on('stateChange', this._onStateChange.bind(this));

        // 6. 根据初始状态设置 body 类
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

    /**
     * 面板按钮的折叠/展开（手风琴效果）
     */
    _initPanelAccordion() {
        const panelButtons = document.querySelectorAll('.sidebar-content-panel-btn');
        panelButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
            });
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
                // 当时间变化时，可以在此处筛选显示的人物（可选）
                // 目前暂不处理，因为 renderPersonList 展示全部人物。
                // 若你想只显示当前时间存在的人物，可在这里调用 renderPersonList 并加入过滤逻辑。
                break;
            case 'persons':
                // 如果人物数据变化，刷新列表
                this.renderPersonList();
                break;
            // 其他状态变化...
        }
    },

    /**
     * 实际执行打开/关闭的 UI 更新
    * 由 stateChange 触发，而不是直接调用
     */
    _updateOpenState(isOpen) {
        if (isOpen) {
            this.elements.body.classList.remove('sidebar--closed');
        } else {
            this.elements.body.classList.add('sidebar--closed');
        }
    },

    /**
    * 渲染人物列表（从 AppState 获取 persons）
    */
    renderPersonList() {
        const container = this.elements.personList;
        if (!container) return;

        const persons = AppState.get('persons') || [];
        container.innerHTML = '';

        persons.forEach(person => {
            const item = document.createElement('div');
            item.className = 'sidebar-content-subitem';
            item.textContent = person.name;
            // 注意：这里我们使用了 <ul> 作为子面板容器，所以应当用 <li>。
            // 如果你的 HTML 中 person-list 是 <div>，可暂时保留用 <div>，但建议改为 <ul>。
            container.appendChild(item);
        });
    },
};