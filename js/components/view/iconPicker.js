/**
 * 图标选择器模块（全局单例）
 * 用于双击 detail 面板图字段时弹出一个网格选择器
 */
const IconPicker = {
    /** 可选图标列表（从 svg_icons 中筛选出可用的实体图标） */
    iconNames: ['person', 'organization', 'regime', 'tag', 'page', 'timeline', 'place', 'delete', 'add'],

    _callback: null,  // 选择后的回调函数

    init() {
        this.elements = {
            overlay: document.getElementById('icon-picker-overlay'),
            picker: document.getElementById('icon-picker'),
            grid: document.getElementById('icon-picker-grid')
        };

        if (!this.elements.picker) return;

        this._buildGrid();
        this._bindEvents();
    },

    _buildGrid() {
        const grid = this.elements.grid;
        grid.innerHTML = '';

        this.iconNames.forEach(name => {
            const svg = getIcon(name, 32);
            if (!svg) return;

            const item = document.createElement('div');
            item.className = 'icon-picker-item';
            item.dataset.iconName = name;
            item.innerHTML = `<span class="icon">${svg}</span>`;

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this._select(name);
            });

            grid.appendChild(item);
        });
    },

    _bindEvents() {
        // 点击遮罩层关闭
        this.elements.overlay.addEventListener('click', () => this._close());
        // ESC 键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.elements.picker.classList.contains('is-hidden')) {
                this._close();
            }
        });
    },

    /**
     * 打开图标选择器
     * @param {string} currentIcon - 当前图标名称
     * @param {Function} callback - 选择后的回调，接收图标名称
     */
    open(currentIcon, callback) {
        this._callback = callback;
        this.elements.overlay.classList.remove('is-hidden');
        this.elements.picker.classList.remove('is-hidden');

        // 高亮当前选中的图标
        this.elements.grid.querySelectorAll('.icon-picker-item').forEach(item => {
            const isActive = item.dataset.iconName === currentIcon;
            item.style.background = isActive ? 'rgba(50, 120, 230, 0.4)' : '';
        });
    },

    _select(iconName) {
        if (this._callback) {
            this._callback(iconName);
        }
        this._close();
    },

    _close() {
        this.elements.overlay.classList.add('is-hidden');
        this.elements.picker.classList.add('is-hidden');
        this._callback = null;
    }
};