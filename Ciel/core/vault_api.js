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
// Body: { "app": "m-banking", "device": "Pixel 7" }
router.post('/request-access', (req, res) => {
    const { app, device } = req.body;
    if (!app) {
        return res.json({ success: false, message: 'Parameter "app" diperlukan.' });
    }

    const result = evaluateAccess(app, device || 'unknown');
    res.json({
        success: true,
        approved: result.approved,
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

function startVaultAPI(port) {
    const app = express();
    app.use('/api/vault', router);

    app.use((req, res) => {
        res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan.' });
    });

    app.listen(port, '0.0.0.0', () => {
        console.log(`[Vault API] Jalan di port ${port}`);
    });
}

module.exports = { startVaultAPI };
