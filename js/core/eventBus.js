// js/core/eventBus.js

const EventBus = {
    events: {},

    /**
     * 订阅事件
     * @param {string} event - 事件名（如 'state:change'）
     * @param {Function} callback - 回调函数
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    },

    /**
     * 取消订阅
     * @param {string} event - 事件名
     * @param {Function} callback - 要移除的回调（必须与 on 时是同一个函数引用）
     */
    off(event, callback) {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        }
    },

    /**
     * 发布事件，通知所有订阅者
     * @param {string} event - 事件名
     * @param {*} data - 要传递的数据
     */
    emit(event, data) {
        (this.events[event] || []).forEach(callback => {
            callback(data);
        });
    }
};

window.EventBus = EventBus;