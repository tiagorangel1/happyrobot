export default async function genImage(prompt) {
  const width = 1024;
  const height = 1024;
  const encodedPrompt = encodeURIComponent(prompt.trim());

  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&model=flux&seed=${new Date().getTime()}`;

  const response = await fetch(url, {
    method: "GET",
  });

  const arrayBuffer = await response.arrayBuffer();

  const buffer = Buffer.from(arrayBuffer);

  return buffer;
}
