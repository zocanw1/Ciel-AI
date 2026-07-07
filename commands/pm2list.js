const { exec } = require('child_process');

module.exports = {
    match: (text) => text.startsWith('/pm2list'),
    execute: async () => {
        return new Promise((resolve) => {
            exec('pm2 jlist', { timeout: 15000 }, (error, stdout, stderr) => {
                if (error) {
                    resolve({
                        color: 0xE74C3C,
                        title: 'Error',
                        description: '```' + error.message + '```'
                    });
                    return;
                }

                const blocks = [];
                try {
                    const processes = JSON.parse(stdout);
                    for (const proc of processes) {
                        const name = proc.name || 'unknown';
                        const status = proc.pm2_env?.status || 'unknown';
                        const pid = proc.pid || '—';
                        const cpu = proc.monit?.cpu ?? '—';
                        const memBytes = proc.monit?.memory || 0;
                        const memMB = (memBytes / 1024 / 1024).toFixed(1);
                        const restart = proc.pm2_env?.restart_time ?? '—';
                        const uptimeMs = proc.pm2_env?.pm_uptime ? Date.now() - proc.pm2_env.pm_uptime : 0;
                        const uptime = formatUptime(uptimeMs);
                        const nodeVer = proc.pm2_env?.node_version || '—';
                        const dot = status === 'online' ? '🟢' : '🔴';

                        blocks.push(
                            dot + ' **' + name + '** — ' + status.toUpperCase(),
                            'PID `' + pid + '` · CPU `' + cpu + '%` · RAM `' + memMB + ' MB`',
                            'Uptime `' + uptime + '` · Restart `' + restart + 'x` · Node `' + nodeVer + '`'
                        );
                        blocks.push('');
                    }
                } catch (e) {
                    blocks.push('Gagal parse data PM2: ' + e.message);
                }

                resolve({
                    color: 0x2ECC71,
                    title: 'PM2 Process List',
                    description: blocks.join('\n').trim()
                });
            });
        });
    }
};

function formatUptime(ms) {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hour = Math.floor(min / 60);
    const day = Math.floor(hour / 24);
    const parts = [];
    if (day > 0) parts.push(day + 'h');
    if (hour % 24 > 0) parts.push(hour % 24 + 'j');
    if (min % 60 > 0) parts.push(min % 60 + 'm');
    if (sec % 60 > 0 && parts.length < 2) parts.push(sec % 60 + 'd');
    return parts.join(' ') || '0d';
}
