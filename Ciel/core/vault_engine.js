const { loadRules, getDailyCount, incrementCounter, addLog } = require('./vault_store');

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function parseTime(str) {
    const [h, m] = str.split(':').map(Number);
    return h * 60 + (m || 0);
}

const evaluators = {
    day: (rule, ctx) => {
        if (!rule.value.includes(ctx.dayName)) {
            return { passed: false, reason: 'blocked_day', message: `Hari ${ctx.dayName} tidak diizinkan.` };
        }
        return { passed: true };
    },

    time: (rule, ctx) => {
        const start = parseTime(rule.start);
        const end = parseTime(rule.end);
        const now = ctx.hour * 60 + ctx.minute;
        if (now < start || now >= end) {
            return { passed: false, reason: 'blocked_hour', message: `Jam ${String(ctx.hour).padStart(2, '0')}:${String(ctx.minute).padStart(2, '0')} di luar jam akses (${rule.start}-${rule.end}).` };
        }
        return { passed: true };
    },

    quota: (rule, ctx) => {
        if (ctx.dailyCount >= rule.limit) {
            return { passed: false, reason: 'daily_quota', message: `Kuota harian habis (${ctx.dailyCount}/${rule.limit}).` };
        }
        return { passed: true };
    },
};

function evaluateAccess(app, deviceId) {
    const rules = loadRules();
    const now = new Date();
    const ctx = {
        app, deviceId, now,
        dayName: DAY_NAMES[now.getDay()],
        hour: now.getHours(),
        minute: now.getMinutes(),
        dailyCount: getDailyCount(),
    };

    for (const rule of rules.rules) {
        const handler = evaluators[rule.type];
        if (!handler) continue;
        const result = handler(rule, ctx);
        if (!result.passed) {
            addLog({ app, deviceId, approved: false, reason: result.reason });
            return { approved: false, reason: result.reason, message: result.message, remaining: 0 };
        }
    }

    incrementCounter();
    const newCount = ctx.dailyCount + 1;
    const quotaRule = rules.rules.find(r => r.type === 'quota');
    const remaining = quotaRule ? quotaRule.limit - newCount : -1;
    const msg = `Akses diberikan. (${newCount}/${quotaRule?.limit || '?'})`;
    addLog({ app, deviceId, approved: true, reason: 'approved' });
    return { approved: true, reason: 'approved', message: msg, remaining };
}

module.exports = { evaluateAccess };
