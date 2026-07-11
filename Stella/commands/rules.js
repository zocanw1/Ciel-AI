const { EmbedBuilder } = require('discord.js');

module.exports = {
    match: (msg) => msg.startsWith('/rules'),
    execute: async (ctx, deps) => {
        const rulesText = deps.selfModifier ? deps.selfModifier.getRulesText() : 'Self-Modifier tidak aktif.';

        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle('Aturan Kustom')
            .setDescription('```' + rulesText + '```');

        ctx.directReply = { embeds: [embed] };
        ctx.skipAI = true;
        return deps.STATUS.SUCCESS;
    }
};