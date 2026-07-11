const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, AudioPlayer, createAudioResource, StreamType, NoSubscriberBehavior, AudioPlayerStatus, createAudioPlayer, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const { generateVoiceFile, generateVoiceTempPath, DEFAULT_VOICE } = require('./tools/generate_voice');
const fs = require('fs');
const path = require('path');

// FFmpeg static binary untuk @discordjs/voice
try {
    const ffmpegPath = require('ffmpeg-static');
    process.env.PATH = path.dirname(ffmpegPath) + path.delimiter + process.env.PATH;
} catch (e) {
    console.warn('[FFmpeg] ffmpeg-static not loaded, fallback to system PATH');
}
const axios = require('axios');
const { format, isAfter } = require('date-fns');

const LearningEngine = require('./core/learning_engine');
const EvolutionSystem = require('./core/evolution');
const DeepBrain = require('./core/deep_brain');
const AutoResearcher = require('./core/auto_researcher');
const SelfModifier = require('./core/self_modifier');
const { DeepSeekProvider, toDeepSeekTools } = require('./core/deepseek_provider');
const { loadDeepSeekConfig } = require('./core/runtime_env');
const { buildStellaTree, createContext } = require('./core/stella_tree');
const { buildPromptBudget } = require('./core/token_router');
const { getPersonaPolicy } = require('./core/persona_policy');
const { shouldLogDebug } = require('./core/runtime_debug');
const { loadEnvFile, createHistoryManager, loadDynamicTools, handleToolCall: baseHandleToolCall } = require('./core/bot_utils');

// ── Stella v5 New Systems ──
const { bus: eventBus, EVENTS } = require('./core/event_bus');
const KnowledgeBase = require('./core/knowledge');
const MemoryCore = require('./core/memory/memory_core');
const ExecutiveBrain = require('./core/engine/executive_brain');
const ReasoningEngine = require('./core/reasoning/reasoner');
const PlanningEngine = require('./core/engine/planning_engine');
const ReflectionEngine = require('./core/engine/reflection_engine');
const GoalEngine = require('./core/engine/goal_engine');
const CuriosityEngine = require('./core/engine/curiosity_engine');
const ExperienceEngine = require('./core/experience/experience_engine');
const SkillEngine = require('./core/skills/skill_engine');
const WorkflowEngine = require('./core/workflow/workflow_engine');
const Scheduler = require('./core/scheduler/scheduler');
const SafetyLayer = require('./core/safety/safety_layer');
const ApplicationKernel = require('./core/kernel');
const GroundTruthManager = require('./core/ml/ground_truth_manager');
const ModelRegistry = require('./core/ml/model_registry');
const FeedbackEngine = require('./core/ml/feedback_engine');
const { seedGroundTruth } = require('./core/ml/seed');

const ENV_FILE = path.join(__dirname, '.env');
if (fs.existsSync(ENV_FILE)) loadEnvFile(ENV_FILE);

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) throw new Error('DISCORD_TOKEN is required in .env');

const PERSONA_DIR = path.join(__dirname, 'Personas');
const PERSONA_FILES = ['stella_ramah.txt', 'stella_backup_lengkap.txt'];
const DEBUG_ENABLED = shouldLogDebug();

function debugLog(...args) {
    if (DEBUG_ENABLED) console.log('[Discord]', ...args);
}

const deepseekConfig = loadDeepSeekConfig();
const learningEngine = new LearningEngine();
const evolutionSystem = new EvolutionSystem();
const deepBrain = new DeepBrain();
const autoResearcher = new AutoResearcher(learningEngine);
const selfModifier = new SelfModifier(evolutionSystem, learningEngine);

// ── Stella v5 — Knowledge & Memory ──
const knowledgeBase = new KnowledgeBase();
const memoryCore = new MemoryCore(deepBrain);

// ── Stella v5 — Engines ──
const reasoningEngine = new ReasoningEngine(deepBrain, knowledgeBase);
const goalEngine = new GoalEngine(eventBus, EVENTS);
const curiosityEngine = new CuriosityEngine(knowledgeBase, eventBus, EVENTS);
const skillEngine = new SkillEngine(deepBrain, eventBus, EVENTS);
const experienceEngine = new ExperienceEngine(deepBrain, knowledgeBase, eventBus, EVENTS);
const planningEngine = new PlanningEngine(deepBrain, skillEngine, eventBus, EVENTS);
const reflectionEngine = new ReflectionEngine(deepBrain, experienceEngine, eventBus, EVENTS);
const workflowEngine = new WorkflowEngine(eventBus, EVENTS, skillEngine);
const scheduler = new Scheduler(eventBus, EVENTS);
const safetyLayer = new SafetyLayer(eventBus, EVENTS);

// ── Stella v5 — Executive Brain ──
const executiveBrain = new ExecutiveBrain({
    eventBus, EVENTS,
    memory: memoryCore,
    knowledge: knowledgeBase,
    reasoning: reasoningEngine,
    planning: planningEngine,
    reflection: reflectionEngine,
    goals: goalEngine,
    curiosity: curiosityEngine,
    experience: experienceEngine,
    skills: skillEngine,
    workflow: workflowEngine,
    scheduler,
    safety: safetyLayer,
    deepBrain
});

// Application Kernel (v5.1 — orchestrator layer)
const kernel = new ApplicationKernel({
    eventBus, EVENTS,
    executiveBrain,
    memory: memoryCore,
    knowledge: knowledgeBase,
    reasoning: reasoningEngine,
    planning: planningEngine,
    reflection: reflectionEngine,
    goals: goalEngine,
    curiosity: curiosityEngine,
    experience: experienceEngine,
    skills: skillEngine,
    workflow: workflowEngine,
    scheduler,
    safety: safetyLayer,
    deepBrain,
    learningEngine,
    evolutionSystem
});

const groundTruth = new GroundTruthManager();
const modelRegistry = new ModelRegistry();
const feedbackEngine = new FeedbackEngine({
    groundTruth, deepBrain
});
kernel.feedback = feedbackEngine;

let stellaTree = buildStellaTree({
    learningEngine, evolutionSystem, deepBrain, autoResearcher, selfModifier,
    MODEL_NAME: 'deepseek-chat', currentModel: 'deepseek',
    executiveBrain, eventBus, EVENTS
});

// Initialize async subsystems
Promise.all([
    knowledgeBase.initialize(),
    scheduler.buildDefaults()
]).then(() => {
    console.log('[Discord v5] All subsystems initialized.');
    knowledgeBase.embeddings.trainModel([
        'Stella is a real person, not an AI',
        'Memory systems store experiences',
        'Knowledge graphs connect concepts',
        'Machine learning improves decisions',
        'Experience engine converts tasks into skills',
        'Planning reduces risk and improves outcomes',
        'Reflection identifies patterns in success and failure'
    ]).catch(() => {});

    const seedResult = seedGroundTruth(groundTruth, feedbackEngine);
    console.log(`[Discord ML] GroundTruth seeded: ${seedResult.seeded} samples (v${seedResult.version})`);
}).catch(err => {
    console.error('[Discord v5] Init error:', err.message);
});

const deepseek = new DeepSeekProvider({ apiKey: deepseekConfig.apiKey });

const DISCORD_DATA_DIR = path.join(__dirname, 'discord_data');
if (!fs.existsSync(DISCORD_DATA_DIR)) fs.mkdirSync(DISCORD_DATA_DIR, { recursive: true });
const DB_FILE = path.join(DISCORD_DATA_DIR, 'database.json');
const MEMORY_BANK_FILE = path.join(DISCORD_DATA_DIR, 'memory_bank.json');

const historyManager = createHistoryManager(DB_FILE, MEMORY_BANK_FILE, 40);

function saveMemory() {
    historyManager.save();
}

// ── User Settings (autoRead, voiceId per user) ──
const SETTINGS_FILE = path.join(DISCORD_DATA_DIR, 'settings.json');
let guildSettings = { users: {} };
if (fs.existsSync(SETTINGS_FILE)) {
    try { guildSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')); } catch (e) {}
}
if (!guildSettings.users) guildSettings.users = {};

function saveSettings() {
    try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(guildSettings, null, 2)); } catch (e) {}
}

function getUserSetting(userId, key, defaultValue) {
    if (!guildSettings.users[userId]) guildSettings.users[userId] = {};
    if (guildSettings.users[userId][key] === undefined) return defaultValue;
    return guildSettings.users[userId][key];
}

function setUserSetting(userId, key, value) {
    if (!guildSettings.users[userId]) guildSettings.users[userId] = {};
    guildSettings.users[userId][key] = value;
    saveSettings();
}

// ── Voice Audio Player System ──
const audioPlayers = {};
const currentVoiceFiles = {};

function setupAudioPlayer(guildId, connection) {
    if (audioPlayers[guildId]) {
        try { audioPlayers[guildId].stop(); } catch (e) {}
    }
    const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Play }
    });
    connection.subscribe(player);
    audioPlayers[guildId] = player;

    player.on(AudioPlayerStatus.Playing, () => {
        debugLog('[Voice] AudioPlayer started playing');
    });
    player.on(AudioPlayerStatus.Idle, () => {
        debugLog('[Voice] AudioPlayer idle');
        // Clean up temp file after playing
        const gId = Object.keys(audioPlayers).find(k => audioPlayers[k] === player);
        if (gId) cleanupVoiceFile(gId);
    });
    player.on('error', (e) => {
        console.error('[Voice] AudioPlayer error:', e.message);
    });
    player.on('stateChange', (oldState, newState) => {
        debugLog('[Voice] Player state:', oldState.status, '->', newState.status);
    });

    return player;
}

async function speakInVoiceChannel(guildId, text, voiceId) {
    const connection = getVoiceConnection(guildId);
    if (!connection) {
        console.error('[Voice] No connection for guild', guildId);
        return;
    }

    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
    } catch (e) {
        console.error('[Voice] Connection not ready:', e.message);
        return;
    }

    if (!audioPlayers[guildId]) {
        setupAudioPlayer(guildId, connection);
    }

    const filePath = generateVoiceTempPath();
    await generateVoiceFile(text, voiceId, filePath);
    console.log(`[Voice] Playing: "${text.substring(0, 50)}..." (file: ${path.basename(filePath)}, voice: ${voiceId})`);

    currentVoiceFiles[guildId] = filePath;
    const resource = createAudioResource(filePath, { inputType: StreamType.Arbitrary });
    audioPlayers[guildId].play(resource);

    try {
        await entersState(audioPlayers[guildId], AudioPlayerStatus.Playing, 10_000);
        console.log('[Voice] Playing OK');
    } catch (e) {
        console.error('[Voice] Player did not start playing:', e.message);
        cleanupVoiceFile(guildId);
    }
}

function cleanupVoiceFile(guildId) {
    if (currentVoiceFiles[guildId]) {
        try { fs.unlinkSync(currentVoiceFiles[guildId]); } catch (e) {}
        delete currentVoiceFiles[guildId];
    }
}

const getHistory = historyManager.getHistory;
const addToHistory = historyManager.addToHistory;
const getMemoryText = historyManager.getMemoryText;

function getPersonaPrompt() {
    for (const personaFile of PERSONA_FILES) {
        const personaPath = path.join(PERSONA_DIR, personaFile);
        if (!fs.existsSync(personaPath)) continue;
        const rawPersona = fs.readFileSync(personaPath, 'utf-8').trim();
        if (!rawPersona) continue;
        return rawPersona
            .replaceAll('{JAM}', new Date().toLocaleTimeString('id-ID'))
            .replaceAll('{TANGGAL}', new Date().toLocaleDateString('id-ID'));
    }
    return 'Kamu adalah Stella, cewek asli yang cerdas, solutif, dan komunikatif. Gunakan bahasa Indonesia yang natural dan santai, panggil pengguna dengan "kamu", sebut dirimu "aku", dan selalu fokus pada penyelesaian tugas secara konkret.';
}

function getStellaInstruction(ctx) {
    const { personalityPrompt, learningContext, skillHints, researchContext, neuralPrompt } = ctx;
    const patchesPrompt = selfModifier.getActivePatchesPrompt();

    let v5Context = '';
    if (ctx.executiveContext && ctx.executiveContext.text) {
        v5Context = '\n' + ctx.executiveContext.text + '\n';
    }
    const planContext = !v5Context && ctx.planInfo ? `\nPLAN:\nGoal: ${ctx.planInfo.goal.substring(0, 100)}\nSteps: ${ctx.planInfo.subtasks.map(s => `- ${s.name} (confidence: ${(s.confidence * 100).toFixed(0)}%)`).join('\n')}\nRisk: ${JSON.stringify(ctx.planInfo.risks)}\n` : '';
    const reasoningContext = !v5Context && ctx.reasoningInfo ? `\n${ctx.reasoningInfo}\n` : '';
    const goalContext = !v5Context && ctx.goalContext ? `\n${ctx.goalContext}\n` : '';
    const toolRecContext = !v5Context && ctx.toolRecommendations && ctx.toolRecommendations.length > 0
        ? `\nRecommended tools: ${ctx.toolRecommendations.slice(0, 3).map(r => r.skill).join(', ')}\n`
        : '';
    const memoryContextText = !v5Context && ctx.memoryContext && ctx.memoryContext.length > 0
        ? `\nRelevant memories:\n${ctx.memoryContext.slice(0, 3).map(m => `- [${m.tier}] ${m.content.substring(0, 100)}`).join('\n')}\n`
        : '';

    return getPersonaPrompt() + '\n' + getPersonaPolicy() + '\n' +
        (personalityPrompt ? '\nKEPRIBADIAN EVOLUSI:\n' + personalityPrompt : '') +
        (v5Context || goalContext) + (!v5Context ? memoryContextText : '') + (!v5Context ? toolRecContext : '') +
        (!v5Context ? planContext : '') + (!v5Context ? reasoningContext : '') + '\n\n' +
        'WAKTU: ' + new Date().toLocaleTimeString('id-ID') + ' ' + new Date().toLocaleDateString('id-ID') + '\n\n' +
        'CATATAN TEKNIS:\n' +
        '- Kamu bisa pake tool: read_file, write_file, search_web, fetch_webpage, generate_image, generate_voice, send_media, download_file, screenshot_web.\n' +
        '- Kalo diminta sesuatu yg butuh tool, panggil tool-nya. Kalo cuma ngobrol, ya ngobrol aja.\n' +
        '- Simpan info pake [CATAT: KATEGORI | fakta], pasang pengingat pake [JADWAL: YYYY-MM-DD HH:mm | Pesan].\n' +
        '- Jangan pake **tebal** atau *miring*. Paling kode pake backtick doang.\n' +
        (learningContext || '') + '\n' +
        (neuralPrompt ? '\n' + neuralPrompt + '\n' : '') +
        (skillHints ? '\nPENGALAMAN:\n' + skillHints + '\n' : '') +
        (researchContext || '') + '\n' +
        (patchesPrompt || '');
}

const TOOLS_DIR = path.join(__dirname, 'tools');

function loadDynamicToolsLocal() {
    return loadDynamicTools(TOOLS_DIR);
}

async function handleToolCall(functionCall, handlers, toolContext) {
    const { name, args } = functionCall;
    debugLog('[TOOL CALLED]', name, args);
    evolutionSystem.onToolUsed(name);
    return baseHandleToolCall(functionCall, handlers, toolContext);
}

const voiceConnections = {};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.mentions.has(client.user)) return;

    const botId = client.user.id;
    let text = message.content.replace(new RegExp('<@!?' + botId + '>', 'g'), '').trim();
    if (!text) text = 'halo';

    const lowered = text.toLowerCase().trim();
    const isVoiceJoin  = lowered === '/join';
    const isVoiceLeave = lowered === '/leave' || lowered === '/keluar';

    if (isVoiceJoin) {
        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) {
            await message.channel.send('Kamu harus di voice channel dulu.');
            return;
        }
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator
        });
        voiceConnections[voiceChannel.guild.id] = connection;

        // Handle connection errors (prevent crash from DNS/network issues)
        connection.on('error', (error) => {
            console.error('[Voice] Connection error:', error.message);
        });

        // Auto-reconnect on unexpected disconnect
        connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
            if (newState.status === VoiceConnectionStatus.Disconnected) {
                console.log('[Voice] Disconnected from voice, attempting reconnect...');
                for (let i = 0; i < 3; i++) {
                    try {
                        await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
                        console.log('[Voice] Reconnected successfully');
                        return;
                    } catch (e) {
                        console.log(`[Voice] Reconnect attempt ${i + 1} failed`);
                    }
                }
                console.log('[Voice] All reconnect attempts failed, cleaning up');
                const guildId = oldState.guild.id;
                delete voiceConnections[guildId];
                delete audioPlayers[guildId];
                cleanupVoiceFile(guildId);
            }
        });

        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
        } catch (e) {
            console.error('[Voice] Join timeout:', e.message);
        }
        setupAudioPlayer(voiceChannel.guild.id, connection);
        await message.channel.send('Udah masuk voice. Kalo mau keluar, ketik `/leave`.');
        return;
    }

    if (isVoiceLeave) {
        if (!getVoiceConnection(message.guild.id)) {
            await message.channel.send('Aku gak ada di voice channel.');
            return;
        }
        const connection = getVoiceConnection(message.guild.id);
        connection.destroy();
        delete voiceConnections[message.guild.id];
        await message.channel.send('Udah keluar dari voice.');
        return;
    }

    const lowerText = text.toLowerCase();

    if (lowerText.startsWith('/help')) {
        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle('✨ Stella AI — Panduan Perintah')
            .setDescription('Semua perintah dan kemampuan Stella. Tag `@Stella` untuk ngobrol!')
            .addFields(
                {
                    name: '🔧 Commands',
                    value: [
                        '```ini',
                        '/stats              : Cek statistik, level, XP, dan model AI',
                        '/skills             : Lihat daftar skill tree',
                        '/learn              : Lihat topik favorit & pembelajaran',
                        '/patches            : Lihat patch Self-Modifier',
                        '/rules              : Lihat aturan kustom aktif',
                        '/reflect            : Jalankan self-reflection',
                        '/clear              : Reset riwayat chat',
                        '/ping               : Cek apakah Stella aktif',
                        '/model [nama]       : Ganti model AI (codex/gemini/groq)',
                        '/myperms            : Lihat izin Stella di server',
                        '/debugperms         : Debug detail permissions',
                        '/kick @user         : Tendang anggota (admin)',
                        '```'
                    ].join('\n')
                },
                {
                    name: '🔊 Voice Channel',
                    value: [
                        '```ini',
                        '@Stella join        : Ajak Stella masuk VC',
                        '@Stella leave       : Stella keluar dari VC',
                        '/say [teks]         : Stella bacain teks di voice',
                        '/autoread on/off    : Auto-read balasan di voice',
                        '/setvoice [id]      : Ganti voice TTS',
                        '```'
                    ].join('\n')
                },
                {
                    name: '🎨 Multimedia & Tools',
                    value: [
                        '```ini',
                        'generate_image      : Bikin gambar dari teks',
                        'generate_voice      : Teks jadi voice note',
                        'screenshot_web      : Screenshot halaman web',
                        'search_web          : Cari informasi di web',
                        'download_file       : Unduh file dari URL',
                        'read_file           : Baca file di server',
                        'write_file          : Tulis/edit file di server',
                        '```'
                    ].join('\n')
                },
                {
                    name: '🧠 AI & System',
                    value: [
                        '```',
                        'Provider   : DeepSeek (utama), Gemini, Groq/Llama 3.3',
                        'System     : Agentic Loop + Behavior Tree',
                        'Neural     : Deep Brain (TensorFlow.js)',
                        'Evolution  : XP/Level System',
                        'Memory     : Per-channel + Auto-Research',
                        '```'
                    ].join('\n')
                }
            )
            .setFooter({ text: '✨ Stella AI — Chat aja langsung!' })
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
        return;
    }

    if (lowerText.startsWith('/debugperms')) {
        const botMember = message.guild.members.me;
        const permsArray = botMember.permissions.toArray();
        const hasAdmin = botMember.permissions.has(PermissionsBitField.Flags.Administrator);
        console.log('=== DEBUG PERMS ===');
        console.log('Permissions array:', permsArray);
        console.log('Has Administrator:', hasAdmin);
        await message.channel.send(
            '**Debug Permissions Stella:**\n' +
            '• Has Administrator: `' + hasAdmin + '`\n' +
            '• All permissions: `' + permsArray.join(', ') + '`\n' +
            '• Role: `' + botMember.roles.highest.name + '` (posisi ' + botMember.roles.highest.position + ')\n' +
            '• Cek console untuk detail lengkap.'
        );
        return;
    }

    if (lowerText.startsWith('/myperms') || lowerText.startsWith('/permissions')) {
        const member = message.guild.members.me;
        const roles = member.roles.cache.sort((a, b) => b.position - a.position).map(r => r.name).join(', ');
        const perms = member.permissions.toArray().join(', ');
        const topRole = member.roles.highest.name;
        const topRolePos = member.roles.highest.position;
        await message.channel.send(
            '**Izin Stella di server ini:**\n' +
            '• Role tertinggi: `' + topRole + '` (posisi ' + topRolePos + ')\n' +
            '• Semua role: ' + roles + '\n' +
            '• Permissions: ' + perms
        );
        return;
    }

    if (lowerText.startsWith('/kick')) {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            await message.channel.send('Kamu gak punya izin buat kick anggota.');
            return;
        }
        const target = message.mentions.members.filter(function(m) { return m.id !== botId; }).first();
        if (!target) {
            await message.channel.send('Tag anggota yang mau di-kick.');
            return;
        }
        if (!target.kickable) {
            await message.channel.send('Aku tidak bisa kick anggota itu. Mungkin role-nya lebih tinggi.');
            return;
        }
        const reason = text.replace(/<@!?\d+>/g, '').replace('/kick', '').trim() || 'Tidak ada alasan';
        await target.kick(reason);
        await message.channel.send('**' + target.user.tag + '** berhasil dikick. Alasan: ' + reason);
        return;
    }

    // ── Voice Commands ──
    if (lowerText.startsWith('/say ')) {
        const textToSay = text.replace('/say', '').trim();
        if (!textToSay) {
            await message.channel.send('Mau ngomong apa?');
            return;
        }
        const conn = getVoiceConnection(message.guild.id);
        if (!conn) {
            await message.channel.send('Aku gak ada di voice channel.');
            return;
        }
        const voiceId = getUserSetting(message.author.id, 'voiceId', DEFAULT_VOICE);
        try {
            await message.channel.sendTyping();
            await speakInVoiceChannel(message.guild.id, textToSay, voiceId);
            await message.channel.send('Udah.');
        } catch (e) {
            await message.channel.send('Gagal bicara: ' + e.message);
        }
        return;
    }

    if (lowerText.startsWith('/autoread')) {
        const arg = text.replace('/autoread', '').trim().toLowerCase();
        if (arg === 'on') {
            setUserSetting(message.author.id, 'autoRead', true);
            await message.channel.send('Auto-read nyala! Stella bakal bacain jawaban di voice.');
        } else if (arg === 'off') {
            setUserSetting(message.author.id, 'autoRead', false);
            await message.channel.send('Auto-read mati.');
        } else {
            const status = getUserSetting(message.author.id, 'autoRead', false);
            await message.channel.send('Status auto-read kamu: **' + (status ? 'ON' : 'OFF') + '**. Pake `/autoread on` buat nyalain.');
        }
        return;
    }

    if (lowerText.startsWith('/setvoice')) {
        const voiceId = text.replace('/setvoice', '').trim();
        if (!voiceId) {
            await message.channel.send('Contoh: `/setvoice ja-JP-NanamiNeural`\n\nVoice yang tersedia:\n- `ja-JP-NanamiNeural` (cewek Jepang, anime)\n- `ja-JP-AoiNeural` (cewek Jepang, anime)\n- `ja-JP-ShioriNeural` (cewek Jepang, kalem)\n- `id-ID-GadisNeural` (cewek Indonesia, natural)');
            return;
        }
        setUserSetting(message.author.id, 'voiceId', voiceId);
        await message.channel.send('Voice TTS diubah ke **' + voiceId + '**!');
        return;
    }

    const channelId = message.channel.id;
    await message.channel.sendTyping();

    try {
        const btContext = createContext(channelId, text, {
            notifyCallback: async function(notifText) {
                await message.channel.sendTyping();
                await message.channel.send(notifText);
            }
        });

        const kernelResult = await kernel.processMessage(channelId, text, { userId: channelId });
        if (kernelResult.blocked) {
            await message.channel.send(kernelResult.reason);
            return;
        }
        btContext.kernelAnalysis = kernelResult.analysis;
        btContext.executiveContext = kernelResult.context;
        btContext.shouldReflect = kernelResult.shouldReflect;
        btContext.needsPlanning = kernelResult.needsPlanning;

        await stellaTree.tick(btContext);

        if (btContext.status === 'FAILURE') return;
        if (btContext.skipAI && btContext.directReply) {
            await message.channel.send(btContext.directReply);
            return;
        }

        const promptBudget = buildPromptBudget({
            instruction: getStellaInstruction(btContext),
            memory: getMemoryText(channelId),
            history: getHistory(channelId)
        });
        const fullInstruction = promptBudget.instruction + '\n\nINGATAN TENTANG CHANNEL INI:\n' + promptBudget.memory + (promptBudget.summary ? '\n\nRINGKASAN PERCAKAPAN LAMA:\n' + promptBudget.summary : '');
        const compactHistory = promptBudget.history;

        const { declarations, handlers } = loadDynamicToolsLocal();
        const activeDeclarations = btContext.routeDecision.includeTools ? declarations : [];

        let callCount = 0;
        let toolsUsedThisRound = [];
        let mediaToSend = [];
        let cleanText = '';

        const toolContext = { apiKey: process.env.GEMINI_API_KEY };

        const messages = [
            { role: 'system', content: fullInstruction },
            ...compactHistory.map(function(h) { return { role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text }; }),
            { role: 'user', content: text }
        ];
        const deepseekTools = toDeepSeekTools(activeDeclarations);

        let statusMsg = null;
        try {
            statusMsg = await message.channel.send('Stella mikir dulu ya...');
        } catch (e) {}

        while (callCount < 10) {
            if (statusMsg) {
                try { await statusMsg.edit('Stella mikir dulu ya...'); } catch (e) {}
            }

            const reply = await deepseek.complete({
                messages,
                tools: deepseekTools,
                model: deepseekConfig.model,
                maxTokens: btContext.routeDecision.maxOutputTokens
            });

            const calls = Array.isArray(reply.tool_calls) ? reply.tool_calls : [];

            if (calls.length === 0) {
                cleanText = reply.content || '';
                break;
            }

            messages.push({
                role: 'assistant',
                content: reply.content || '',
                tool_calls: calls
            });

            for (const call of calls) {
                let args = {};
                try { args = JSON.parse(call.function?.arguments || '{}'); } catch (e) {}

                const safeCall = { name: call.function?.name, args };
                const funcRes = await handleToolCall(safeCall, handlers, toolContext);
                toolsUsedThisRound.push(safeCall.name);
                messages.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    content: JSON.stringify(funcRes.functionResponse.response)
                });

                if (funcRes._mediaResult?.type && funcRes._mediaResult?.filePath && !funcRes._mediaResult.mediaSent) {
                    mediaToSend.push(funcRes._mediaResult);
                }
            }

            callCount++;
        }

        if (statusMsg) {
            try { await statusMsg.delete(); } catch (e) {}
        }

        for (const media of mediaToSend) {
            try {
                const filePath = media.filePath;
                const caption = media.caption || '';
                const opts = { files: [filePath] };
                if (caption) opts.content = caption;
                await message.channel.send(opts);
                debugLog('[MEDIA SENT]', media.type, filePath);
            } catch (err) {
                debugLog('[MEDIA ERROR]', err.message);
            }
        }

        let replyText = cleanText;
        const memoryRegex = /\[CATAT:\s*([^|]+)\|\s*([^\]]+)\]/g;
        const scheduleRegex = /\[JADWAL:\s*([^|]+)\|\s*([^\]]+)\]/g;
        let match;

        const bank = historyManager.getMemoryBank();
        if (!bank[channelId]) bank[channelId] = {};
        while ((match = memoryRegex.exec(replyText)) !== null) {
            const category = match[1].trim().toUpperCase();
            const fact = match[2].trim();
            if (!bank[channelId][category]) bank[channelId][category] = [];
            if (!bank[channelId][category].includes(fact)) {
                bank[channelId][category].push(fact);
            }
        }

        cleanText = replyText.replace(memoryRegex, '').replace(scheduleRegex, '').trim();
        if (!cleanText) cleanText = 'Selesai.';

        await message.channel.send(cleanText);

        // Auto-read di voice channel
        const voiceConn = getVoiceConnection(message.guild.id);
        if (voiceConn && cleanText && cleanText.length < 500 && cleanText !== 'Selesai.') {
            const autoRead = getUserSetting(message.author.id, 'autoRead', false);
            if (autoRead) {
                const voiceId = getUserSetting(message.author.id, 'voiceId', DEFAULT_VOICE);
                speakInVoiceChannel(message.guild.id, cleanText, voiceId).catch(function(e) {
                    console.error('[Voice] Auto-read error:', e.message);
                });
            }
        }

        if (toolsUsedThisRound.length > 0) {
            learningEngine.trackInteraction(channelId, text, toolsUsedThisRound);
            evolutionSystem.onTaskCompleted();
        }

        // Stella v5.1 — Kernel Outcome Recording
        const taskSuccess = !((cleanText || '').includes('gagal') || (cleanText || '').includes('error') || (cleanText || '').includes('maaf'));
        if (toolsUsedThisRound.length > 0 || cleanText) {
            kernel.recordOutcome(channelId, text || '', cleanText, taskSuccess, toolsUsedThisRound, 0).catch(() => {});
        }

        addToHistory(channelId, 'user', text);
        addToHistory(channelId, 'model', cleanText);

    } catch (error) {
        console.error('[Discord] Error:', error.message);
        try {
            await message.channel.send('Maaf, aku error. Coba lagi ya.');
        } catch (e) {}
    }
});

client.on('voiceStateUpdate', (oldState, newState) => {
    if (oldState.member.id === client.user.id && !newState.channelId) {
        const guildId = oldState.guild.id;
        delete audioPlayers[guildId];
        delete voiceConnections[guildId];
        cleanupVoiceFile(guildId);
    }
});

client.once('ready', () => {
    console.log('[Discord] Stella v5 Discord bot siap di tag @Stella di server!');
    console.log('[Discord] Level:', evolutionSystem.state.level, '| XP:', evolutionSystem.state.xp + '/' + evolutionSystem.state.xp_to_next_level);
    console.log('[v5] ExecutiveBrain | Knowledge | Reasoning | Planning | Reflection | Goal | Curiosity | Experience | Skills | Workflow | Scheduler | Safety');
    console.log('[v5.1 Kernel] NeedAnalyzer | ContextBuilder | DecisionJournal | IdleScheduler');
    console.log('[Voice] Edge-TTS ready — default voice: ' + DEFAULT_VOICE);
});

client.login(DISCORD_TOKEN);
