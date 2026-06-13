/**
 * 右键菜单模块（全局单例）
 * 职责：
 * - 根据调用场景（地图 / Sidebar 等）动态渲染不同的菜单项
 * - 自动调整位置，防止溢出屏幕
 * - 点击菜单外部自动隐藏
 * - 菜单项点击时通过 EventBus 通知外部
 */
const ContextMenu = {
    menu: null,
    map: null,
    lastClickLatLng: null,
    _context: null,

    init(mapInstance) {
        this.map = mapInstance;
        this.menu = document.getElementById('context-menu');
        if (!this.menu) { console.error('ContextMenu: 找不到 #context-menu 元素'); return; }

        this.map.on('contextmenu', this._onMapRightClick.bind(this));
        document.addEventListener('mousedown', this._onDocumentMouseDown.bind(this));
    },

    /**
     * 显示菜单
     * @param {number} x
     * @param {number} y
     * @param {Object} [context] — { type: 'map' | 'sidebar-entity', ... }
     */
    show(x, y, context = { type: 'map' }) {
        this._buildMenuItems(context);
        this.menu.classList.remove('is-hidden');

        this.menu.style.left = x + 'px';
        this.menu.style.top = y + 'px';

        const menuWidth = this.menu.offsetWidth;
        const menuHeight = this.menu.offsetHeight;
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        if (x + menuWidth > screenW) x = screenW - menuWidth - 5;
        if (y + menuHeight > screenH) y = screenH - menuHeight - 5;
        this.menu.style.left = x + 'px';
        this.menu.style.top = y + 'px';
    },

    hide() {
        this.menu.classList.add('is-hidden');
    },

    // ───── 动态菜单构建 ─────

    _buildMenuItems(context) {
        this._context = context;
        const items = this._getMenuConfig(context);
        this.menu.innerHTML = '';
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'context-menu-item';
            div.dataset.action = item.action;
            div.textContent = item.label;
            if (item.disabled) div.classList.add('context-menu-item--disabled');
            div.addEventListener('click', () => { this._onItemClick(item.action); this.hide(); });
            this.menu.appendChild(div);
        });
    },

    _getMenuConfig(context) {
        switch (context.type) {
            case 'map':
                return [
                    { action: 'createPerson', label: '创建人物' },
                    { action: 'createPlace', label: '创建地点' },
                    { action: 'createWaypoint', label: '创建途径点', disabled: !this._hasMovableSelected() }
                ];
            case 'sidebar-entity':
                return [
                    { action: 'deleteEntity', label: '删除' }
                ];
            default:
                return [];
        }
    },

    _hasMovableSelected() {
        const selectedItem = AppState.get('selectedItem');
        return selectedItem && !!selectedItem.data.components.motion;
    },

    _onItemClick(action) {
        EventBus.emit('contextMenu:action', {
            action,
            latlng: this.lastClickLatLng,
            context: this._context
        });
    },

    // ───── 地图右键 ─────

    _onMapRightClick(event) {
        event.originalEvent.preventDefault();
        this.lastClickLatLng = event.latlng;
        this.show(event.originalEvent.clientX, event.originalEvent.clientY, { type: 'map' });
    },

    _onDocumentMouseDown(event) {
        if (event.button === 0 && !this.menu.contains(event.target)) this.hide();
    }
};