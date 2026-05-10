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
 *   - renderDetail → 根据 selectedItem 动态渲染详情内容
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
     * 渲染详情内容（目前仅支持人物类型，未来可扩展）
     * @param {Object} item - { type: 'person' | 'organization' | 'country', data: Object }
     */
    renderDetail(item) {
        if (!this.elements.content) return;

        let html = '';
        if (item.type === 'person') {
            const p = item.data;
            html = `
                <h2 style="color:white; margin:0 0 10px 0;">${p.name}</h2>
                <div style="color:#ccc; font-size:14px;">
                    <p><strong>ID:</strong> ${p.id}</p>
                    <p><strong>颜色:</strong> <span style="display:inline-block;width:12px;height:12px;background:${p.color};border-radius:2px;"></span> ${p.color}</p>
                    <p><strong>时间跨度:</strong> ${p.timeline[0].time} ~ ${p.timeline[p.timeline.length - 1].time}</p>
                    <!-- 将来可添加更多字段，如事件列表等 -->
                </div>
            `;
        } else {
            html = `<p style="color:#ccc;">暂不支持此类型的详细信息显示。</p>`;
        }

        this.elements.content.innerHTML = html;
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