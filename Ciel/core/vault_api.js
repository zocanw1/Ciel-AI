const express = require('express');
const { evaluateAccess } = require('./vault_engine');
const { getLogs } = require('./vault_store');

const VAULT_API_KEY = process.env.VAULT_API_KEY;
const NOTIFY_CHANNEL_ID = '1523012586772369589';
let discordClient = null;

async function notifyDiscord(app, deviceId, approved, reason) {
    if (!discordClient) return;
    try {
        const channel = await discordClient.channels.fetch(NOTIFY_CHANNEL_ID);
        if (!channel) return;
        await channel.send(`${approved ? '✅' : '❌'} **${app}** (${deviceId}) — ${approved ? 'DISETUJUI' : 'DITOLAK'} (${reason})`);
    } catch (e) {
        console.error('[Vault] Notifikasi Discord error:', e.message);
    }
}

function authMiddleware(req, res, next) {
    const key = req.headers['x-api-key'];
    if (!VAULT_API_KEY || key !== VAULT_API_KEY) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    next();
}

function simpleAuth(req, res, next) {
    const key = req.headers['x-api-key'] || req.query.key;
    if (!VAULT_API_KEY || key !== VAULT_API_KEY) {
        return res.status(401).type('text/plain').send('NO');
    }
    next();
}

function startVaultAPI(port, client) {
    if (client) discordClient = client;

    const router = express.Router();
    router.use(express.json());
    router.use(authMiddleware);

    router.post('/request-access', (req, res) => {
        const { app, deviceId } = req.body || {};
        if (!app) {
            return res.status(400).json({ success: false, message: 'Parameter "app" diperlukan.' });
        }

        const result = evaluateAccess(app, deviceId || 'unknown');
        notifyDiscord(app, deviceId || 'unknown', result.approved, result.reason);
        res.json({
            success: true,
            approved: result.approved,
            reason: result.reason,
            message: result.message,
            remaining: result.remaining,
        });
    });

    router.get('/log', (req, res) => {
        const logs = getLogs(10);
        res.json({ success: true, logs });
    });

    router.get('/health', (req, res) => {
        res.json({ success: true, status: 'ok', service: 'Ciel Vault API' });
    });

    const v1router = express.Router();
    v1router.use(express.json());

    v1router.all('/vault/check', simpleAuth, (req, res) => {
        const app = req.body?.app || req.query.app;
        const deviceId = req.body?.deviceId || req.query.deviceId || 'unknown';
        if (!app) {
            return res.type('text/plain').send('NO');
        }

        const result = evaluateAccess(app, deviceId);
        notifyDiscord(app, deviceId, result.approved, result.reason);
        res.type('text/plain').send(result.approved ? 'OK' : 'NO');
    });

    const app = express();
    app.use('/api/vault', router);
    app.use('/api/v1', v1router);

    app.use((req, res) => {
        const isV1 = req.path.startsWith('/api/v1');
        if (isV1) return res.status(404).type('text/plain').send('NO');
        res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan.' });
    });

    app.listen(port, '0.0.0.0', () => {
        console.log(`[Vault API] Jalan di port ${port}`);
    });
}

module.exports = { startVaultAPI };
