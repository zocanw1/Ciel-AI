const { loadRules, getDailyCount, incrementCounter, addLog } = require('./vault_store');

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function evaluateAccess(app, device) {
    const rules = loadRules();
    const now = new Date();
    const dayName = DAY_NAMES[now.getDay()];
    const hour = now.getHours();
    const currentCount = getDailyCount();

    // Check day
    if (!rules.allowedDays.includes(dayName)) {
        const msg = `Akses ditolak: hari ${dayName} tidak diizinkan.`;
        addLog({ app, device, approved: false, reason: msg });
        return { approved: false, message: msg, remaining: 0 };
    }

    // Check hour
    if (hour < rules.allowedHours.start || hour >= rules.allowedHours.end) {
        const msg = `Akses ditolak: jam ${hour}:00 di luar jam akses (${rules.allowedHours.start}:00-${rules.allowedHours.end}:00).`;
        addLog({ app, device, approved: false, reason: msg });
        return { approved: false, message: msg, remaining: 0 };
    }

    // Check daily quota
    if (currentCount >= rules.dailyQuota) {
        const msg = `Akses ditolak: kuota harian habis (${currentCount}/${rules.dailyQuota}).`;
        addLog({ app, device, approved: false, reason: msg });
        return { approved: false, message: msg, remaining: 0 };
    }

    // All passed
    incrementCounter();
    const newCount = currentCount + 1;
    const remaining = rules.dailyQuota - newCount;
    const msg = `Akses diberikan. (${newCount}/${rules.dailyQuota})`;
    addLog({ app, device, approved: true, reason: msg });
    return { approved: true, message: msg, remaining };
}

module.exports = { evaluateAccess };
