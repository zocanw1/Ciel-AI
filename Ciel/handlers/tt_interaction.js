const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');

const TMP_DIR = path.join(__dirname, '../data/tmp');
const IMMICH_URL = process.env.IMMICH_URL || 'http://192.168.1.10:2283';
const IMMICH_API_KEY = process.env.IMMICH_API_KEY;

const pendingDownloads = new Map();

function storePending(videoId, data) {
    pendingDownloads.set(videoId, data);
    setTimeout(() => {
        const pending = pendingDownloads.get(videoId);
        if (pending && fs.existsSync(pending.filePath)) {
            fs.unlinkSync(pending.filePath);
        }
        pendingDownloads.delete(videoId);
    }, 5 * 60 * 1000);
}

function getPending(videoId) {
    return pendingDownloads.get(videoId);
}

function deletePending(videoId) {
    const pending = pendingDownloads.get(videoId);
    if (pending && fs.existsSync(pending.filePath)) {
        fs.unlinkSync(pending.filePath);
    }
    pendingDownloads.delete(videoId);
}

async function uploadToImmich(filePath, videoData) {
    if (!IMMICH_API_KEY) throw new Error('IMMICH_API_KEY belum diset di .env');

    const fileBuffer = fs.readFileSync(filePath);
    const filename = `tiktok_${videoData.author}_${Date.now()}.mp4`;

    const formData = new FormData();
    formData.append('assetData', new Blob([fileBuffer], { type: 'video/mp4' }), filename);
    formData.append('fileCreatedAt', new Date().toISOString());
    formData.append('fileModifiedAt', new Date().toISOString());
    formData.append('filename', filename);

    const resp = await axios.post(`${IMMICH_URL}/api/assets`, formData, {
        headers: { 'x-api-key': IMMICH_API_KEY },
        timeout: 120000,
    });

    return resp.data;
}

async function handleInteraction(interaction, customId) {
    try {
        const parts = customId.split('_');
        const action = parts[1];
        const videoId = parts.slice(2).join('_');

        const pending = getPending(videoId);
        if (!pending) {
            return interaction.reply({ content: 'Video sudah expired. Download ulang ya.', ephemeral: true }).catch(() => null);
        }

        if (action === 'discord') {
            await interaction.deferUpdate().catch(() => null);

            const file = new AttachmentBuilder(pending.filePath, { name: `tiktok_${videoId}.mp4` });
            const quality = pending.videoData.width > 0 ? `${pending.videoData.width}x${pending.videoData.height}` : 'Unknown';
            const sizeMB = (fs.statSync(pending.filePath).size / 1024 / 1024).toFixed(1);

            const embed = new EmbedBuilder()
                .setColor(0x00F2EA)
                .setTitle(pending.videoData.title.substring(0, 256))
                .setDescription(`By: **@${pending.videoData.author}**\nSize: **${sizeMB}MB** | Quality: **${quality}**\nSource: **${pending.source}**`)
                .setFooter({ text: 'TikTok Download • Ciel' })
                .setTimestamp();

            await interaction.message.edit({ embeds: [embed], files: [file], components: [] }).catch(() => null);
            deletePending(videoId);

        } else if (action === 'immich') {
            if (!IMMICH_API_KEY) {
                return interaction.reply({ content: 'IMMICH_API_KEY belum diset.', ephemeral: true }).catch(() => null);
            }

            // Show loading on original message
            const loadingEmbed = new EmbedBuilder()
                .setColor(0xF39C12)
                .setTitle(pending.videoData.title.substring(0, 256))
                .setDescription(`By: **@${pending.videoData.author}**\n\nMengupload ke Immich...`)
                .setFooter({ text: 'TikTok → Immich • Ciel' })
                .setTimestamp();

            await interaction.message.edit({ embeds: [loadingEmbed], components: [] }).catch(() => null);
            await interaction.deferUpdate().catch(() => null);

            const result = await uploadToImmich(pending.filePath, pending.videoData);

            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('Tersimpan ke Immich')
                .setDescription(`Video **${pending.videoData.title.substring(0, 100)}**\nBy: **@${pending.videoData.author}**\n\nAsset ID: \`${result.id || 'unknown'}\``)
                .setFooter({ text: 'TikTok → Immich • Ciel' })
                .setTimestamp();

            await interaction.message.edit({ embeds: [embed], components: [] }).catch(() => null);
            deletePending(videoId);
        }

    } catch (err) {
        console.error('[TT Interaction] Error:', err.message);
        deletePending(customId.split('_').slice(2).join('_'));
    }
}

module.exports = { storePending, getPending, deletePending, handleInteraction };
