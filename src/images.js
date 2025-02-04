export default async function (prompt) {
  const ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.3`;

  function getApiKey() {
    let randstr = Math.round(Math.random() * 1e11) + "";

    let hashfunct = function () {
      for (var a = [], b = 0; b < 64;)
        a[b] = 0 | 4294967296 * Math.sin(++b % Math.PI);
      return function (c) {
        var d, e, f, g = [d = 1732584193, e = 4023233417, ~d, ~e], h = [], l = unescape(encodeURI(c)) + "\u0080", k = l.length;
        c = --k / 4 + 2 | 15;
        for (h[--c] = 8 * k; ~k;)
          h[k >> 2] |= l.charCodeAt(k) << 8 * k--;
        for (b = l = 0; b < c; b += 16) {
          for (k = g; l < 64; k = [f = k[3], d + ((f = k[0] + [d & e | ~d & f, f & d | ~f & e, d ^ e ^ f, e ^ (d | ~f)][k = l >> 4] + a[l] + ~~h[b | [l, 5 * l + 1, 3 * l + 5, 7 * l][k] & 15]) << (k = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21][4 * k + l++ % 4]) | f >>> -k), d, e])
            d = k[1] | 0, e = k[2];
          for (l = 4; l;)
            g[--l] += k[l]
        }
        for (c = "", l = 0; l < 32;)
          c += (g[l >> 3] >> 4 * (1 ^ l++) & 15).toString(16);
        return c.split("").reverse().join("")
      }
    }();

    // what a weird string name lmao
    return 'tryit-' + randstr + '-' + hashfunct(ua + hashfunct(ua + hashfunct(ua + randstr + 'suditya_is_a_smelly_hacker')));
  }

  const res = await (await fetch("https://api.deepai.org/api/text2img", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": getApiKey(),
      "Host": "api.deepai.org",
      "User-Agent": ua,
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Content-Length": Math.floor(Math.random() * 1000),
      "Origin": "https://deepai.org",
      "DNT": "1",
      "Sec-GPC": "1",
      "Connection": "keep-alive",
      "Cookie": "user_sees_ads=false",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
      "Priority": "u=0",
      "TE": "trailers"
    },
    body: JSON.stringify({
      text: prompt,
      turbo: "true",
      image_generator_version: "hd",
      use_old_model: "false",
      genius_preference: "classic"
    }),
  })).json();

  return res.output_url || res.share_url;
}