/**
 * 右键菜单模块（全局单例）
 * 职责：
 * - 在地图右键时显示菜单
 * - 自动调整位置，防止溢出屏幕
 * - 点击菜单外部自动隐藏
 * - 菜单项点击时通过 EventBus 通知外部
 */
const ContextMenu = {
    // DOM 元素缓存
    menu: null,
    map: null,

    /**
     * 初始化模块
     * @param {Object} mapInstance - Leaflet 地图实例
     */
    init(mapInstance) {
        this.map = mapInstance;
        this.menu = document.getElementById('context-menu');

        if (!this.menu) {
            console.error('ContextMenu: 找不到 #context-menu 元素');
            return;
        }

        // 绑定地图右键事件
        this.map.on('contextmenu', this._onMapRightClick.bind(this));

        // 点击其他地方关闭菜单
        document.addEventListener('mousedown', this._onDocumentMouseDown.bind(this));

        // 为菜单项绑定点击事件
        this.menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', this._onMenuItemClick.bind(this));
        });
    },

    /**
     * 显示菜单
     * @param {number} x - 鼠标客户坐标 X
     * @param {number} y - 鼠标客户坐标 Y
     */
    show(x, y) {
        this.menu.classList.remove('is-hidden');

        // 先设置初始位置，再读取尺寸（避免出现在上次位置导致跳动）
        this.menu.style.left = x + 'px';
        this.menu.style.top = y + 'px';

        // 读取菜单实际尺寸
        const menuWidth = this.menu.offsetWidth;
        const menuHeight = this.menu.offsetHeight;

        const screenW = window.innerWidth;
        const screenH = window.innerHeight;

        // 超出右边界
        if (x + menuWidth > screenW) {
            x = screenW - menuWidth - 5;
        }
        // 超出下边界
        if (y + menuHeight > screenH) {
            y = screenH - menuHeight - 5;
        }

        this.menu.style.left = x + 'px';
        this.menu.style.top = y + 'px';
    },

    /**
     * 隐藏菜单
     */
    hide() {
        this.menu.classList.add('is-hidden');
    },

    // ---------- 内部事件处理 ----------

    _onMapRightClick(event) {
        event.originalEvent.preventDefault();
        const x = event.originalEvent.clientX;
        const y = event.originalEvent.clientY;
        this.show(x, y);
    },

    _onDocumentMouseDown(event) {
        // 左键点击菜单外部时关闭
        if (event.button === 0 && !this.menu.contains(event.target)) {
            this.hide();
        }
    },

    _onMenuItemClick(event) {
        const action = event.target.dataset.action;
        if (action) {
            EventBus.emit('contextMenu:action', { action });
        }
        this.hide();
    }
};