const express = require('express');
const { evaluateAccess } = require('./vault_engine');
const { getLogs } = require('./vault_store');

const VAULT_API_KEY = process.env.VAULT_API_KEY;

function authMiddleware(req, res, next) {
    const key = req.headers['x-api-key'];
    if (!VAULT_API_KEY || key !== VAULT_API_KEY) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    next();
}

const router = express.Router();
router.use(express.json());
router.use(authMiddleware);

// POST /api/vault/request-access
// Body: { "app": "m-banking", "deviceId": "hp_utama", "timestamp": 1783847373 }
router.post('/request-access', (req, res) => {
    const { app, deviceId } = req.body || {};
    if (!app) {
        return res.status(400).json({ success: false, message: 'Parameter "app" diperlukan.' });
    }

    const result = evaluateAccess(app, deviceId || 'unknown');
    res.json({
        success: true,
        approved: result.approved,
        reason: result.reason,
        message: result.message,
        remaining: result.remaining,
    });
});

// GET /api/vault/log (optional, for checking recent access)
router.get('/log', (req, res) => {
    const logs = getLogs(10);
    res.json({ success: true, logs });
});

// GET /api/vault/health
router.get('/health', (req, res) => {
    res.json({ success: true, status: 'ok', service: 'Ciel Vault API' });
});

// MacroDroid-friendly endpoint — returns "OK" or "NO"
const v1router = express.Router();
v1router.use(express.json());

function simpleAuth(req, res, next) {
    const key = req.headers['x-api-key'] || req.query.key;
    if (!VAULT_API_KEY || key !== VAULT_API_KEY) {
        return res.status(401).type('text/plain').send('NO');
    }
    next();
}

v1router.all('/vault/check', simpleAuth, (req, res) => {
    const app = req.body?.app || req.query.app;
    const deviceId = req.body?.deviceId || req.query.deviceId || 'unknown';
    if (!app) {
        return res.type('text/plain').send('NO');
    }

    const result = evaluateAccess(app, deviceId);
    res.type('text/plain').send(result.approved ? 'OK' : 'NO');
});

function startVaultAPI(port) {
    const app = express();
    app.use('/api/vault', router);
    app.use('/api/v1', v1router);

    app.use((req, res) => {
        const isV1 = req.path.startsWith('/api/v1');
        if (isV1) {
            return res.status(404).type('text/plain').send('NO');
        }
        res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan.' });
    });

    app.listen(port, '0.0.0.0', () => {
        console.log(`[Vault API] Jalan di port ${port}`);
    });
}

module.exports = { startVaultAPI };
