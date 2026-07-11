function formatUptime(ms) {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hour = Math.floor(min / 60);
    const day = Math.floor(hour / 24);
    const parts = [];
    if (day > 0) parts.push(`${day}h`);
    if (hour % 24 > 0) parts.push(`${hour % 24}j`);
    if (min % 60 > 0) parts.push(`${min % 60}m`);
    if (sec % 60 > 0 && parts.length < 2) parts.push(`${sec % 60}d`);
    return parts.join(' ') || '0d';
}

function progressBar(percent) {
    const filled = Math.round((parseFloat(percent) / 100) * 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

function fmtMB(mb) {
    const val = parseInt(mb);
    if (val >= 1024) return (val / 1024).toFixed(1) + ' GB';
    return val + ' MB';
}

function normalizeSchema(schema = {}) {
    const normalized = { ...schema };
    if (normalized.type) normalized.type = String(normalized.type).toLowerCase();
    if (normalized.properties) {
        normalized.properties = Object.fromEntries(
            Object.entries(normalized.properties).map(([name, value]) => [name, normalizeSchema(value)])
        );
    }
    if (normalized.items) normalized.items = normalizeSchema(normalized.items);
    return normalized;
}

module.exports = { formatUptime, progressBar, fmtMB, normalizeSchema };
