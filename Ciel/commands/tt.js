const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');

const TMP_DIR = path.join(__dirname, '../data/tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const DISCORD_MAX_SIZE = 25 * 1024 * 1024;
const TIKWM_API = 'https://www.tikwm.com/api/';
const TIKTOK_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
};

function extractTikTokUrl(text) {
    const match = text.match(/\/tt\s+(https?:\/\/[^\s]+)/i);
    return match ? match[1] : null;
}

async function fetchTikTokPage(url) {
    const resp = await axios.get(url, {
        headers: TIKTOK_HEADERS,
        timeout: 15000,
    });
    return resp.data;
}

function extractVideoData(html) {
    const match = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return null;

    try {
        const data = JSON.parse(match[1]);
        const itemStruct = data['__DEFAULT_SCOPE__']?.['webapp.video-detail']?.itemInfo?.itemStruct;
        if (!itemStruct) return null;

        const video = itemStruct.video;
        if (!video) return null;

        const playUrls = video.PlayAddrStruct?.UrlList || [];
        const awemeUrl = playUrls.find(u => u.includes('aweme/v1/play'));
        const downloadUrl = awemeUrl || video.downloadAddr;

        return {
            videoUrl: downloadUrl,
            title: itemStruct.desc || 'TikTok Video',
            author: itemStruct.author?.uniqueId || itemStruct.author?.nickname || 'unknown',
            duration: video.duration || 0,
            size: video.size || 0,
            width: video.width || 0,
            height: video.height || 0,
            hasWatermark: false,
        };
    } catch {
        return null;
    }
}

async function downloadFromTikTok(url) {
    const html = await fetchTikTokPage(url);
    const videoData = extractVideoData(html);
    if (!videoData || !videoData.videoUrl) return null;

    const resp = await axios.get(videoData.videoUrl, {
        headers: {
            'User-Agent': TIKTOK_HEADERS['User-Agent'],
            'Referer': 'https://www.tiktok.com/',
            'Origin': 'https://www.tiktok.com',
        },
        responseType: 'stream',
        timeout: 120000,
    });

    return { ...videoData, stream: resp.data, headers: resp.headers };
}

async function downloadFromTikWM(url) {
    const resp = await axios.post(TIKWM_API, new URLSearchParams({ url, hd: '1' }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000,
    });

    const data = resp.data;
    if (!data.data || (!data.data.play && !(data.data.hdplay && data.data.hdplay.length > 5))) {
        return null;
    }

    const hasHD = data.data.hdplay && typeof data.data.hdplay === 'string' && data.data.hdplay.length > 5;
    const videoUrl = hasHD ? data.data.hdplay : data.data.play;

    const dlResp = await axios.get(videoUrl, {
        responseType: 'stream',
        timeout: 120000,
    });

    return {
        videoUrl,
        title: data.data.title || 'TikTok Video',
        author: data.data.author?.unique_id || 'unknown',
        duration: 0,
        size: 0,
        width: 0,
        height: 0,
        hasWatermark: false,
        stream: dlResp.data,
        headers: dlResp.headers,
    };
}

function saveStream(stream, filePath) {
    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        stream.pipe(writer);
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
        const videoId = Date.now();
        const filePath = path.join(TMP_DIR, `tt_${videoId}.mp4`);

        try {
            let videoData = null;
            let source = '';

            // Fallback 1: TikTok direct (scrape page)
            try {
                if (statusMsg) await statusMsg.edit('Mengambil dari TikTok...').catch(() => null);
                videoData = await downloadFromTikTok(url);
                if (videoData) source = 'TikTok';
            } catch (e) {
                console.log('[TT] TikTok direct failed:', e.message);
            }

            // Fallback 2: TikWM API
            if (!videoData) {
                try {
                    if (statusMsg) await statusMsg.edit('Mengambil dari TikWM...').catch(() => null);
                    videoData = await downloadFromTikWM(url);
                    if (videoData) source = 'TikWM';
                } catch (e) {
                    console.log('[TT] TikWM failed:', e.message);
                }
            }

            if (!videoData || !videoData.stream) {
                if (statusMsg) await statusMsg.edit('Gagal download video dari semua sumber.').catch(() => null);
                return { color: 0xE74C3C, title: 'Error', description: 'Gagal mengambil video dari TikTok.' };
            }

            if (statusMsg) await statusMsg.edit(`Mengunduh video... (via ${source})`).catch(() => null);

            await saveStream(videoData.stream, filePath);

            const stat = fs.statSync(filePath);
            const sizeMB = (stat.size / 1024 / 1024).toFixed(1);

            if (stat.size > DISCORD_MAX_SIZE) {
                fs.unlinkSync(filePath);
                if (statusMsg) await statusMsg.edit('Video terlalu besar (>25MB), tidak bisa dikirim ke Discord.').catch(() => null);
                return { color: 0xE74C3C, title: 'Terlalu Besar', description: `Ukuran video: **${sizeMB}MB** (limit Discord: 25MB)` };
            }

            const file = new AttachmentBuilder(filePath, { name: `tiktok_${videoId}.mp4` });

            if (statusMsg) await statusMsg.delete().catch(() => null);

            const quality = videoData.width > 0 ? `${videoData.width}x${videoData.height}` : 'Unknown';
            const embed = new EmbedBuilder()
                .setColor(0x00F2EA)
                .setTitle(videoData.title.substring(0, 256))
                .setDescription(`By: **@${videoData.author}**\nSize: **${sizeMB}MB** | Quality: **${quality}**\nSource: **${source}**`)
                .setFooter({ text: 'TikTok Download • Ciel' })
                .setTimestamp();

            await message.channel.send({ embeds: [embed], files: [file] });
            fs.unlinkSync(filePath);
            return null;

        } catch (err) {
            console.error('[TT] Error:', err.message);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            if (statusMsg) await statusMsg.edit('Gagal download: ' + err.message).catch(() => null);
            return null;
        }
    }
};
