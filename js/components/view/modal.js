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

    // ───── 变体：Confirm ─────

    /**
     * 打开确认弹窗
     * @param {Object} options
     * @param {string} options.title       - 弹窗标题
     * @param {string} options.message     - 提示消息（支持 HTML）
     * @param {string} [options.hint]      - 辅助提示（可选，灰色小字）
     * @param {Function} options.onConfirm - 确认回调
     * @param {Function} [options.onCancel] - 取消回调
     */
    openConfirm(options = {}) {
        const hint = options.hint ? `<br><small>${options.hint}</small>` : '';

        const html = `
            <p>${options.message || ''}${hint}</p>
            <div class="modal-btn-row">
                <button class="modal-btn modal-btn--cancel" id="modal-confirm-cancel">取消</button>
                <button class="modal-btn modal-btn--confirm" id="modal-confirm-ok">确认</button>
            </div>
        `;

        this.open({ title: options.title, html, callback: null });

        // 绑定按钮事件（Modal.open 同步设置 innerHTML，元素立即可用）
        const body = this.elements.body;
        body.querySelector('#modal-confirm-cancel')?.addEventListener('click', () => {
            this.close();
            if (options.onCancel) options.onCancel();
        });
        body.querySelector('#modal-confirm-ok')?.addEventListener('click', () => {
            this.close();
            if (options.onConfirm) options.onConfirm();
        });
    },

    // ───── 变体：IconPicker ─────

    /**
     * 打开图标选择器
     * 按 svg_icons_tag 分组显示，每组有标签标题和分隔线
     * @param {string} currentIcon - 当前图标名称
     * @param {Function} callback - 选择后的回调，接收图标名称
     */
    openIconPicker(currentIcon, callback) {
        // 收集所有有 SVG 且属于可选范围的图标
        const pickerIcons = Object.keys(svg_icons).filter(name => {
            return name !== 'explorer' && name !== 'filter' && name !== 'color'; // 排除部分专用图标
        });

        // 按 tag 分组
        const groups = {};
        pickerIcons.forEach(name => {
            const tag = svg_icons_tag[name] || '其他';
            if (!groups[tag]) groups[tag] = [];
            groups[tag].push(name);
        });

        // 定义 tag 显示标签
        const tagLabels = {
            entities: '实体',
            system: '系统',
            actions: '操作'
        };

        // 构建分组 HTML
        const container = document.createElement('div');
        container.className = 'modal-icon-groups';

        let isFirst = true;
        for (const [tag, names] of Object.entries(groups)) {
            // 分隔线（第一个组前不显示）
            if (!isFirst) {
                const divider = document.createElement('div');
                divider.className = 'modal-icon-group-divider';
                container.appendChild(divider);
            }
            isFirst = false;

            // 组标签
            const label = tagLabels[tag] || tag;
            const labelEl = document.createElement('div');
            labelEl.className = 'modal-icon-group-label';
            labelEl.textContent = label;
            container.appendChild(labelEl);

            // 网格
            const grid = document.createElement('div');
            grid.className = 'modal-icon-grid';

            names.forEach(name => {
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

            container.appendChild(grid);
        }

        this.open({
            title: '选择图标',
            html: container.innerHTML,
            className: 'modal-icon-picker',
            callback: (selected) => {
                if (selected && callback) callback(selected);
            }
        });

        // 重新绑定事件
        this.elements.body.querySelectorAll('.modal-icon-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close(item.dataset.iconName);
            });
        });
    }
};