/**
 * 布局管理模块（全局单例）
 * 职责：
 * - 管理所有面板（侧边栏等）的宽度、状态
 * - 计算并更新 CSS 自定义属性（--left-total, --right-total）
 * - 在布局变化时通过 EventBus 发出通知
 */
const LayoutManager = {
    // 面板配置
    panels: {
        sidebar: {
            side: 'left',
            width: 220,
            isOpen: true// 初始状态
        },
        detail: {
            side: 'left',
            width: 280,
            isOpen: true
        }
    },

    /**
     * 初始化：根据 AppState 同步初始状态，并监听相关变化
     */
    init() {
        // 1. 从 AppState 读取侧边栏初始状态（如果存在）
        const sidebarOpen = AppState.get('isSidebarOpen');
        const detailPanelOen = AppState.get('isSidebarOpen');
        if (sidebarOpen !== undefined) {
            this.panels.sidebar.isOpen = sidebarOpen;
        }
        if (detailPanelOen !== undefined) {
            this.panels.detail.isOpen = detailPanelOen;
        }

        // 2. 立即计算一次
        this.compute();

        // 3. 监听状态变化（侧边栏开关）
        EventBus.on('state:change', (payload) => {
            if (payload.key === 'isSidebarOpen') {
                this.panels.sidebar.isOpen = payload.value;
                this.compute();
            }
            if (payload.key === 'isDetailPanelOpen') {
                this.panels.detail.isOpen = payload.value;
                this.compute();
            }
        });

        // 4. 窗口 resize 时重新计算并通知
        window.addEventListener('resize', () => {
            // resize 需要等待动画结束？实际上 resize 不会触发 CSS transition，
            // 但为了统一延迟，我们可以直接调用 compute 并发射事件。
            // 但如果时间轴需要延迟，由时间轴自身处理延迟。
            this.compute();
        });
    },

    /**
     * 计算并更新 CSS 变量，发射布局变化事件
     */
    compute() {
        let leftTotal = 0;
        let rightTotal = 0;

        Object.values(this.panels).forEach(panel => {
            if (panel.isOpen) {
                if (panel.side === 'left') {
                    leftTotal += panel.width;
                } else if (panel.side === 'right') {
                    rightTotal += panel.width;
                }
            }
        });

        // 更新 CSS 变量
        document.documentElement.style.setProperty('--left-total', leftTotal + 'px');
        document.documentElement.style.setProperty('--right-total', rightTotal + 'px');

        // 计算详情面板的 left 值（紧贴侧边栏右侧，间距10px）
        const sidebarOpen = this.panels.sidebar.isOpen;
        const sidebarWidth = this.panels.sidebar.width;
        const detailLeft = sidebarOpen ? (10 + sidebarWidth + 10) : 10;  // 侧边栏开：10+220+10=240，关：10
        document.documentElement.style.setProperty('--detail-left', detailLeft + 'px');

        // 通知其他模块布局已更新
        EventBus.emit('layout:change', {
            left: leftTotal,
            right: rightTotal
        });
    }
};