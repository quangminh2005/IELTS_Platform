// Tải component hero-geometric từ registry của componentry.dev, rút lấy hai đoạn
// shader rồi vá màu loang thành uniform. Chạy lại khi muốn đối chiếu với bản gốc:
//   node scripts/fetch-login-shader.mjs
import { writeFileSync } from "node:fs";

const REGISTRY_URL = "https://componentry.dev/r/hero-geometric.json";
const OUT_PATH = "components/ui/login-shader-source.ts";

const response = await fetch(REGISTRY_URL);

if (!response.ok) {
  throw new Error(`Không tải được registry: HTTP ${response.status}`);
}

const registry = await response.json();
const file = registry.files?.[0]?.content;

if (typeof file !== "string") {
  throw new Error("Registry không có files[0].content — cấu trúc đã đổi");
}

function grab(name) {
  const match = file.match(new RegExp("const " + name + " = `([\\s\\S]*?)`;"));

  if (!match) {
    throw new Error(`Không tìm thấy ${name} trong mã gốc`);
  }

  const body = match[1];

  // Nội dung sẽ được nhúng lại vào template literal, không được chứa ` hay ${
  if (body.includes("`") || body.includes("${")) {
    throw new Error(`${name} chứa ký tự phá template literal`);
  }

  return body;
}

const vertexShader = grab("vertexShader");
let fragmentShader = grab("fragmentShader");

const HARDCODED_FADE = "mix(vec3(1.0), color, fadeMask)";

if (!fragmentShader.includes(HARDCODED_FADE)) {
  throw new Error("Bản gốc đã đổi cách loang màu — phải soát lại bằng tay");
}

fragmentShader = fragmentShader
  .replace("uniform vec3 uColor2;", "uniform vec3 uColor2;\nuniform vec3 uFadeColor;")
  .replace(HARDCODED_FADE, "mix(uFadeColor, color, fadeMask)");

if (!fragmentShader.includes("uniform vec3 uFadeColor;")) {
  throw new Error("Không chèn được uniform uFadeColor");
}

const header = `// Sinh tự động bởi scripts/fetch-login-shader.mjs — đừng sửa tay.
// Nguồn: ${REGISTRY_URL} (component hero-geometric của componentry.dev).
// Sửa duy nhất so với bản gốc: màu loang góc dưới trái đổi từ vec3(1.0) viết cứng
// thành uniform uFadeColor, để ăn theo nền của theme đang bật.
`;

writeFileSync(
  OUT_PATH,
  `${header}
export const vertexShader = \`${vertexShader}\`;

export const fragmentShader = \`${fragmentShader}\`;
`,
  "utf8"
);

console.log(`Đã ghi ${OUT_PATH}`);
