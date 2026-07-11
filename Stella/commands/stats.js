const { EmbedBuilder } = require('discord.js');

module.exports = {
    match: (msg) => msg.startsWith('/stats'),
    execute: async (ctx, deps) => {
        const modelStyle = deps.currentModel === 'codex' ? 'Stella Natural' : deps.currentModel === 'groq' ? 'Stella Cepat' : 'Stella Standar';

        const evoStats = deps.evolutionSystem.getStatsText();
        const deepStats = deps.deepBrain ? deps.deepBrain.getStatsText() : '';
        const researchStats = deps.autoResearcher ? deps.autoResearcher.getStatsText() : '';

        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle('Statistik Sistem')
            .setDescription('```' + evoStats + '```')
            .setFooter({ text: 'Model aktif: ' + modelStyle });

        if (deepStats) embed.addFields({ name: 'Deep Brain', value: '```' + deepStats + '```', inline: true });
        if (researchStats) embed.addFields({ name: 'Auto Researcher', value: '```' + researchStats + '```', inline: true });

        ctx.directReply = { embeds: [embed] };
        ctx.skipAI = true;
        return deps.STATUS.SUCCESS;
    }
};