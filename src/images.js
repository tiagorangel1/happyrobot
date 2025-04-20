export default async function genImage(prompt) {
  const width = 512;
  const height = 768;
  const encodedPrompt = encodeURIComponent(prompt.trim());

  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&model=flux&seed=${new Date().getTime()}`;

  const response = await fetch(url, {
    method: "GET",
  });

  const arrayBuffer = await response.arrayBuffer();

  const buffer = Buffer.from(arrayBuffer);

  return buffer;
}
