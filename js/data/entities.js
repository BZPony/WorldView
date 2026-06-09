/*
实体数据结构使用ECS(Entity-Component-System)，
每个实体只是一个id加上一组动态挂载的组件，每个组件只携带自己关心的数据。
一个实体完全由其携带的组件决定是什么。
*/

/**
 * 基础信息组件（必备）
 */
function createCoreComponent({ name, color, icon = 'person' }) {
    return { type: 'core', name, color, icon };
}

/**
 * 运动轨迹组件（可选）
 * 用于可移动实体（人物、动物等）
 */
function createMotionComponent(waypoints = []) {
    const normalized = waypoints.map(wp => {
        const rawTime = wp.time || { arrival: { year: 0 }, departure: { year: 0 } };
        const arrival = rawTime.arrival ?? rawTime;
        const departure = rawTime.departure ?? rawTime;
        return {
            ...wp,
            time: { arrival, departure },
            resolution: wp.resolution || 'year'
        };
    });
    return { type: 'motion', waypoints: normalized };
}

/**
 * 名称演变组件（可选）
 */
function createNameHistoryComponent(entries = []) {
    return { type: 'nameHistory', entries };
}

/**
 * 人物组件（可选）
 */
function createPersonComponent({ birthTime, deathTime, gender, description } = {}) {
    // 确保 birthTime/deathTime 包含 year/month/day（缺省月=1，日=1）
    const normalizeTime = (t) => {
        if (!t) return null;
        return { year: t.year ?? 0, month: t.month ?? 1, day: t.day ?? 1 };
    };
    return {
        type: 'person',
        birthTime: normalizeTime(birthTime),
        deathTime: normalizeTime(deathTime),
        gender,
        description
    };
}

/**
 * 地点组件（可选）
 */
function createPlaceComponent({ position, description } = {}) {
    return { type: 'place', position: position || null, description };
}

/**
 * 政权组件（可选）
 */
function createRegimeComponent({ capital, population, governmentType } = {}) {
    return { type: 'regime', capital, population, governmentType };
}

/**
 * 组织组件（可选）
 */
function createOrganizationComponent({ headquarters, leader, members } = {}) {
    return { type: 'organization', headquarters, leader, members };
}

/**
 * 用户自定义标签组件（可选）
 */
function createCustomTagComponent(tags = []) {
    return { type: 'customTags', tags };
}

/**
 * 创建实体
 */
function createEntity(id, components) {
    const componentMap = {};
    for (const comp of components) {
        componentMap[comp.type] = comp;
    }
    if (!componentMap.core) {
        throw new Error(`实体 ${id} 缺少必需的 core 组件`);
    }
    return { id, components: componentMap };
}

/**
 * 快速创建运动人物实体
 */
function createMotionEntity({ id, name, color, icon = 'person', waypoints, ...personOptions }) {
    return createEntity(id, [
        createCoreComponent({ name, color, icon }),
        createMotionComponent(waypoints),
        createPersonComponent(personOptions)
    ]);
}

/**
 * 快速创建地点实体
 */
function createPlaceEntity({ id, name, color, icon = 'tag', position, nameHistory, description }) {
    return createEntity(id, [
        createCoreComponent({ name, color, icon }),
        createPlaceComponent({ position, description }),
        createNameHistoryComponent(nameHistory)
    ]);
}

/**
 * 快速创建组织实体
 */
function createOrganizationEntity({ id, name, color, icon, ...organizationOptions }) {
    return createEntity(id, [
        createCoreComponent({ name, color, icon }),
        createOrganizationComponent(organizationOptions)
    ]);
}

/**
 * 快速创建政权实体
 */
function createRegimeEntity({ id, name, color, icon, ...regimeOption }) {
    return createEntity(id, [
        createCoreComponent({ name, color, icon }),
        createRegimeComponent(regimeOption)
    ]);
}

/**
 * 创建一个新的人物（纯数据操作）
 */
function createPersonData({ name, lat, lng }) {
    const persons = AppState.get('entities') || [];
    const newId = Date.now().toString();

    return createMotionEntity({
        id: newId,
        name: name,
        color: '#4f454f',
        waypoints: [{ lat, lng, time: AppState.get('currentTime') || { year: 0, month: 1, day: 1 } }],
        birthTime: { year: 0, month: 1, day: 1 },
        deathTime: { year: 100, month: 1, day: 1 },
        gender: '男',
        description: '新人物'
    });
}

// 新实体数组
const entities = [
    // ---------- 人物 ----------
    {
        id: 'person_1',
        components: {
            core: { type: 'core', name: '张三', color: '#4f454f', icon: 'person' },
            motion: {
                type: 'motion',
                waypoints: [
                    { lat: 30, lng: 110, time: { arrival: { year: 0, month: 6, day: 15 }, departure: { year: 0, month: 6, day: 15 } }, resolution: 'day', name: '起源镇', description: '在此地结识了第一位同伴，踏上旅途' },
                    { lat: 32, lng: 115, time: { arrival: { year: 20, month: 3, day: 1 }, departure: { year: 20, month: 3, day: 1 } }, resolution: 'day', name: '白石渡', description: '以白色石桥闻名的渡口' },
                    { lat: 35, lng: 120, time: { arrival: { year: 40, month: 9, day: 10 }, departure: { year: 40, month: 9, day: 10 } }, resolution: 'day', name: '临海城', description: '繁华的沿海贸易都市' },
                    { lat: 40, lng: 116, time: { arrival: { year: 80, month: 1, day: 1 }, departure: { year: 80, month: 1, day: 1 } }, resolution: 'day', name: '北境关', description: '抵御北方入侵的军事要塞' }
                ]
            },
            person: { type: 'person', birthTime: { year: -50, month: 3, day: 15 }, deathTime: { year: 100, month: 8, day: 20 }, gender: '男', description: '一位旅行者' }
        }
    },
    {
        id: 'person_2',
        components: {
            core: { type: 'core', name: '暮光闪闪', color: '#ff4d4f', icon: 'person' },
            motion: {
                type: 'motion',
                waypoints: [
                    { lat: 31, lng: 120, time: { arrival: { year: -200, month: 5 }, departure: { year: -200, month: 5 } }, resolution: 'year', name: '小马谷', description: '在图书馆研读魔法古籍，结交了五位挚友占位符占位符占位符占位符占位符占位符占位符占位符占位符占位符占位符占位符占位符占位符占位符占位符占位符占位符占位符s' },
                    { lat: 33, lng: 118, time: { arrival: { year: 0, month: 1, day: 1 }, departure: { year: 0, month: 1, day: 1 } }, resolution: 'day', name: '水晶帝国', description: '帮助音韵公主驱散阴影，点亮水晶之心' },
                    { lat: 36, lng: 122, time: { arrival: { year: 50, month: 7, day: 14 }, departure: { year: 50, month: 7, day: 14 } }, resolution: 'day', name: '云中城', description: '参加赛博拉斯庆典，与云宝黛西翱翔天际' },
                    { lat: 38, lng: 119, time: { arrival: { year: 150, month: 12 }, departure: { year: 150, month: 12 } }, resolution: 'month', name: '无尽之森', description: '探索远古遗迹，封印噩梦之影' }
                ]
            },
            person: { type: 'person', birthTime: { year: -250, month: 6, day: 1 }, deathTime: { year: 200, month: 12, day: 31 }, gender: '女', description: '小马谷的图书管理员' }
        }
    },
    {
        id: 'person_3',
        components: {
            core: { type: 'core', name: '夜神月', color: '#347290', icon: 'person' },
            motion: {
                type: 'motion',
                waypoints: [
                    { lat: 28, lng: 115, time: { arrival: { year: -50 }, departure: { year: -50 } }, resolution: 'year', name: '东京', description: '捡到死亡笔记，开始制裁罪犯的正义之路' },
                    { lat: 30, lng: 118, time: { arrival: { year: 0, month: 6 }, departure: { year: 0, month: 6 } }, resolution: 'month', name: '京都', description: '与 L 展开巅峰对决，巧妙伪装身份' },
                    { lat: 34, lng: 117, time: { arrival: { year: 30, month: 3, day: 15 }, departure: { year: 30, month: 3, day: 15 } }, resolution: 'day', name: '大阪', description: '潜入警视厅总部，获取关键调查情报' },
                    { lat: 37, lng: 121, time: { arrival: { year: 70 }, departure: { year: 70 } }, resolution: 'year', name: '北海道', description: '在雪原别墅中设下最后陷阱，与尼亚对决' }
                ]
            },
            person: { type: 'person', birthTime: { year: -100, month: 1, day: 28 }, deathTime: { year: 80, month: 11, day: 5 }, gender: '男', description: '卡密' }
        }
    },
    {
        id: 'person_4',
        components: {
            core: { type: 'core', name: '尤莉', color: '#359890', icon: 'person' },
            motion: {
                type: 'motion',
                waypoints: [
                    { lat: 29, lng: 112, time: { arrival: { year: -100, month: 3 }, departure: { year: -100, month: 3 } }, resolution: 'year', name: '柏林', description: '末世废墟中与好友相遇，结伴同行寻找食物' },
                    { lat: 31, lng: 114, time: { arrival: { year: -20, month: 9, day: 1 }, departure: { year: -20, month: 9, day: 1 } }, resolution: 'day', name: '慕尼黑', description: '在废弃图书馆发现旧世界的地图与唱片' },
                    { lat: 33, lng: 116, time: { arrival: { year: 10, month: 5 }, departure: { year: 10, month: 5 } }, resolution: 'month', name: '科隆', description: '乘坐履带车穿越荒野，探索高层遗迹' },
                    { lat: 36, lng: 118, time: { arrival: { year: 60, month: 1, day: 20 }, departure: { year: 60, month: 1, day: 20 } }, resolution: 'day', name: '汉堡', description: '到达海岸，遥望远方或许存在的文明' }
                ]
            },
            person: { type: 'person', birthTime: { year: -100, month: 4, day: 10 }, deathTime: { year: 60, month: 9, day: 15 }, gender: '女', description: '金发德国少女' }
        }
    },
    {
        id: 'person_5',
        components: {
            core: { type: 'core', name: '利维亚的杰洛特', color: '#d7115d', icon: 'person' },
            motion: {
                type: 'motion',
                waypoints: [
                    { lat: 32, lng: 110, time: { arrival: { year: -150 }, departure: { year: -150 } }, resolution: 'era', name: '凯尔莫罕', description: '接受猎魔人训练，学习剑术与炼金术' },
                    { lat: 35, lng: 113, time: { arrival: { year: -50 }, departure: { year: -50 } }, resolution: 'decade', name: '维吉玛', description: '解决泰莫利亚宫廷的诅咒，获得狮鹫勋章' },
                    { lat: 38, lng: 116, time: { arrival: { year: 50, month: 6 }, departure: { year: 50, month: 6 } }, resolution: 'month', name: '诺维格瑞', description: '追踪希里的线索，与永恒之火教会周旋' },
                    { lat: 41, lng: 119, time: { arrival: { year: 150, month: 3, day: 5 }, departure: { year: 150, month: 3, day: 5 } }, resolution: 'day', name: '史凯利杰', description: '参加国王选举挑战，击败狂猎的远征队' }
                ]
            },
            person: { type: 'person', birthTime: { year: -300, month: 5, day: 1 }, deathTime: { year: 150, month: 7, day: 20 }, gender: '男', description: '传奇猎魔人' }
        }
    },

    // ---------- 地点 ----------
    {
        id: 'place_1',
        components: {
            core: { type: 'core', name: '起源镇', color: '#5b8a5b', icon: 'place' },
            place: { type: 'place', position: { lat: 30, lng: 110 }, description: '一座宁静的小镇，依山傍水，是张三旅途的起点' },
            nameHistory: {
                type: 'nameHistory',
                entries: [
                    { time: { year: -500 }, name: '起源镇', description: '古老的村落，传说中由一位神秘旅者创立' },
                ]
            }
        }
    },
    {
        id: 'place_2',
        components: {
            core: { type: 'core', name: '小马谷', color: '#ff69b4', icon: 'place' },
            place: { type: 'place', position: { lat: 31, lng: 120 }, description: '暮光闪闪的故乡，一座充满魔法与友谊的和谐小镇' },
            nameHistory: {
                type: 'nameHistory',
                entries: [
                    { time: { year: -1000 }, name: '小马谷', description: '原为一片荒地，后来被一群小马发现并定居，逐渐发展成现在的模样' },
                ]
            }
        }
    },
    {
        id: 'place_3',
        components: {
            core: { type: 'core', name: '凯尔莫罕', color: '#444444', icon: 'place' },
            place: { type: 'place', position: { lat: 32, lng: 110 }, description: '猎魔人的堡垒要塞，位于蓝山深处，杰洛特的训练之地' },
            nameHistory: {
                type: 'nameHistory',
                entries: [
                    { time: { year: -1000 }, name: '凯尔莫罕', description: '古老的军事要塞，曾经是抵御北方入侵的前线' },
                    { time: { year: -500 }, name: '猎魔人堡垒', description: '被一群猎魔人占领后改名，成为猎魔人的训练基地' },
                    { time: { year: 0 }, name: '凯尔莫罕', description: '为了纪念最初的历史名称，重新采用了凯尔莫罕这个名字' }
                ]
            }
        }
    },
    {
        id: 'place_4',
        components: {
            core: { type: 'core', name: '君士坦丁堡', color: '#cc3333', icon: 'place' },
            place: { type: 'place', position: { lat: 28, lng: 115 }, description: '一座横跨欧亚的历史名城，夜神月曾在此活动' },
            nameHistory: {
                type: 'nameHistory',
                entries: [
                    { time: { year: -300 }, name: '拜占庭', description: '古希腊殖民城市，名为拜占庭' },
                    { time: { year: 100, month: 5 }, name: '君士坦丁堡', description: '君士坦丁大帝定为东罗马首都，改名君士坦丁堡' },
                    { time: { year: 110 }, name: '伊斯坦布尔', description: '奥斯曼帝国征服后，更名为伊斯坦布尔' }
                ]
            }
        }
    },
    {
        id: 'place_5',
        components: {
            core: { type: 'core', name: '柏林', color: '#887744', icon: 'place' },
            place: { type: 'place', position: { lat: 29, lng: 112 }, description: '末世后的柏林废墟，尤莉与好友相遇的地方' },
            nameHistory: {
                type: 'nameHistory',
                entries: [
                    { time: { year: -500 }, name: '柏林', description: '古老的部落聚居地，后来发展成城市' },
                    { time: { year: 0 }, name: '柏林', description: '经历多次战争与重建，名字一直未变' },
                    { time: { year: 100 }, name: '废墟之城', description: '末世后被废弃，成为废墟之城' }
                ]
            }
        }
    },

    // ---------- 组织 ----------
    {
        id: 'org_1',
        components: {
            core: { type: 'core', name: '圣殿骑士', color: '#ffdd1a', icon: 'organization' },
            organization: {
                type: 'organization',
                headquarters: '阿克城',
                leader: '大团长罗伯特·德·萨布蕾',
                members: '骑士、牧师、军士'
            }
        }
    },
    {
        id: 'org_2',
        components: {
            core: { type: 'core', name: '罗莎莉亚的指头', color: '#c115b5', icon: 'organization' },
            organization: {
                type: 'organization',
                headquarters: '蔷薇教堂',
                leader: '罗莎莉亚',
                members: '指头女巫、血指猎人'
            }
        }
    },
    {
        id: 'org_3',
        components: {
            core: { type: 'core', name: '保护伞公司', color: '#ff1d1d', icon: 'organization' },
            organization: {
                type: 'organization',
                headquarters: '浣熊市地下研究所',
                leader: '奥斯维尔·斯宾塞',
                members: '研究员、安全部队、生化武器开发组'
            }
        }
    },
    {
        id: 'org_4',
        components: {
            core: { type: 'core', name: '猎魔人', color: '#143869', icon: 'organization' },
            organization: {
                type: 'organization',
                headquarters: '凯尔莫罕',
                leader: '维瑟米尔',
                members: '猎魔人学徒、学派导师'
            }
        }
    },
    {
        id: 'org_5',
        components: {
            core: { type: 'core', name: '避难所科技', color: '#ff970f', icon: 'organization' },
            organization: {
                type: 'organization',
                headquarters: '华盛顿特区',
                leader: '董事会',
                members: '科学家、工程师、监督者'
            }
        }
    },

    // ---------- 政权 ----------
    {
        id: 'regime_1',
        components: {
            core: { type: 'core', name: '天马城邦', color: '#247290', icon: 'country' },
            regime: {
                type: 'regime',
                capital: '云中城',
                population: '约50万小马',
                governmentType: '君主制'
            }
        }
    },
    {
        id: 'regime_2',
        components: {
            core: { type: 'core', name: '洛斯里克王国', color: '#247290', icon: 'country' },
            regime: {
                type: 'regime',
                capital: '洛斯里克王城',
                population: '未知（不死人诅咒蔓延）',
                governmentType: '君主制（双王子共治）'
            }
        }
    },
    {
        id: 'regime_3',
        components: {
            core: { type: 'core', name: '永恒之城诺克隆恩', color: '#247290', icon: 'country' },
            regime: {
                type: 'regime',
                capital: '诺克隆恩地下神殿',
                population: '夜人与泪滴族群',
                governmentType: '神权共和'
            }
        }
    },
    {
        id: 'regime_4',
        components: {
            core: { type: 'core', name: '博德之门', color: '#247290', icon: 'country' },
            regime: {
                type: 'regime',
                capital: '博德之门城',
                population: '约20万（多种族混居）',
                governmentType: '公爵议会制'
            }
        }
    },
    {
        id: 'regime_5',
        components: {
            core: { type: 'core', name: '圣殿骑士团', color: '#247290', icon: 'country' },
            regime: {
                type: 'regime',
                capital: '阿卡圣城',
                population: '以军事修士会为核心的政教合一领地',
                governmentType: '政教合一骑士团'
            }
        }
    }
];