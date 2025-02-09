const ddg = require("duck-duck-scrape");
const { z } = require("zod");
const { streamText, tool } = require("ai");
const { Client, GatewayIntentBits, SlashCommandBuilder, Partials, DefaultWebSocketManagerOptions, ActivityType } = require("discord.js");
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

const inviteLink = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}`;

async function processChat(messageOrInteraction, content, selectedVibe = null) {
  const isInteraction = messageOrInteraction.isChatInputCommand?.();

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

  const reply = isInteraction
    ? await messageOrInteraction.editReply({
      content: "<a:TypingEmoji:1335674049736736889> Typing...",
    })
    : await messageOrInteraction.reply({
      content: "<a:TypingEmoji:1335674049736736889> Typing...",
      fetchReply: true
    });

  const messages = [
    {
      role: "user", content: [
        { type: 'text', text: content },
      ]
    }
  ];

  if (messageOrInteraction.attachments?.size > 0) {
    for (const [_, attachment] of messageOrInteraction.attachments) {
      try {
        messages[0].content.push({
          type: "image",
          image: attachment.url
        });
      } catch (error) {
        console.error("Error processing image:", error);
      }
    }
  }

  let messageToEdit = await (isInteraction ? messageOrInteraction.fetchReply() : reply);

  try {
    const { textStream } = await streamText({
      system: `${vibes[selectedVibe || "normal"].prompt}\n\n**YOU NOW HAVE THE ABILITY TO GENERATE/DRAW/CREATE IMAGES.** To use this function, append a newline at the end of your response followed by "image:" followed by the prompt to give to the AI model. Keep it short and concise, lowercase. Don't generate images unless asked for.\n\nContext:\nServer: ${serverName}\nChannel: ${channelName}\nUser: ${userName}\nLast messages:\n${last15Messages}`,
      model: vibes[selectedVibe || "normal"].model,
      messages,
      maxSteps: 15,
      tools: {
        search: tool({
          description: 'Search something on the web',
          parameters: z.object({
            query: z.string().describe('The query to search for'),
          }),
          execute: async ({ query }) => ({
            query,
            results: await ddg.search(query, {
              safeSearch: ddg.SafeSearchType.STRICT
            })
          }),
        }),
      }
    });

    let lastUpdateTime = Date.now();
    let raw = "";

    for await (let newText of textStream) {
      raw += newText;

      if (raw.length > 1900) {
        raw = raw.slice(0, 1900);
      }

      const currentTime = Date.now();
      if (currentTime - lastUpdateTime >= 100) {
        try {
          (isInteraction
            ? messageOrInteraction.editReply({
              content: raw.trim() + "\n-# <a:TypingEmoji:1335674049736736889> Typing...",
              allowedMentions: { parse: [] },
            })
            : messageToEdit.edit({
              content: raw.trim() + "\n-# <a:TypingEmoji:1335674049736736889> Typing...",
              allowedMentions: { parse: [] },
            })).then((e) => {
              messageToEdit = e;
            })
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

      (isInteraction
        ? messageOrInteraction.editReply({ content: errorMessage, allowedMentions: { parse: [] } })
        : messageToEdit.edit({ content: errorMessage, allowedMentions: { parse: [] } }));
      return;
    }

    (isInteraction
      ? messageOrInteraction.editReply(body)
      : messageToEdit.edit(body));

  } catch (error) {
    console.error("Error in message processing:", error);
    const errorMessage = "❌ **Something went wrong. Please try again later**\n```" + error.message + "\n```";

    (isInteraction
      ? messageOrInteraction.editReply({ content: errorMessage, allowedMentions: { parse: [] } })
      : messageToEdit.edit({ content: errorMessage, allowedMentions: { parse: [] } }));
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!\nInvite link: ${inviteLink}`);

  client.user.setPresence({
    status: 'online',
    activities: [{
      name: 'my notifications',
      type: ActivityType.Watching,
      url: 'https://github.com/tiagorangel1/happyrobot'
    }]
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
    .addAttachmentOption(option =>
      option
        .setName('image')
        .setDescription('An image to analyze'))
    .setContexts(0, 1, 2);

  await client.application.commands.set([chatCommand]);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'chat') {
    try {
      await interaction.deferReply();

      const message = interaction.options.getString('message');
      const vibe = interaction.options.getString('vibe');
      const image = interaction.options.getAttachment('image');

      if (image) {
        interaction.attachments = new Map([[image.id, image]]);
      }

      await processChat(interaction, message, vibe);
    } catch (error) {
      console.error('Interaction error:', error);
      try {
        if (interaction.deferred) {
          await interaction.editReply({ content: '❌ An error occurred. Please try again.' });
        } else {
          await interaction.reply({ content: '❌ An error occurred. Please try again.', ephemeral: true });
        }
      } catch (e) {
        console.error('Error handling error:', e);
      }
    }
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.channel.type === 1 && message.channel.isDMBased()) {
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
  let selectedVibe = "normal";

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

DefaultWebSocketManagerOptions.identifyProperties.browser = 'Discord iOS';

client.login(process.env.BOT_TOKEN);