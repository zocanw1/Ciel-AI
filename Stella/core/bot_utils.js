const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
    }
}

function createHistoryManager(dbFile, memoryBankFile, maxHistory = 40) {
    let chatHistory = {};
    let memoryBank = {};

    if (fs.existsSync(dbFile)) chatHistory = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
    if (fs.existsSync(memoryBankFile)) memoryBank = JSON.parse(fs.readFileSync(memoryBankFile, 'utf-8'));

    function save() {
        fs.writeFileSync(dbFile, JSON.stringify(chatHistory, null, 2));
        fs.writeFileSync(memoryBankFile, JSON.stringify(memoryBank, null, 2));
    }

    function getHistory(userId) {
        if (!chatHistory[userId]) chatHistory[userId] = [];
        return chatHistory[userId].map(h => ({ role: h.role, parts: [{ text: h.parts }] }));
    }

    function addToHistory(userId, role, text) {
        if (!chatHistory[userId]) chatHistory[userId] = [];
        chatHistory[userId].push({ role, parts: text });
        if (chatHistory[userId].length > maxHistory * 2) chatHistory[userId] = chatHistory[userId].slice(-maxHistory * 2);
        save();
    }

    function getMemoryText(userId) {
        if (!memoryBank[userId]) return "Belum ada fakta khusus.";
        let text = "";
        for (const [cat, facts] of Object.entries(memoryBank[userId])) {
            text += `[${cat}]:\n- ${facts.join("\n- ")}\n\n`;
        }
        return text || "Belum ada fakta khusus.";
    }

    function getMemoryBank() {
        return memoryBank;
    }

    function setMemoryBank(bank) {
        memoryBank = bank;
    }

    return { getHistory, addToHistory, getMemoryText, save, getMemoryBank, setMemoryBank };
}

function loadDynamicTools(toolsDir) {
    if (!fs.existsSync(toolsDir)) fs.mkdirSync(toolsDir);
    const toolFiles = fs.readdirSync(toolsDir).filter(f => f.endsWith('.js'));

    let declarations = [];
    let handlers = {};

    for (const file of toolFiles) {
        const fullPath = path.join(toolsDir, file);
        delete require.cache[require.resolve(fullPath)];
        try {
            const plugin = require(fullPath);
            if (plugin.name && plugin.execute) {
                declarations.push({
                    name: plugin.name,
                    description: plugin.description || "",
                    parameters: plugin.parameters || { type: "OBJECT", properties: {} }
                });
                handlers[plugin.name] = plugin.execute;
            }
        } catch (e) {
            console.error(`Gagal meload tool ${file}:`, e.message);
        }
    }
    return { declarations, handlers };
}

async function handleToolCall(functionCall, handlers, toolContext) {
    const { name, args } = functionCall;

    if (handlers[name]) {
        try {
            const response = await handlers[name](args, toolContext);
            return { functionResponse: { name, response }, _mediaResult: response };
        } catch (e) {
            return { functionResponse: { name, response: { error: e.message } } };
        }
    }
    return { functionResponse: { name, response: { error: "Unknown tool" } } };
}

module.exports = {
    loadEnvFile,
    createHistoryManager,
    loadDynamicTools,
    handleToolCall
};
