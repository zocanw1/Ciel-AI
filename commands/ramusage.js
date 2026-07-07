const { exec } = require('child_process');

module.exports = {
    match: (text) => text.startsWith('/ramusage'),
    execute: async () => {
        return new Promise((resolve) => {
            exec('free -m', { timeout: 10000 }, (error, stdout, stderr) => {
                if (error) {
                    resolve({
                        color: 0xE74C3C,
                        title: 'Error',
                        description: '```' + error.message + '```'
                    });
                    return;
                }

                const lines = stdout.trim().split('\n');
                const memLine = lines[1]?.split(/\s+/);
                const swapLine = lines[2]?.split(/\s+/);

                if (!memLine || memLine.length < 7) {
                    resolve({
                        color: 0xE74C3C,
                        title: 'Error',
                        description: 'Gagal parse output free'
                    });
                    return;
                }

                const memTotal = parseInt(memLine[1]);
                const memUsed = parseInt(memLine[2]);
                const memAvail = parseInt(memLine[6]);
                const memPercent = ((memUsed / memTotal) * 100).toFixed(1);

                const swapTotal = swapLine ? parseInt(swapLine[1]) : 0;
                const swapUsed = swapLine ? parseInt(swapLine[2]) : 0;
                const swapPercent = swapTotal > 0 ? ((swapUsed / swapTotal) * 100).toFixed(1) : '0.0';

                const out = [];

                out.push('**Memory** `' + progressBar(memPercent) + ' ' + memPercent + '%`');
                out.push('' + fmtMB(memUsed) + ' / ' + fmtMB(memTotal + ''));
                out.push('Available `' + fmtMB(memAvail) + '` · Free `' + fmtMB(parseInt(memLine[3])) + '`');

                if (swapTotal > 0) {
                    out.push('');
                    out.push('**Swap** `' + progressBar(swapPercent) + ' ' + swapPercent + '%`');
                    out.push('' + fmtMB(swapUsed) + ' / ' + fmtMB(swapTotal + ''));
                }

                resolve({
                    color: 0x3498DB,
                    title: 'RAM Usage',
                    description: out.join('\n')
                });
            });
        });
    }
};

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
