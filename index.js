const { Client, GatewayIntentBits } = require("discord.js");
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

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!\nInvite link: ${inviteLink}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (!message.content) return;
    if (
      !message.mentions.has(client.user) ||
      message.author.bot ||
      !message.content
    ) {
      return;
    }

    const messages = await message.channel.messages.fetch({ limit: 15 });
    const last15Messages = Array.from(messages.values())
      .reverse()
      .map((msg) => `${msg.author.tag}: ${msg.content}`)
      .join("\n");

    const serverName = message.guild ? message.guild.name : "DM";
    const channelName = message.channel.name || "DM";
    const userName = message.author.tag;

    const repliedTo = message.reference ?
      (await message.channel.messages.fetch(message.reference.messageId))
        .content : null;

    const context = `
    Server Name: ${serverName}
    Channel Name: ${channelName}
    User Name: ${userName}
    ${repliedTo ? `Replying to: ${repliedTo}\n` : ''}
    Last 15 Messages:
    ${last15Messages}
  `;


    let model = genAI.getGenerativeModel({
      model: vibes.normal.model,
      systemInstruction: vibes.normal.prompt + "\n\n" + context,
    });

    if (message.content.includes("--vibe")) {
      const newVibe = message.content.split(" --vibe ")[1]?.toLowerCase().trim();

      console.log("vibe", newVibe, vibes[newVibe])

      if (newVibe && vibes[newVibe]) {
        model = genAI.getGenerativeModel({
          model: vibes[newVibe]?.model,
          systemInstruction: vibes[newVibe]?.prompt + "\n\n" + context,
        });
      } else if (newVibe) {
        await message.reply(`❌ **Vibe "${newVibe}" not found**\n-# Available vibes: ${Object.keys(vibes).join(", ")}`, {
          allowedMentions: { parse: [] },
        })
        return;
      }
    }

    const reply = await message.reply("-# <a:TypingEmoji:1335674049736736889> Happy Robot is thinking...");

    const chat = model.startChat({});

    let raw = "";
    const query = message.content.replaceAll(`<@${client.user.id}>`, "");

    const parts = [];

    if (message.attachments.size > 0) {
      for (const [_, attachment] of message.attachments) {
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

    parts.push(query);

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

    try {
      await reply.edit({
        content: "❌ **Something went wrong. Please try again later**",
        allowedMentions: { parse: [] },
      });
    } catch { }
  }
});

client.login(process.env.BOT_TOKEN);
