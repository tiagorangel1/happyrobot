import { socksDispatcher } from "fetch-socks";

// prevents the ip from showing up when we hit a ratelimit.

// make sure a cloudflare warp proxy is running.
// i found https://blog.caomingjun.com/run-cloudflare-warp-in-docker/en/
// with WARP_SLEEP=6 to be pretty good.
const dispatcher = socksDispatcher({
  type: 5,
  host: "::1",
  port: 1080,
});

export default async function genImage(prompt) {
  const width = 1024;
  const height = 1024;
  const encodedPrompt = encodeURIComponent(prompt.trim());

  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&model=flux&seed=${new Date().getTime()}`;

  const response = await fetch(url, {
    method: "GET",
    dispatcher
  });

  const arrayBuffer = await response.arrayBuffer();

  const buffer = Buffer.from(arrayBuffer);

  return buffer;
}
