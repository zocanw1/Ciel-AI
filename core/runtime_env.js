function loadDeepSeekConfig(env = process.env) {
    const apiKey = env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) {
        throw new Error('DEEPSEEK_API_KEY is required');
    }
    return {
        apiKey,
        model: env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat'
    };
}

function loadGeminiConfig(env = process.env) {
    const apiKey = env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is required');
    }
    return {
        apiKey,
        model: env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash-preview-04-17'
    };
}

module.exports = { loadDeepSeekConfig, loadGeminiConfig };
