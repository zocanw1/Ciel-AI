module.exports = {
    match: (text) => text.startsWith('/help'),
    execute: async () => {
        const monitorUrl = process.env.MONITOR_URL || 'http://192.168.1.10:5000/';
        return {
            color: 0x5865F2,
            title: 'Perintah Ciel',
            description:
                '`/help` — Daftar perintah ini\n'
                + '`/info` — Statistik server (CPU, RAM, disk, uptime, PM2)\n'
                + '`/pm2list` — Proses PM2 yang berjalan\n'
                + '`/ramusage` — Penggunaan RAM server\n'
                + '`/tt <link>` — Download video TikTok tanpa watermark\n'
                + '\n'
                + `**Monitor** — ${monitorUrl}`,
            footer: 'Ciel — Personal Assistant'
        };
    }
};
