// The link card: what a chat or a feed shows when someone shares the site -
// the mark, the line and the name, at 1200 x 630.
//
// Writes two copies of one layout:
//   public/og.jpg - what og:image points at. Facebook, LinkedIn, WhatsApp and X
//                   do not read SVG, and every word is drawn from Montserrat's
//                   own outlines, so it looks the same whatever renders it.
//   public/og.svg - the same card with live text, for editing by hand.
//
//   npm run og:card
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const W = 1200;
const H = 630;

const face = (weight) => {
  const file = readFileSync(join(root, "node_modules/@fontsource/montserrat/files", `montserrat-latin-${weight}-normal.woff`));
  return opentype.parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
};
const fonts = { 400: face(400), 700: face(700) };

const INK = "#FFF5F6";
const ROSE = "#FEB3B8";
const DOT = "#F3A7AE";

// The line, as the site sets it: light, light, then the word that lands - and its dot.
const X = 316;
const SIZE = 68;
const LEAD = 74;
const FIRST = 238;
const LINES = [
  { text: "Better health", weight: 400 },
  { text: "for more lives", weight: 400 },
  { text: "everyday", weight: 700, dot: true },
];
const NAME = { text: "YOOJ — AT HEART OF YOU", size: 26, track: 6, y: FIRST + LEAD * 2 + 60 };

// The mark stands as tall as the line: from the first cap to the last baseline.
const capTop = FIRST - SIZE * 0.7;
const MARK_UNITS = 2792;
const markScale = (FIRST + LEAD * 2 - capTop) / MARK_UNITS;

const MARK = `<path d="M1346.25 14.4414C1363.65 8.2837 1384.89 8.27162 1404.89 10.0684L1406.82 10.248L1406.85 10.251L1406.89 10.2549C1520.1 22.0201 1613.7 63.3213 1679.27 127.198C1744.41 190.654 1781.38 275.929 1782.62 375.15L1782.64 377.497L1782.75 391.975C1783.86 541.588 1786.48 691.518 1784.36 841.53C1784.04 865.015 1789.75 876.814 1798.79 883.446C1808.63 890.67 1824.73 893.664 1849.75 893.499C2023.42 892.339 2197.06 892.339 2370.67 893.499H2370.67C2474.98 894.044 2559.21 913.417 2627.03 954.647C2694.87 995.889 2745.42 1058.48 2783.31 1143.94C2785.6 1148.29 2787.59 1152.77 2789.27 1157.36L2789.82 1158.85L2789.82 1160.44C2790.11 1310.83 2790.77 1470.07 2790.77 1621.24V1622.3L2790.53 1623.33C2781.32 1662.05 2763.99 1698.89 2739.47 1732.01C2659.5 1841.42 2545.62 1903.76 2394.36 1904.77L2394.36 1904.77C2216.82 1906.01 2039.03 1904.77 1861.64 1905.43H1861.6C1842.02 1905.43 1827.74 1905.63 1817.08 1906.87C1806.33 1908.12 1800.81 1910.29 1797.6 1913.02C1794.65 1915.53 1792.36 1919.61 1790.98 1928.17C1789.57 1936.89 1789.33 1948.69 1789.3 1965.33V2413.67C1789.3 2524.77 1745.63 2619.19 1670 2685.75C1594.45 2752.24 1487.57 2790.46 1361.73 2790.55H1361.72C1232.03 2790.55 1100.83 2792.96 970.993 2782.23V2782.24C775.534 2766.6 633.399 2627.94 629.082 2452.91V2452.9C625.368 2301.65 626.131 2150.36 628.319 1999.14V1999.13C628.683 1976.59 624.847 1960.93 615.835 1948.42C606.686 1935.71 591.329 1925.01 566.017 1914.33L566.007 1914.33C511.251 1891.16 453.197 1854.04 420.9 1808.53V1808.53C292.363 1627.71 172.196 1441.82 50.876 1257.37V1257.36C-2.52893 1176.38 -1.3977 1087.34 34.9814 1013.51C71.2582 939.88 142.527 881.371 229.517 860.29C243.278 856.945 262.688 855.914 279.358 857.098C287.727 857.692 295.836 858.872 302.466 860.787C305.775 861.743 309.002 862.963 311.795 864.561C314.49 866.103 317.517 868.415 319.399 871.897H319.398C324.524 881.294 327.295 890.55 327.28 899.557C327.265 908.689 324.382 916.986 319.142 924.269C308.955 938.425 290.194 948.358 266.991 955.404L266.98 955.407C198.165 976.212 153.398 1016.18 134.553 1063.49C115.895 1110.32 121.992 1165.97 157.914 1220.33L158.769 1221.62V1221.62C264.904 1380.15 370.427 1539.02 475.336 1698.24L496.31 1730.08L496.314 1730.09C544.604 1803.63 614.997 1840.5 685.134 1841.2C755.253 1841.91 826.233 1806.47 875.761 1733.06L886.704 1716.83C999.734 1549.12 1111.16 1380.64 1220.97 1211.37L1220.98 1211.37L1220.98 1211.36C1254.72 1159.56 1257.65 1103.82 1236.14 1056.77C1214.74 1009.96 1168.66 970.777 1102.26 952.934L1100.69 952.516C1076.73 946.226 1059.44 937.203 1050.31 923.481C1040.81 909.22 1041.65 892.366 1047.95 874.519C1051.78 863.641 1057.55 855.797 1065.24 850.943C1072.87 846.131 1081.34 844.927 1089.34 845.303C1097.26 845.674 1105.32 847.624 1112.62 849.705C1119.95 851.791 1125.87 853.789 1131.86 855.362L1133.06 855.672L1133.07 855.673C1230.16 880.203 1303.05 940.159 1339.23 1013.98C1375.47 1087.93 1374.62 1175.39 1324.82 1253.61L1324.82 1253.61C1203.39 1444.21 1078.02 1633.28 946.159 1818.64L946.154 1818.65C929.783 1841.61 905.935 1860.82 879.957 1877.5C853.941 1894.19 825.175 1908.73 798.641 1922.03L798.632 1922.04L798.624 1922.04C781.97 1930.35 770.255 1937.2 762.555 1945.56C755.343 1953.39 751.224 1963.06 751.304 1978.33L751.407 1992.35C752.328 2134.88 749.418 2277.12 752.659 2419.46L752.823 2426.46V2426.46C756.111 2565.4 865.24 2666.32 1030.66 2674.92H1030.67C1154.47 2681.11 1278.57 2681.55 1402.43 2676.25L1402.44 2676.24H1402.45C1551.19 2670.14 1657.91 2559.66 1659.56 2416.55C1661.28 2262.05 1659.56 2107.59 1659.56 1952.81C1659.56 1896.57 1671.65 1855.23 1702.36 1828.41C1732.73 1801.88 1779.3 1791.41 1843.53 1791.45C2017.17 1791.45 2190.72 1791.95 2364.21 1791.45L2366.45 1791.44C2461.4 1790.69 2536.52 1765.34 2588.01 1720.58C2639.74 1675.61 2668.61 1610.2 2669.12 1527.59V1527.55C2669.97 1444.06 2666.94 1358.97 2670.27 1274.82V1274.82C2673.73 1189.36 2641.68 1122.02 2586.52 1075.68C2531.14 1029.16 2451.79 1003.28 2360.18 1002.59H2360.17C2182.65 1001.18 2005.4 1002.59 1827.52 1002.01V1002.01C1770.69 1002.01 1728.4 994.044 1699.91 972.051C1670.87 949.632 1658.14 914.291 1656.34 864.851L1656.05 857.123C1650.22 694.823 1652.58 532.031 1650.43 370.144L1650.41 368.556C1649.11 301.429 1623.48 244.123 1579.35 201.678C1534.8 158.832 1470.95 130.705 1393.16 123.486V123.487C1373.28 121.687 1351.21 119.02 1334.88 110.487C1326.47 106.095 1319.1 99.9156 1314.41 91.1094C1309.7 82.2772 1308.18 71.7091 1309.88 59.418C1311.48 47.5837 1315.71 37.8953 1322.24 30.2812C1328.74 22.7019 1337.11 17.6761 1346.25 14.4414Z" fill="${INK}" />
    <circle cx="343.199" cy="858.008" r="144.506" fill="${INK}" />
    <circle cx="1029.6" cy="858.008" r="144.506" fill="${INK}" />`;

// The ground: deep wine with the rose light low on the right, clear of the words.
const ground = `<defs>
    <radialGradient id="g" cx="0.9" cy="0.62" r="0.85">
      <stop offset="0" stop-color="#F3A7AE"/>
      <stop offset="0.34" stop-color="#9C334F"/>
      <stop offset="1" stop-color="#3C010E"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <g transform="translate(92 ${(capTop - 8 * markScale).toFixed(2)}) scale(${markScale.toFixed(5)})" opacity="0.96">
    ${MARK}
  </g>`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/—/g, "&#8212;");

/* ------------------------------------------------------------ live text */

const liveLines = LINES.map((l, i) => {
  const dot = l.dot ? `<tspan fill="${DOT}">.</tspan>` : "";
  return `<tspan x="${X}" y="${FIRST + LEAD * i}" font-weight="${l.weight}">${esc(l.text)}${dot}</tspan>`;
}).join("\n    ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  ${ground}
  <text fill="${INK}" font-family="Montserrat, Inter, sans-serif" font-size="${SIZE}">
    ${liveLines}
  </text>
  <text x="${X}" y="${NAME.y}" fill="${ROSE}" font-family="Montserrat, Inter, sans-serif" font-size="${NAME.size}" letter-spacing="${NAME.track}">${esc(NAME.text)}</text>
</svg>
`;

/* ------------------------------------------------------------- outlines */

const outlined = [];
LINES.forEach((l, i) => {
  const font = fonts[l.weight];
  const y = FIRST + LEAD * i;
  outlined.push(`<path d="${font.getPath(l.text, X, y, SIZE).toPathData(2)}" fill="${INK}"/>`);
  if (l.dot) {
    const after = X + font.getAdvanceWidth(l.text, SIZE);
    outlined.push(`<path d="${font.getPath(".", after, y, SIZE).toPathData(2)}" fill="${DOT}"/>`);
  }
});
{
  // Tracked capitals, set a glyph at a time.
  const font = fonts[400];
  let x = X;
  for (const ch of NAME.text) {
    outlined.push(`<path d="${font.getPath(ch, x, NAME.y, NAME.size).toPathData(2)}" fill="${ROSE}"/>`);
    x += font.getAdvanceWidth(ch, NAME.size) + NAME.track;
  }
}

const drawn = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${ground}
  ${outlined.join("\n  ")}
</svg>`;

writeFileSync(join(root, "public/og.svg"), svg);
const info = await sharp(Buffer.from(drawn))
  .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" })
  .toFile(join(root, "public/og.jpg"));
console.log(`public/og.jpg ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)} KB; public/og.svg rewritten`);
