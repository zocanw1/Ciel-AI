const { loadRules, getDailyCount, incrementCounter, addLog } = require('./vault_store');

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function evaluateAccess(app, deviceId) {
    const rules = loadRules();
    const now = new Date();
    const dayName = DAY_NAMES[now.getDay()];
    const hour = now.getHours();
    const currentCount = getDailyCount();

    if (!rules.allowedDays.includes(dayName)) {
        const msg = `Akses ditolak: hari ${dayName} tidak diizinkan.`;
        addLog({ app, deviceId, approved: false, reason: 'blocked_day' });
        return { approved: false, reason: 'blocked_day', message: msg, remaining: 0 };
    }

    if (hour < rules.allowedHours.start || hour >= rules.allowedHours.end) {
        const msg = `Akses ditolak: jam ${hour}:00 di luar jam akses (${rules.allowedHours.start}:00-${rules.allowedHours.end}:00).`;
        addLog({ app, deviceId, approved: false, reason: 'blocked_hour' });
        return { approved: false, reason: 'blocked_hour', message: msg, remaining: 0 };
    }

    if (currentCount >= rules.dailyQuota) {
        const msg = `Akses ditolak: kuota harian habis (${currentCount}/${rules.dailyQuota}).`;
        addLog({ app, deviceId, approved: false, reason: 'daily_quota' });
        return { approved: false, reason: 'daily_quota', message: msg, remaining: 0 };
    }

    incrementCounter();
    const newCount = currentCount + 1;
    const remaining = rules.dailyQuota - newCount;
    const msg = `Akses diberikan. (${newCount}/${rules.dailyQuota})`;
    addLog({ app, deviceId, approved: true, reason: 'approved' });
    return { approved: true, reason: 'approved', message: msg, remaining };
}

module.exports = { evaluateAccess };
