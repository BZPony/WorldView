/**
 * 创建一个新的人物（纯数据操作），不修改persons，只返回一个默认的人物数据结构
 */
function createPersonData({ name, lat, lng }) {
    const persons = AppState.get('persons') || [];
    const newId = Date.now();

    return {
        id: newId,
        name: name,
        timeline: [{ lat, lng, time: AppState.get('currentTime') || 0 }],
        color: "#4f454f",
        iconUrl: null,
        iconSize: [32, 32],
        tags: [],
        marker: null,
        polyline: null
    };
}


const persons = [
    {
        id: 1,
        name: "张三",

        timeline: [
            { lat: 30, lng: 110, time: 0 },
            { lat: 32, lng: 115, time: 20 },
            { lat: 35, lng: 120, time: 40 },
            { lat: 40, lng: 116, time: 80 }
        ],
        color: "#4f454f",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
        polyline: null
    },
    {
        id: 2,
        name: "暮光闪闪",

        timeline: [
            { lat: 31, lng: 120, time: -200 },
            { lat: 33, lng: 118, time: 0 },
            { lat: 36, lng: 122, time: 50 },
            { lat: 38, lng: 119, time: 150 }
        ],
        color: "#ff4d4f",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
        polyline: null
    },
    {
        id: 3,
        name: "夜神月",
        timeline: [
            { lat: 28, lng: 115, time: -50 },
            { lat: 30, lng: 118, time: 0 },
            { lat: 34, lng: 117, time: 30 },
            { lat: 37, lng: 121, time: 70 }
        ],
        color: "#347290",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
        polyline: null
    },
    {
        id: 4,
        name: "尤莉",
        timeline: [
            { lat: 29, lng: 112, time: -100 },
            { lat: 31, lng: 114, time: -20 },
            { lat: 33, lng: 116, time: 10 },
            { lat: 36, lng: 118, time: 60 }
        ],
        color: "#832900",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
        polyline: null
    },
    {
        id: 5,
        name: "利维亚的杰洛特",
        timeline: [
            { lat: 32, lng: 110, time: -150 },
            { lat: 35, lng: 113, time: -50 },
            { lat: 38, lng: 116, time: 50 },
            { lat: 41, lng: 119, time: 150 }
        ],
        color: "#247290",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
        polyline: null
    }
];

const organization = [
    {
        id: 6,
        name: "圣殿骑士",

        color: "#ffdd1a",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
    {
        id: 7,
        name: "罗莎莉亚的指头",

        color: "#c115b5",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
    {
        id: 8,
        name: "保护伞公司",

        color: "#ff1d1d",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
    {
        id: 9,
        name: "猎魔人",

        color: "#143869",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
    {
        id: 10,
        name: "避难所科技",

        color: "#ff970f",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
]

const regime = [
    {
        id: 11,
        name: "天马城邦",

        color: "#247290",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
    {
        id: 12,
        name: "洛斯里克王国",

        color: "#247290",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
    {
        id: 13,
        name: "永恒之城诺克隆恩",

        color: "#247290",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
    {
        id: 14,
        name: "博德之门",

        color: "#247290",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
    {
        id: 15,
        name: "圣殿骑士",

        color: "#247290",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
]