const { EmbedBuilder } = require('discord.js');

module.exports = {
    match: (msg) => msg.startsWith('/learn'),
    execute: async (ctx, deps) => {
        const topTopics = deps.learningEngine.getUserTopTopics(ctx.userId, 5);
        const peakHours = deps.learningEngine.getUserPeakHours(ctx.userId);

        const topicList = topTopics.length > 0
            ? topTopics.map(t => `${t.topic}: ${t.count}x`).join('\n')
            : 'Belum ada data';

        const hourList = peakHours.length > 0
            ? peakHours.map(h => `${h.hour}:00 (${h.count}x)`).join('\n')
            : 'Belum ada data';

        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle('Pembelajaran Stella')
            .addFields(
                { name: 'Topik Favorit', value: '```' + topicList + '```', inline: true },
                { name: 'Jam Aktif', value: '```' + hourList + '```', inline: true },
                { name: 'Skill Dipelajari', value: '```' + deps.learningEngine.knowledgeBase.skills.length + '```', inline: true },
                { name: 'Solusi Tersimpan', value: '```' + deps.learningEngine.knowledgeBase.solutions.length + '```', inline: true }
            );

        ctx.directReply = { embeds: [embed] };
        ctx.skipAI = true;
        return deps.STATUS.SUCCESS;
    }
};