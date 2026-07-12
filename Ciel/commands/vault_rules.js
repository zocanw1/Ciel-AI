const { loadRules, updateRules, getDailyCount, getLogs } = require('../core/vault_store');
const { EmbedBuilder } = require('discord.js');

const DAY_NAMES = {
    monday: 'Senin', tuesday: 'Selasa', wednesday: 'Rabu', thursday: 'Kamis',
    friday: 'Jumat', saturday: 'Sabtu', sunday: 'Minggu',
};

module.exports = {
    match: (text) => text.startsWith('/vault-rules'),

    execute: async (message) => {
        const args = message.content.replace(/^\/vault-rules\s*/i, '').trim();

        if (args.startsWith('set ')) {
            const jsonStr = args.slice(4).trim();
            try {
                const newRules = JSON.parse(jsonStr);
                const updated = updateRules(newRules);
                return {
                    color: 0x2ECC71,
                    title: 'Rules Vault Diperbarui',
                    description: formatRules(updated),
                };
            } catch (e) {
                return {
                    color: 0xE74C3C,
                    title: 'Error',
                    description: 'Format JSON salah. Contoh: `set { "rules": [{"type":"quota","limit":3}] }`',
                };
            }
        }

        if (args.startsWith('log')) {
            const logs = getLogs(5);
            if (logs.length === 0) {
                return { color: 0xF1C40F, title: 'Log Vault', description: 'Belum ada log.' };
            }
            const lines = logs.map(l =>
                `**${l.app}** (${l.deviceId || '?'}) | ${l.approved ? '✅' : '❌'} ${l.reason}`
            );
            return { color: 0x5865F2, title: 'Log Vault (5 terakhir)', description: lines.join('\n') };
        }

        const rules = loadRules();
        const count = getDailyCount();
        return {
            color: 0x5865F2,
            title: 'Vault Rules',
            description: formatRules(rules) + `\n\nAkses hari ini: **${count}**`,
        };
    }
};

function formatRules(rules) {
    return rules.rules.map(r => formatRule(r)).join('\n');
}

function formatRule(rule) {
    switch (rule.type) {
        case 'day': {
            const days = rule.value.map(d => DAY_NAMES[d] || d).join(', ');
            return `**Hari**: ${days}`;
        }
        case 'time':
            return `**Jam**: ${rule.start} — ${rule.end}`;
        case 'quota':
            return `**Kuota harian**: ${rule.limit}x`;
        default:
            return `**${rule.type}**: ${JSON.stringify(rule)}`;
    }
}
