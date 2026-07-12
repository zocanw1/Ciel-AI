const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const RULES_FILE = path.join(DATA_DIR, 'vault_rules.json');
const COUNTER_FILE = path.join(DATA_DIR, 'vault_counter.json');
const LOG_FILE = path.join(DATA_DIR, 'vault_log.json');

const DEFAULT_RULES = {
    allowedDays: ['saturday', 'sunday'],
    allowedHours: { start: 6, end: 20 },
    dailyQuota: 2,
};

let rulesCache = null;
let counterCache = null;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadRules() {
    if (rulesCache) return rulesCache;
    try {
        if (fs.existsSync(RULES_FILE)) {
            rulesCache = JSON.parse(fs.readFileSync(RULES_FILE, 'utf-8'));
            return rulesCache;
        }
    } catch (e) {
        console.error('[Vault] Rules load error:', e.message);
    }
    rulesCache = { ...DEFAULT_RULES };
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
    const current = loadRules();
    if (newRules.allowedDays) current.allowedDays = newRules.allowedDays;
    if (newRules.allowedHours) {
        if (newRules.allowedHours.start !== undefined) current.allowedHours.start = newRules.allowedHours.start;
        if (newRules.allowedHours.end !== undefined) current.allowedHours.end = newRules.allowedHours.end;
    }
    if (newRules.dailyQuota !== undefined) current.dailyQuota = newRules.dailyQuota;
    rulesCache = current;
    saveRules();
    return current;
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
