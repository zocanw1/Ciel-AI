const { exec } = require('child_process');
const { format } = require('date-fns');
const { formatUptime, progressBar, fmtMB } = require('../core/utils');

module.exports = {
    match: (text) => text.startsWith('/info'),
    execute: async () => {
        return new Promise((resolve) => {
            const promises = [
                getCpuInfo(),
                getRamInfo(),
                getUptime(),
                getDiskInfo(),
                getPm2List(),
                getOsInfo()
            ];

            Promise.allSettled(promises).then((results) => {
                const [cpu, ram, uptime, disk, pm2, os] = results.map(r =>
                    r.status === 'fulfilled' ? r.value : null
                );

                const lines = [];

                lines.push('**Sistem** `' + os.hostname + '` — ' + os.os + ' ' + os.kernel);
                lines.push('Uptime `' + uptime + '`');
                lines.push('');
                lines.push('**CPU** `' + cpu.bar + ' ' + cpu.percent + '%`');
                lines.push('Load `' + cpu.load + '` (1m) `' + cpu.load5 + '` (5m) `' + cpu.load15 + '` (15m)');
                lines.push('' + cpu.cores + ' core — ' + cpu.running + '/' + cpu.total + ' task');
                lines.push('');
                lines.push('**RAM** `' + ram.bar + ' ' + ram.percent + '%`');
                lines.push('' + ram.used + ' / ' + ram.total + ' — ' + ram.avail + ' available');
                lines.push('');
                lines.push('**Disk** `' + disk.bar + ' ' + disk.percent + '%`');
                lines.push('' + disk.used + ' / ' + disk.total + '');

                if (pm2 && pm2.processes.length > 0) {
                    lines.push('');
                    lines.push('**PM2**');
                    for (const proc of pm2.processes) {
                        const dot = proc.status === 'online' ? '🟢' : '🔴';
                        lines.push('' + dot + ' `' + proc.name + '` — ' + proc.cpu + '% CPU / ' + proc.mem + '');
                    }
                }

                resolve({
                    color: 0x2ECC71,
                    title: 'Server Info',
                    description: lines.join('\n'),
                    footer: format(new Date(), 'dd/MM/yyyy HH:mm')
                });
            });
        });
    }
};

function getCpuInfo() {
    return new Promise((resolve) => {
        exec('cat /proc/loadavg', { timeout: 5000 }, (err, stdout) => {
            if (err) return resolve(fallback('cpu'));

            const parts = stdout.trim().split(/\s+/);
            const load = parts[0] || '?';
            const load5 = parts[1] || '?';
            const load15 = parts[2] || '?';
            const procParts = (parts[3] || '?/0').split('/');
            const running = procParts[0] || '?';
            const total = procParts[1] || '?';

            exec('nproc', { timeout: 5000 }, (err2, stdout2) => {
                const cores = err2 ? '?' : stdout2.trim();
                const pct = Math.min(100, Math.round((parseFloat(load) / parseInt(cores || 1)) * 100));
                const bar = progressBar(pct);
                resolve({ load, load5, load15, cores, running, total, bar, percent: pct });
            });
        });
    });
}

function getRamInfo() {
    return new Promise((resolve) => {
        exec('free -m', { timeout: 10000 }, (error, stdout) => {
            if (error) return resolve(fallback('ram'));

            const lines = stdout.trim().split('\n');
            const memLine = lines[1]?.split(/\s+/);
            if (!memLine || memLine.length < 7) return resolve(fallback('ram'));

            const total = parseInt(memLine[1]);
            const used = parseInt(memLine[2]);
            const avail = parseInt(memLine[6]);
            const percent = ((used / total) * 100).toFixed(1);

            resolve({
                used: fmtMB(used),
                total: fmtMB(total),
                percent,
                avail: fmtMB(avail),
                bar: progressBar(percent)
            });
        });
    });
}

function getUptime() {
    return new Promise((resolve) => {
        exec('uptime -p', { timeout: 5000 }, (err, stdout) => {
            if (err) return resolve('?');
            resolve(stdout.trim().replace('up ', ''));
        });
    });
}

function getDiskInfo() {
    return new Promise((resolve) => {
        exec("df -h / | tail -1", { timeout: 5000 }, (err, stdout) => {
            if (err) return resolve(fallback('disk'));

            const parts = stdout.trim().split(/\s+/);
            if (parts.length < 5) return resolve(fallback('disk'));

            resolve({
                used: parts[2] || '?',
                total: parts[1] || '?',
                percent: parts[4]?.replace('%', '') || '0',
                bar: progressBar(parts[4]?.replace('%', '') || '0')
            });
        });
    });
}

function getPm2List() {
    return new Promise((resolve) => {
        exec('pm2 jlist', { timeout: 15000 }, (error, stdout) => {
            if (error) return resolve({ processes: [] });

            try {
                const processes = JSON.parse(stdout).map(proc => {
                    const status = proc.pm2_env?.status || 'unknown';
                    const memBytes = proc.monit?.memory || 0;
                    const memMB = (memBytes / 1024 / 1024).toFixed(1);
                    const uptimeMs = proc.pm2_env?.pm_uptime ? Date.now() - proc.pm2_env.pm_uptime : 0;
                    const uptimeStr = formatUptime(uptimeMs);

                    return {
                        name: proc.name || 'unknown',
                        status: status,
                        cpu: proc.monit?.cpu ?? '-',
                        mem: memMB + ' MB',
                        pid: proc.pid || '-',
                        uptime: uptimeStr
                    };
                });

                resolve({ processes });
            } catch (e) {
                resolve({ processes: [] });
            }
        });
    });
}

function getOsInfo() {
    return new Promise((resolve) => {
        const results = fallback('os');
        exec('uname -o', { timeout: 5000 }, (err, stdout) => {
            results.os = err ? 'Linux' : stdout.trim();
            exec('uname -n', { timeout: 5000 }, (err2, stdout2) => {
                results.hostname = err2 ? 'server' : stdout2.trim();
                exec('uname -r', { timeout: 5000 }, (err3, stdout3) => {
                    results.kernel = err3 ? '?' : stdout3.trim();
                    resolve(results);
                });
            });
        });
    });
}

function fallback(type) {
    if (type === 'cpu') return { load: '?', load5: '?', load15: '?', cores: '?', running: '?', total: '?', bar: '██████████', percent: 0 };
    if (type === 'ram') return { used: '?', total: '?', percent: '0', avail: '?', bar: '██████████' };
    if (type === 'disk') return { used: '?', total: '?', percent: '0', bar: '██████████' };
    if (type === 'os') return { os: 'Linux', hostname: 'server', kernel: '?' };
    return {};
}
