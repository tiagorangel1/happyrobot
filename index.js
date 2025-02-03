const { Client, GatewayIntentBits, SlashCommandBuilder } = require("discord.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const vibes = require("./config/vibes.js").default;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
});

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const inviteLink = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=274877974528&scope=bot`;

async function processChat(messageOrInteraction, content, selectedVibe = null) {
  const isInteraction = messageOrInteraction.isChatInputCommand?.();
  
  if (isInteraction) {
    await messageOrInteraction.deferReply();
  }

  const messages = await messageOrInteraction.channel.messages.fetch({ limit: 15 });
  const last15Messages = Array.from(messages.values())
    .reverse()
    .map((msg) => `${msg.author.tag}: ${msg.content}`)
    .join("\n");

  const serverName = messageOrInteraction.guild ? messageOrInteraction.guild.name : "DM";
  const channelName = messageOrInteraction.channel.name || "DM";
  const userName = isInteraction ? messageOrInteraction.user.tag : messageOrInteraction.author.tag;

  const context = `
    Server Name: ${serverName}
    Channel Name: ${channelName}
    User Name: ${userName}
    Last 15 Messages:
    ${last15Messages}
  `;

  let model = genAI.getGenerativeModel({
    model: selectedVibe ? vibes[selectedVibe].model : vibes.normal.model,
    systemInstruction: (selectedVibe ? vibes[selectedVibe].prompt : vibes.normal.prompt) + "\n\n" + context,
  });

  const reply = isInteraction 
    ? await messageOrInteraction.editReply({
        content: "-# <a:TypingEmoji:1335674049736736889> Happy Robot is thinking...",
      })
    : await messageOrInteraction.reply("-# <a:TypingEmoji:1335674049736736889> Happy Robot is thinking...");

  const chat = model.startChat({});
  let raw = "";
  const parts = [];

  if (messageOrInteraction.attachments?.size > 0) {
    for (const [_, attachment] of messageOrInteraction.attachments) {
      try {
        const imageResponse = await fetch(attachment.url);
        const imageBuffer = await imageResponse.arrayBuffer();
        parts.push({
          inlineData: {
            data: Buffer.from(imageBuffer).toString("base64"),
            mimeType: attachment.contentType || "image/jpeg",
          },
        });
      } catch (error) {
        console.error("Error processing image:", error);
      }
    }
  }

  parts.push(content);

  try {
    const result = await chat.sendMessageStream(parts);

    for await (const chunk of result.stream) {
      raw += chunk.text().replace(`-# AI generated. Happy Robot can make mistakes.`, '');
      raw = raw.replace(/<think>[\s\S]*?<\/think>/g, '');
      if (raw.length > 1800) {
        raw = raw.slice(0, 1800);
      }
      await reply.edit({
        content: raw.trim() + "\n-# <a:TypingEmoji:1335674049736736889> Happy Robot is thinking...",
        allowedMentions: { parse: [] },
      });
    }

    await reply.edit({
      content: raw.trim() + "\n-# AI generated. Happy Robot can make mistakes.",
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.error(error);
    await reply.edit({
      content: "❌ **Something went wrong. Please try again later**",
      allowedMentions: { parse: [] },
    });
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!\nInvite link: ${inviteLink}`);
  
  // Register the chat command
  const chatCommand = new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Chat with Happy Robot')
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('The message to send to the bot')
        .setRequired(true))
    .addStringOption(option =>
      option
        .setName('vibe')
        .setDescription('Set a specific vibe for the response')
        .addChoices(
          ...Object.keys(vibes).map(vibe => ({ name: vibe, value: vibe }))
        ));

  await client.application.commands.set([chatCommand]);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'chat') {
    const message = interaction.options.getString('message');
    const vibe = interaction.options.getString('vibe');
    
    await processChat(interaction, message, vibe);
  }
});

client.on("messageCreate", async (message) => {
  if (!message.content || !message.mentions.has(client.user) || message.author.bot) {
    return;
  }

  const content = message.content.replaceAll(`<@${client.user.id}>`, "");
  let selectedVibe = null;

  if (message.content.includes("--vibe")) {
    const newVibe = message.content.split(" --vibe ")[1]?.toLowerCase().trim();
    
    if (newVibe && vibes[newVibe]) {
      selectedVibe = newVibe;
    } else if (newVibe) {
      await message.reply(`❌ **Vibe "${newVibe}" not found**\n-# Available vibes: ${Object.keys(vibes).join(", ")}`, {
        allowedMentions: { parse: [] },
      });
      return;
    }
  }

  await processChat(message, content, selectedVibe);
});

client.login(process.env.BOT_TOKEN);
