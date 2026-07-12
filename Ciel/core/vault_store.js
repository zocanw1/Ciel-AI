const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const RULES_FILE = path.join(DATA_DIR, 'vault_rules.json');
const COUNTER_FILE = path.join(DATA_DIR, 'vault_counter.json');
const LOG_FILE = path.join(DATA_DIR, 'vault_log.json');

const DEFAULT_RULES = {
    rules: [
        { type: 'day', value: ['saturday', 'sunday'] },
        { type: 'time', start: '06:00', end: '20:00' },
        { type: 'quota', limit: 2 },
    ],
};

let rulesCache = null;
let counterCache = null;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function migrateRules(data) {
    if (data.rules) { rulesCache = data; return; }
    const migrated = { rules: [] };
    if (data.allowedDays) migrated.rules.push({ type: 'day', value: data.allowedDays });
    if (data.allowedHours) {
        migrated.rules.push({
            type: 'time',
            start: `${String(data.allowedHours.start).padStart(2, '0')}:00`,
            end: `${String(data.allowedHours.end).padStart(2, '0')}:00`,
        });
    }
    if (data.dailyQuota) migrated.rules.push({ type: 'quota', limit: data.dailyQuota });
    rulesCache = migrated;
    saveRules();
}

function loadRules() {
    if (rulesCache) return rulesCache;
    try {
        if (fs.existsSync(RULES_FILE)) {
            const raw = JSON.parse(fs.readFileSync(RULES_FILE, 'utf-8'));
            migrateRules(raw);
            return rulesCache;
        }
    } catch (e) {
        console.error('[Vault] Rules load error:', e.message);
    }
    rulesCache = { rules: [...DEFAULT_RULES.rules.map(r => ({ ...r }))] };
    saveRules();
    return rulesCache;
}

function saveRules() {
    try {
        fs.writeFileSync(RULES_FILE, JSON.stringify(rulesCache, null, 2));
    } catch (e) {
        console.error('[Vault] Rules save error:', e.message);
    }
}

function updateRules(newRules) {
    loadRules();
    if (Array.isArray(newRules.rules)) {
        rulesCache = { rules: newRules.rules.map(r => ({ ...r })) };
    } else {
        return rulesCache;
    }
    saveRules();
    return rulesCache;
}

function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadCounter() {
    const today = getTodayKey();
    try {
        if (fs.existsSync(COUNTER_FILE)) {
            counterCache = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf-8'));
        }
    } catch (e) {
        console.error('[Vault] Counter load error:', e.message);
    }
    if (!counterCache || counterCache.date !== today) {
        counterCache = { date: today, count: 0 };
        saveCounter();
    }
    return counterCache;
}

function saveCounter() {
    try {
        fs.writeFileSync(COUNTER_FILE, JSON.stringify(counterCache, null, 2));
    } catch (e) {
        console.error('[Vault] Counter save error:', e.message);
    }
}

function incrementCounter() {
    loadCounter();
    counterCache.count++;
    saveCounter();
}

function getDailyCount() {
    return loadCounter().count;
}

function addLog(entry) {
    try {
        let logs = [];
        if (fs.existsSync(LOG_FILE)) {
            logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
        }
        logs.unshift({ ...entry, timestamp: new Date().toISOString() });
        if (logs.length > 50) logs = logs.slice(0, 50);
        fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
    } catch (e) {
        console.error('[Vault] Log error:', e.message);
    }
}

function getLogs(limit = 10) {
    try {
        if (fs.existsSync(LOG_FILE)) {
            const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
            return logs.slice(0, limit);
        }
    } catch (e) {
        console.error('[Vault] Log read error:', e.message);
    }
    return [];
}

module.exports = { loadRules, updateRules, getDailyCount, incrementCounter, addLog, getLogs, DEFAULT_RULES };
