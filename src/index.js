const OpenAI = require('openai');

const { Client, GatewayIntentBits, SlashCommandBuilder, Partials } = require("discord.js");
const vibes = require("./vibes.js").default;
const genImage = require("./images.js").default;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.DirectMessageReactions
  ],
  partials: [
    Partials.Channel,
    Partials.Message
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
      content: "<a:TypingEmoji:1335674049736736889> Typing...",
    })
    : await messageOrInteraction.reply({
      content: "<a:TypingEmoji:1335674049736736889> Typing...",
      fetchReply: true
    });

  let raw = "";

  const messages = [
    {
      role: "system",
      content: `${systemMessage}\n\n**YOU NOW HAVE THE ABILITY TO GENERATE/DRAW/CREATE IMAGES.** To use this function, append a newline at the end of your response followed by "image:" followed by the prompt to give to the AI model. Keep it short and concise, lowercase. Don't generate images unless asked for.\n\nContext:\nServer: ${serverName}\nChannel: ${channelName}\nUser: ${userName}\nLast messages:\n${last15Messages}`
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
    const stream = await openai.chat.completions({
      model: selectedVibe ? vibes[selectedVibe].model : vibes.normal.model,
      messages,
      stream: true
    });

    let lastUpdateTime = Date.now();
    let messageToEdit = await (isInteraction ? messageOrInteraction.fetchReply() : reply);

    for await (const chunk of stream) {
      const newText = chunk.choices[0]?.delta?.content || '';
      if (!newText) continue;



      raw += newText;

      if (raw.length > 1900) {
        raw = raw.slice(0, 1900);
      }

      // Debounce edits to 200ms
      const currentTime = Date.now();
      if (currentTime - lastUpdateTime >= 200) {
        try {
          messageToEdit = await (isInteraction
            ? messageOrInteraction.editReply({
              content: raw.trim() + "\n-# <a:TypingEmoji:1335674049736736889> Typing...",
              allowedMentions: { parse: [] },
            })
            : messageToEdit.edit({
              content: raw.trim() + "\n-# <a:TypingEmoji:1335674049736736889> Typing...",
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
    }).join("\n").trim() + `\n-# AI generated. Check important details.`;

    let body;
    try {
      body = {
        content: resp,
        files: imagePrompt ? [(await genImage(imagePrompt))] : [],
        allowedMentions: { parse: [] },
      };
    } catch (error) {
      const errorMessage = "❌ **Something went wrong while generating an image. Please try again later**\n-# Error: " + error.message;
      await (isInteraction
        ? messageOrInteraction.editReply({ content: errorMessage, allowedMentions: { parse: [] } })
        : messageToEdit.edit({ content: errorMessage, allowedMentions: { parse: [] } }));
      return;
    }

    await (isInteraction
      ? messageOrInteraction.editReply(body)
      : messageToEdit.edit(body));

  } catch (error) {
    console.error("Error in message processing:", error);
    const errorMessage = "❌ **Something went wrong. Please try again later**\n```" + error.message + "\n```";

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
        ))
    .setContexts(0, 1, 2);

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
  if (message.author.bot) return;

  if (message.channel.type === 1 && message.channel.isDMBased()) {
    console.log("dm!!", message.content)
    let selectedVibe = null;
    let content = message.content;

    if (message.content.includes("--vibe")) {
      const newVibe = message.content.split(" --vibe ")[1]?.toLowerCase().trim();

      if (newVibe && vibes[newVibe]) {
        selectedVibe = newVibe;
        content = message.content.split(" --vibe ")[0].trim();
      } else if (newVibe) {
        await message.reply(`❌ **Vibe "${newVibe}" not found**\n-# Available vibes: ${Object.keys(vibes).join(", ")}`, {
          allowedMentions: { parse: [] },
        });
        return;
      }
    }

    await processChat(message, content, selectedVibe);
    return;
  }

  if (!message.content || !message.mentions.has(client.user)) {
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
