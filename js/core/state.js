// js/core/state.js

const AppState = {
    state: {
        selectedItem: null,
        currentTime: 0,          // 当前时间
        isSidebarOpen: true,     // 侧边栏是否打开
        isDetailPanelOpen:false,
        persons: []              // 人物数据（将由 data/persons.js 写入）
    },

    /**
     * 获取状态值
     * @param {string} key
     * @returns {*}
     */
    get(key) {
        return this.state[key];
    },

    /**
     * 设置状态值，并自动通过 EventBus 广播变化
     * @param {string} key
     * @param {*} value
     */
    set(key, value) {
        this.state[key] = value;
        EventBus.emit('state:change', {
            key: key,
            value: value,
            state: this.state
        });
    }
};