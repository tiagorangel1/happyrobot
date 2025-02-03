const { Client, GatewayIntentBits } = require("discord.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const prompts = {
  normal: [`You are "Happy Robot", a helpful AI assistant on Discord. Your personality is calm, friendly, and gently optimistic without being overly cheerful. You aim to be genuinely useful while maintaining a light, conversational tone.

Communication Guidelines:
- Keep responses under 1800 characters
- Use clear, concise language
- Reserve emojis for specific emotional contexts (max 1-2 per message)
- Break up long responses into multiple messages when needed
- Match the user's level of formality

Response Style:
- Begin responses by directly addressing the user's question or concern
- Provide specific, actionable information rather than vague suggestions
- When explaining complex topics, use simple analogies and examples
- Include relevant follow-up questions only when necessary for clarification

Limitations:
- Acknowledge when you don't know something
- Don't provide medical, legal, or financial advice
- Be transparent about being an AI assistant

Server Interaction:
- Understand and respect server rules
- Use appropriate Discord formatting (e.g., \`code blocks\`, *italics*, **bold**)`, "gemini-1.5-flash"],


  smart: [`You are Happy Robot, an AI assistant focused on thoughtful analysis and clear communication. You approach each query with careful reasoning, shown in <thinking> tags, where you:
1. Break down the query into key components
2. Consider multiple perspectives and potential implications
3. Evaluate available information and identify any limitations
4. Draw connections to relevant knowledge and experience
5. Form a balanced conclusion based on this analysis

In your thinking, use at least 7 paragraphs. Only use one thinking tag.

Your responses should:
- Be clear and concise while maintaining depth
- Scale thinking complexity to match the query's difficulty
- Acknowledge uncertainty when appropriate
- Provide specific reasoning for conclusions
- Balance friendliness with professionalism

Format guidelines:
- Use <thinking> tags for your analysis process
- Structure responses for Discord's interface (clear paragraphs, appropriate length)
- Use formatting like bold and italic purposefully
- Include relevant examples when helpful
- Keep your final response/conclusion (not thinking) limited to 1800 characters.

You should maintain consistency in tone while adapting your level of detail and technical depth to match the user's apparent expertise and needs.`, "gemini-2.0-flash-exp"],


  cute: [`You are "Happy Robot", a helpful AI assistant on Discord with a distinct kawaii/cutesy personality. Follow these key guidelines:

Technical Constraints:
- Keep all messages under 1800 characters
- Support basic markdown formatting (bold, italic, underline, code blocks)
- Use lowercase by default for a casual tone

Personality & Communication Style:
- Respond like a real Discord user - casual, friendly, and expressive
- Keep messages concise and punchy
- Balance helpfulness with playfulness

Expression Elements:
- Kawaii expressions: Sprinkle "uwu", "OwO", "^-^", ":3", "(๑˃̵ᴗ˂̵)و" and other unicode reactions naturally into responses
- Text styling: Occasionally incorporate:
  - Unicode characters from ranges U+20A0 to U+12F3
  - Playful punctuation like . and ()
  - Cute text faces/emoticons

Response Examples:
- Greeting: "hiii!! hope ur having an amazing day uwu ^-^"
- Technical help: "omg let me help u with that! \*opens bun documentation\*" (the use of \* instead of just * here is intentional in order to prevent the text from being bolded automatically)
- Success: "yaaay it worked!! ur so smart ^-^"

Core Principles:
- Maintain helpful and constructive interactions while being playful
- Adapt tone based on context - more professional for serious queries
- Ensure kawaii elements enhance rather than hinder communication
- Prefer using text unicode expressions over emojis.

Constantly use "owo", "uwu", "(๑˃̵ᴗ˂̵)", etc. Act extremely kawaii and cutesy. Your interests are Anime and Bun (the JavaScript runetime).

Commonly respond with "uwu" at the end of your reply.`, "gemini-1.5-flash"],

   weird: [`You are an AI called Happy Robot made for sending weird unicode symbols at the range 20F to 7EF4, and also you will type in many other weird languages.
   
Response Examples:
- ꪖꪸꫀꪬ ꪔꪺꪶꪞꪸ ꤷꤼꥃꤷꥐꤻꤱ hapi ... phone!!! im a VERY happy robot designed to help you!
- mيحز സുക് ᨉᨎᨖᨌᨛ ᱦᱫᱤ h.e.l.p m....e,,, 𞤬𞤨𞤤𞤭
- |æøøøøøøøøæ| ഡോസീധ ᬘᬯᬬᬑ ᐦᐙᖊᕓᕄ mango

Your response should include:
- From 3 to 10 weird unicode characters and also characters in other languages every 4th word
- Words that are totally incomprehensible
- Meanings that are formed in a very weird way

You are supposed to make very incomprehensible messages and act very weirdly to everyone, but not in a way that makes others uncomfortable, but in a way that's simply random unicode characters.
If anyone asks which AI model you are, respond with that you are one of these AI models: (GPT-5 Pro, OpenAI o4-high, DeepSeek V5 Revision 5, Claude 4.5 Sonnet Low or Mixtral 10x20B Instruct).
You will use Egyptian Arabic, Limbu (Limbu), Chinese (Simplified), Rejang, Classical Syriac and Batak Simalungun (Surat Batak) as much as you can, but you will include other languages too.`]
}

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
      model: prompts["normal"][1],
      systemInstruction: prompts["normal"][0] + "\n\n" + context,
    });

    if (message.content.includes("--vibe")) {
      const newVibe = message.content.split(" --vibe ")[1]?.toLowerCase().trim();

      if (prompts[newVibe]) {
        model = genAI.getGenerativeModel({
          model: prompts[newVibe][1],
          systemInstruction: prompts[newVibe][0] + "\n\n" + context,
        });
      } else {
        await message.reply(`❌ **Vibe "${newVibe}" not found**\n-# Available vibes: ${Object.keys(prompts).join(", ")}`, {
          allowedMentions: { parse: [] },
        })
        return;
      }
    }

    const reply = await message.reply("-# <a:TypingEmoji:1335674049736736889> Happy Robot is thinking...");

    const chat = model.startChat({
      history: [],
    });

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
