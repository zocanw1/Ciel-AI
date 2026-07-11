const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const TIKWM_API = 'https://www.tikwm.com/api/';
const TMP_DIR = path.join(__dirname, '../data/tmp');

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

function extractTikTokUrl(text) {
    const match = text.match(/\/tt\s+(https?:\/\/[^\s]+)/i);
    return match ? match[1] : null;
}

async function downloadVideo(url) {
    const resp = await axios.post(TIKWM_API, new URLSearchParams({ url }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
    });
    return resp.data;
}

async function downloadFile(downloadUrl, filePath) {
    const resp = await axios.get(downloadUrl, { responseType: 'stream', timeout: 60000 });
    const writer = fs.createWriteStream(filePath);
    resp.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

module.exports = {
    match: (text) => /^\/tt\s+/i.test(text),

    execute: async (message) => {
        const url = extractTikTokUrl(message.content);
        if (!url) {
            return { color: 0xF1C40F, title: 'Format Salah', description: 'Gunakan: `/tt <link tiktok>`' };
        }

        const statusMsg = await message.channel.send('Mendownload video TikTok...').catch(() => null);

        try {
            const data = await downloadVideo(url);

            if (!data.data || !data.data.play) {
                if (statusMsg) await statusMsg.edit('Gagal download video. Coba link lain.').catch(() => null);
                return { color: 0xE74C3C, title: 'Error', description: 'Gagal mengambil data video dari TikTok.' };
            }

            const videoUrl = data.data.play;
            const title = data.data.title || 'TikTok Video';
            const author = data.data.author?.unique_id || 'unknown';
            const videoId = Date.now();
            const filePath = path.join(TMP_DIR, `tt_${videoId}.mp4`);

            if (statusMsg) await statusMsg.edit('Mengunduh file video...').catch(() => null);

            await downloadFile(videoUrl, filePath);

            const stat = fs.statSync(filePath);
            const sizeMB = (stat.size / 1024 / 1024).toFixed(1);

            if (stat.size > 25 * 1024 * 1024) {
                fs.unlinkSync(filePath);
                if (statusMsg) await statusMsg.edit('Video terlalu besar (>25MB), tidak bisa dikirim ke Discord.').catch(() => null);
                return { color: 0xE74C3C, title: 'Terlalu Besar', description: `Ukuran video: **${sizeMB}MB** (limit Discord: 25MB)` };
            }

            const file = new AttachmentBuilder(filePath, { name: `tiktok_${videoId}.mp4` });

            if (statusMsg) await statusMsg.delete().catch(() => null);

            const embed = new EmbedBuilder()
                .setColor(0x00F2EA)
                .setTitle(title.substring(0, 256))
                .setDescription(`By: **@${author}**\nSize: **${sizeMB}MB**`)
                .setFooter({ text: 'TikTok Download • Ciel' })
                .setTimestamp();

            await message.channel.send({ embeds: [embed], files: [file] });

            fs.unlinkSync(filePath);
            return null;

        } catch (err) {
            console.error('[TT] Error:', err.message);
            if (statusMsg) await statusMsg.edit('Gagal download: ' + err.message).catch(() => null);
            return null;
        }
    }
};
