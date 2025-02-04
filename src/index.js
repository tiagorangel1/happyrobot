const OpenAI = require('openai');

const { Client, GatewayIntentBits, SlashCommandBuilder } = require("discord.js");
const vibes = require("./vibes.js").default;
const genImage = require("./images.js").default;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

const inviteLink = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}`;

async function processChat(messageOrInteraction, content, selectedVibe = null) {
  const isInteraction = messageOrInteraction.isChatInputCommand?.();

  if (isInteraction) {
    await messageOrInteraction.deferReply();
  }

  let last15Messages = "";

  try {
    if (messageOrInteraction.channel) {
      const messages = await messageOrInteraction.channel.messages.fetch({ limit: 15 });
      last15Messages = Array.from(messages.values())
        .reverse()
        .map((msg) => `${msg.author.tag}: ${msg.content}`)
        .join("\n");
    }
  } catch (error) {
    last15Messages = "Unable to fetch message history";
  }

  const serverName = messageOrInteraction.guild ? messageOrInteraction.guild.name : "DM";
  const channelName = messageOrInteraction.channel?.name || "DM";
  const userName = isInteraction ? messageOrInteraction.user.tag : messageOrInteraction.author.tag;

  const systemMessage = selectedVibe ? vibes[selectedVibe].prompt : vibes.normal.prompt;

  const reply = isInteraction
    ? await messageOrInteraction.editReply({
      content: "<a:TypingEmoji:1335674049736736889> Thinking...",
    })
    : await messageOrInteraction.reply({
      content: "<a:TypingEmoji:1335674049736736889> Thinking...",
      fetchReply: true
    });

  let raw = "";

  const messages = [
    {
      role: "system",
      content: `${systemMessage}\n\nYou have the ability to generate images if needed. To use this function, append a newline at the end of your response followed by "image:prompt", where "prompt" is the prompt to give to the AI model — keep it short and concise, lowercase.\n\nContext:\nServer: ${serverName}\nChannel: ${channelName}\nUser: ${userName}\nLast messages:\n${last15Messages}`
    },
    { role: "user", content }
  ];

  if (messageOrInteraction.attachments?.size > 0) {
    const imageContents = [];
    for (const [_, attachment] of messageOrInteraction.attachments) {
      try {
        const imageResponse = await fetch(attachment.url);
        const imageBuffer = await imageResponse.arrayBuffer();
        imageContents.push({
          type: "image_url",
          image_url: {
            url: `data:${attachment.contentType};base64,${Buffer.from(imageBuffer).toString('base64')}`
          }
        });
      } catch (error) {
        console.error("Error processing image:", error);
      }
    }
    if (imageContents.length > 0) {
      messages[1].content = [
        ...imageContents,
        { type: "text", text: content }
      ];
    }
  }

  try {
    const stream = await openai.chat.completions.create({
      model: selectedVibe ? vibes[selectedVibe].model : vibes.normal.model,
      messages,
      stream: true,
    });

    let lastUpdateTime = Date.now();
    let messageToEdit = await (isInteraction ? messageOrInteraction.fetchReply() : reply);

    for await (const chunk of stream) {
      const newText = chunk.choices[0]?.delta?.content || '';
      if (!newText) continue;

      raw += newText;
      raw = raw.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<thinking>[\s\S]*?<\/thinking>/g, '');

      if (raw.length > 1800) {
        raw = raw.slice(0, 1800);
      }

      const currentTime = Date.now();
      if (currentTime - lastUpdateTime >= 500) {
        try {
          messageToEdit = await (isInteraction
            ? messageOrInteraction.editReply({
              content: raw.trim() + "\n-# <a:TypingEmoji:1335674049736736889> Thinking...",
              allowedMentions: { parse: [] },
            })
            : messageToEdit.edit({
              content: raw.trim() + "\n-# <a:TypingEmoji:1335674049736736889> Thinking...",
              allowedMentions: { parse: [] },
            }));
          lastUpdateTime = currentTime;
        } catch { }
      }
    }

    const imagePrompt = raw.split("\n").find(line => {
      return line.startsWith("image:");
    })?.replace("image:", "")?.trim();

    const resp = raw.split("\n").filter((line) => {
      return !line.startsWith("image:")
    }).join("\n").trim() + `\n-# AI generated. Happy Robot can make mistakes. ${imagePrompt ? "Image AI generated" : ""}`;

    const body = {
      content: resp,
      files: imagePrompt ? [(await genImage(imagePrompt))] : [],
      allowedMentions: { parse: [] },
    };

    await (isInteraction
      ? messageOrInteraction.editReply(body)
      : messageToEdit.edit(body));

  } catch (error) {
    console.error("Error in message processing:", error);
    const errorMessage = "❌ **Something went wrong. Please try again later**\n-# Error: " + error.message;

    await (isInteraction
      ? messageOrInteraction.editReply({ content: errorMessage, allowedMentions: { parse: [] } })
      : messageToEdit.edit({ content: errorMessage, allowedMentions: { parse: [] } }));
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!\nInvite link: ${inviteLink}`);

  client.user.setPresence({
    status: 'online',
    activity: {
      name: 'Listening to pings',
      type: 'PLAYING',
      url: 'https://github.com/tiagorangel1/happyrobot'
    },
    mobile: true
  });

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
