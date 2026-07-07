const axios = require('axios');

function normalizeSchema(schema = {}) {
    const normalized = { ...schema };
    if (normalized.type) normalized.type = String(normalized.type).toLowerCase();
    if (normalized.properties) {
        normalized.properties = Object.fromEntries(
            Object.entries(normalized.properties).map(([name, value]) => [name, normalizeSchema(value)])
        );
    }
    if (normalized.items) normalized.items = normalizeSchema(normalized.items);
    return normalized;
}

function toGeminiTools(declarations = []) {
    return [{
        functionDeclarations: declarations.map((d) => ({
            name: d.name,
            description: d.description || '',
            parameters: normalizeSchema(d.parameters)
        }))
    }];
}

function toGeminiContents(messages) {
    const contents = [];
    let systemParts = [];
    for (const msg of messages) {
        if (msg.role === 'system') {
            systemParts.push({ text: msg.content });
            continue;
        }
        if (msg.role === 'assistant') {
            const parts = [];
            if (msg.content) parts.push({ text: msg.content });
            if (msg.tool_calls) {
                for (const tc of msg.tool_calls) {
                    const fc = {
                        name: tc.function?.name,
                        args: JSON.parse(tc.function?.arguments || '{}')
                    };
                    if (tc.thought_signature) fc.thought_signature = tc.thought_signature;
                    parts.push({ functionCall: fc });
                }
            }
            contents.push({ role: 'model', parts });
            continue;
        }
        if (msg.role === 'tool') {
            contents.push({
                role: 'function',
                parts: [{
                    functionResponse: {
                        name: msg.name || '',
                        response: (() => {
                            try { return JSON.parse(msg.content); } catch { return msg.content; }
                        })()
                    }
                }]
            });
            continue;
        }
        contents.push({ role: 'user', parts: [{ text: msg.content || '' }] });
    }
    return { contents, systemInstruction: systemParts.length > 0 ? { parts: systemParts } : undefined };
}

class GeminiProvider {
    constructor({ apiKey, httpClient = axios }) {
        this.apiKey = apiKey;
        this.httpClient = httpClient;
    }

    async complete({ messages, tools = [], model = 'gemini-2.5-flash-preview-04-17', maxTokens = 2000 }) {
        const { contents, systemInstruction } = toGeminiContents(messages);
        const body = {
            contents,
            generationConfig: {
                maxOutputTokens: maxTokens
            }
        };
        if (tools.length > 0) {
            body.tools = tools;
            body.toolConfig = { functionCallingConfig: { mode: 'AUTO' } };
        }
        if (systemInstruction) body.systemInstruction = systemInstruction;

        const url = model.startsWith('models/') ? model : `models/${model}:generateContent`;

        let response;
        try {
            response = await this.httpClient.post(url, body, {
                baseURL: 'https://generativelanguage.googleapis.com/v1beta',
                timeout: 90000,
                params: { key: this.apiKey },
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e) {
            console.log('[Gemini error]', e.response?.status, JSON.stringify(e.response?.data));
            throw new Error('Gemini API: ' + (e.response?.data?.error?.message || e.message));
        }

        const candidate = response.data?.candidates?.[0];
        if (!candidate) throw new Error('Gemini returned no candidates.');

        const parts = candidate.content?.parts || [];
        const toolCalls = [];
        let content = '';

        for (const part of parts) {
            if (part.functionCall) {
                const tc = {
                    id: part.functionCall.name + '_' + Date.now(),
                    type: 'function',
                    function: {
                        name: part.functionCall.name,
                        arguments: JSON.stringify(part.functionCall.args || {})
                    }
                };
                if (part.functionCall.thought_signature) tc.thought_signature = part.functionCall.thought_signature;
                toolCalls.push(tc);
            }
            if (part.text) {
                content += part.text;
            }
        }

        const finishReason = candidate.finishReason || 'STOP';
        if (finishReason === 'PROHIBITED' || finishReason === 'SAFETY') {
            console.log('[Gemini] Blocked:', finishReason, candidate.safetyRatings);
            content = 'Maaf, respons diblokir oleh filter keamanan.';
        }

        return { content, tool_calls: toolCalls.length > 0 ? toolCalls : undefined };
    }
}

module.exports = { GeminiProvider, toGeminiTools };