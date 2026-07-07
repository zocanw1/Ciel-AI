const axios = require('axios');

module.exports = {
    name: "search_web",
    description: "Mencari informasi di web.",
    parameters: {
        type: "OBJECT",
        properties: {
            query: { type: "STRING", description: "Kata kunci pencarian" }
        },
        required: ["query"]
    },
    execute: async (args) => {
        const query = args.query;
        let finalResults = [];

        // Try SearXNG local
        try {
            const response = await axios.get("http://localhost:8888/search", {
                params: { q: query, format: "json", language: "id-ID", safesearch: 1 },
                timeout: 8000
            });
            if (response.data?.results) {
                response.data.results.slice(0, 5).forEach(res => {
                    if (res.content) {
                        const snippet = res.content.replace(/<\/?[^>]+(>|$)/g, "").trim();
                        finalResults.push(`[${res.title}] ${snippet}\nLink: ${res.url}`);
                    }
                });
            }
        } catch (e) {}

        // Fallback Wikipedia
        if (finalResults.length === 0) {
            try {
                const wikiRes = await axios.get(
                    `https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`,
                    { timeout: 5000 }
                );
                const items = wikiRes.data?.query?.search || [];
                for (const item of items.slice(0, 5)) {
                    const text = item.snippet.replace(/<\/?[^>]+(>|$)/g, '').trim();
                    finalResults.push(`[Wikipedia] ${text}`);
                }
            } catch (e) {}
        }

        if (finalResults.length === 0) {
            return { result: "Tidak ada hasil pencarian." };
        }
        return { result: finalResults.join("\n\n"), source: "SearXNG/Wikipedia" };
    }
};
