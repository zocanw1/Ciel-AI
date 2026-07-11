const { EmbedBuilder } = require('discord.js');

module.exports = {
    match: (msg) => msg.startsWith('/skills'),
    execute: async (ctx, deps) => {
        const skillText = deps.evolutionSystem.getSkillTreeText();

        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle('Skill Tree')
            .setDescription('```' + skillText + '```');

        ctx.directReply = { embeds: [embed] };
        ctx.skipAI = true;
        return deps.STATUS.SUCCESS;
    }
};