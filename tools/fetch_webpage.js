const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    name: "fetch_webpage",
    description: "Mengambil dan membaca konten dari sebuah halaman web.",
    parameters: {
        type: "OBJECT",
        properties: {
            url: { type: "STRING", description: "URL halaman web yang akan dibaca" }
        },
        required: ["url"]
    },
    execute: async (args) => {
        try {
            const response = await axios.get(args.url, { timeout: 15000 });
            const $ = cheerio.load(response.data);
            $('script, style, nav, footer, header, iframe').remove();
            let text = $('body').text().replace(/\s+/g, ' ').trim();
            if (text.length > 5000) text = text.substring(0, 5000) + "\n...[DIPOTONG]";
            return { content: text, url: args.url };
        } catch (error) {
            return { error: error.message };
        }
    }
};
