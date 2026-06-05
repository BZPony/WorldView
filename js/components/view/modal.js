/**
 * 通用弹窗系统（全局单例）
 * 提供通用的弹窗功能，支持多种内容变体。
 * 当前支持的变体：
 *   - IconPicker：图标网格选择器
 */
const Modal = {
    _callback: null,

    init() {
        this.elements = {
            overlay: document.getElementById('modal-overlay'),
            modal: document.getElementById('modal'),
            title: document.getElementById('modal-title'),
            body: document.getElementById('modal-body')
        };

        if (!this.elements.modal) return;

        this._bindEvents();
    },

    _bindEvents() {
        // 点击遮罩层关闭
        this.elements.overlay.addEventListener('click', () => this.close());
        // ESC 键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.elements.modal.classList.contains('is-hidden')) {
                this.close();
            }
        });
    },

    /**
     * 打开弹窗
     * @param {Object} options
     * @param {string} options.title - 弹窗标题
     * @param {string} options.html - 弹窗内容 HTML
     * @param {string} options.className - 附加的 CSS 类名
     * @param {Function} options.callback - 关闭时回调（接收数据）
     */
    open(options = {}) {
        this._callback = options.callback || null;
        this.elements.title.textContent = options.title || '';
        this.elements.body.innerHTML = options.html || '';

        // 设置附加类名
        this.elements.modal.className = 'modal';
        if (options.className) {
            this.elements.modal.classList.add(options.className);
        }

        this.elements.overlay.classList.remove('is-hidden');
        this.elements.modal.classList.remove('is-hidden');
    },

    /**
     * 关闭弹窗
     * @param {*} data - 可选，传递给回调的数据
     */
    close(data) {
        this.elements.overlay.classList.add('is-hidden');
        this.elements.modal.classList.add('is-hidden');
        if (this._callback) {
            this._callback(data);
        }
        this._callback = null;
    },

    // ───── 变体：IconPicker ─────

    /**
     * 可选的图标列表
     */
    _iconNames: ['person', 'organization', 'regime', 'tag', 'page', 'timeline', 'place', 'delete', 'add'],

    /**
     * 打开图标选择器
     * @param {string} currentIcon - 当前图标名称
     * @param {Function} callback - 选择后的回调，接收图标名称
     */
    openIconPicker(currentIcon, callback) {
        const grid = document.createElement('div');
        grid.className = 'modal-icon-grid';

        this._iconNames.forEach(name => {
            const svg = getIcon(name, 32);
            if (!svg) return;

            const item = document.createElement('div');
            item.className = 'modal-icon-item';
            item.dataset.iconName = name;
            item.innerHTML = `<span class="icon">${svg}</span>`;
            item.style.background = name === currentIcon ? 'rgba(50, 120, 230, 0.4)' : '';

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close(name);
            });

            grid.appendChild(item);
        });

        this.open({
            title: '选择图标',
            html: grid.outerHTML,
            className: 'modal-icon-picker',
            callback: (selected) => {
                if (selected && callback) callback(selected);
            }
        });

        // 重新绑定网格内 item 的点击（因为 outerHTML 丢失了事件监听器）
        this.elements.body.querySelectorAll('.modal-icon-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close(item.dataset.iconName);
            });
        });
    }
};