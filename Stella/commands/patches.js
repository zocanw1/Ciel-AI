const { EmbedBuilder } = require('discord.js');

module.exports = {
    match: (msg) => msg.startsWith('/patches'),
    execute: async (ctx, deps) => {
        const patchText = deps.selfModifier ? deps.selfModifier.getPatchesText() : 'Self-Modifier tidak aktif.';

        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle('Patch Self-Modifier')
            .setDescription('```' + patchText + '```');

        ctx.directReply = { embeds: [embed] };
        ctx.skipAI = true;
        return deps.STATUS.SUCCESS;
    }
};