// Danh sách từ học thuật (Academic Word List) dùng làm tầng lọc chính khi rút từ
// từ đề Listening/Reading. Đang có Sublist 1-10 (đủ AWL, trừ vài từ ngắn/từ nối
// dễ bắt nhầm theo tiền tố: fee→feel, mode→model, via, plus, aid, odd, tape,
// sole→solemn, grade→gradual, route→routine, found, file, bond, chart, team,
// và các trạng từ nối furthermore/nevertheless/nonetheless/notwithstanding/
// albeit/likewise/thereby/whereby/somewhat/so-called). Muốn mở rộng chỉ cần thêm
// chuỗi vào mảng dưới đây, không phải sửa code cũng không phải sửa test.
export const AWL_HEADWORDS: readonly string[] = [
  // Sublist 1
  "analyse", "approach", "area", "assess", "assume", "authority", "available",
  "benefit", "concept", "consist", "constitute", "context", "contract", "create",
  "data", "define", "derive", "distribute", "economy", "environment", "establish",
  "estimate", "evident", "export", "factor", "finance", "formula", "function",
  "identify", "income", "indicate", "individual", "interpret", "involve", "issue",
  "labour", "legal", "legislate", "major", "method", "occur", "percent", "period",
  "policy", "principle", "proceed", "process", "require", "research", "respond",
  "role", "section", "sector", "significant", "similar", "source", "specific",
  "structure", "theory", "vary",
  // Sublist 2
  "achieve", "acquire", "administrate", "affect", "appropriate", "aspect",
  "assist", "category", "chapter", "commission", "community", "complex",
  "compute", "conclude", "conduct", "consequent", "construct", "consume",
  "credit", "culture", "design", "distinct", "element", "equate", "evaluate",
  "feature", "final", "focus", "impact", "injure", "institute", "invest", "item",
  "journal", "maintain", "normal", "obtain", "participate", "perceive",
  "positive", "potential", "previous", "primary", "purchase", "range", "region",
  "regulate", "relevant", "reside", "resource", "restrict", "secure", "seek",
  "select", "site", "strategy", "survey", "text", "tradition", "transfer",
  // Sublist 3
  "alternative", "circumstance", "comment", "compensate", "component", "consent",
  "considerable", "constant", "constrain", "contribute", "convene", "coordinate",
  "core", "corporate", "correspond", "criteria", "deduce", "demonstrate",
  "document", "dominate", "emphasis", "ensure", "exclude", "framework", "fund",
  "illustrate", "immigrate", "imply", "initial", "instance", "interact",
  "justify", "layer", "link", "locate", "maximise", "minor", "negate", "outcome",
  "partner", "philosophy", "physical", "proportion", "publish", "react",
  "register", "rely", "remove", "scheme", "sequence", "shift", "specify",
  "sufficient", "task", "technical", "technique", "technology", "valid",
  "volume",
  // Sublist 4
  "access", "adequate", "annual", "apparent", "approximate", "attitude",
  "attribute", "civil", "code", "commit", "communicate", "concentrate", "confer",
  "contrast", "cycle", "debate", "despite", "dimension", "domestic", "emerge",
  "error", "ethnic", "goal", "grant", "hence", "hypothesis", "implement",
  "implicate", "impose", "integrate", "internal", "investigate", "label",
  "mechanism", "obvious", "occupy", "option", "output", "overall", "parallel",
  "parameter", "phase", "predict", "principal", "prior", "professional",
  "project", "promote", "regime", "resolve", "retain", "series", "statistic",
  "status", "stress", "subsequent", "summary", "undertake",
  // Sublist 5
  "academy", "adjust", "alter", "amend", "aware", "capacity", "challenge",
  "clause", "compound", "conflict", "consult", "contact", "decline", "discrete",
  "draft", "enable", "energy", "enforce", "entity", "equivalent", "evolve",
  "expand", "expose", "external", "facilitate", "fundamental", "generate",
  "generation", "image", "liberal", "licence", "logic", "margin", "medical",
  "mental", "modify", "monitor", "network", "notion", "objective", "orient",
  "perspective", "precise", "prime", "psychology", "pursue", "ratio", "reject",
  "revenue", "stable", "style", "substitute", "sustain", "symbol", "target",
  "transit", "trend", "version", "welfare",
  // Sublist 6
  "abstract", "accurate", "acknowledge", "aggregate", "allocate", "assign",
  "attach", "author", "brief", "capable", "cite", "cooperate", "discriminate",
  "display", "diverse", "domain", "edit", "enhance", "estate", "exceed",
  "expert", "explicit", "federal", "flexible", "gender", "ignorant", "incentive",
  "incidence", "incorporate", "index", "inhibit", "initiate", "input",
  "instruct", "intelligent", "interval", "lecture", "migrate", "minimum",
  "ministry", "motive", "neutral", "overseas", "precede", "presume", "rational",
  "recover", "reveal", "scope", "subsidy", "trace", "transform", "transport",
  "underlie", "utilise",
  // Sublist 7
  "adapt", "adult", "advocate", "channel", "chemical", "classic",
  "comprehensive", "comprise", "confirm", "contrary", "convert", "couple",
  "decade", "definite", "deny", "differentiate", "dispose", "dynamic",
  "eliminate", "empirical", "equip", "extract", "finite", "foundation", "globe",
  "guarantee", "hierarchy", "identical", "ideology", "infer", "innovate",
  "insert", "intervene", "isolate", "media", "paradigm", "phenomenon",
  "priority", "prohibit", "publication", "quote", "release", "reverse",
  "simulate", "submit", "successor", "survive", "thesis", "topic", "transmit",
  "ultimate", "unique", "visible", "voluntary",
  // Sublist 8
  "abandon", "accompany", "accumulate", "ambiguous", "append", "appreciate",
  "arbitrary", "automate", "bias", "clarify", "commodity", "complement",
  "conform", "contemporary", "contradict", "crucial", "currency", "denote",
  "detect", "deviate", "displace", "drama", "eventual", "exhibit", "exploit",
  "fluctuate", "guideline", "highlight", "implicit", "induce", "inevitable",
  "infrastructure", "inspect", "intense", "manipulate", "minimise", "nuclear",
  "offset", "paragraph", "practitioner", "predominant", "prospect", "radical",
  "random", "reinforce", "restore", "revise", "schedule", "tense", "terminate",
  "theme", "uniform", "vehicle", "virtual", "visual", "widespread",
  // Sublist 9
  "accommodate", "analogy", "anticipate", "assure", "attain", "behalf", "bulk",
  "cease", "coherent", "coincide", "commence", "compatible", "concurrent",
  "confine", "controversy", "converse", "device", "devote", "diminish",
  "distort", "duration", "erode", "ethic", "format", "inherent", "insight",
  "integral", "intermediate", "manual", "mature", "mediate", "medium",
  "military", "minimal", "mutual", "norm", "overlap", "passive", "portion",
  "preliminary", "protocol", "qualitative", "refine", "relax", "restrain",
  "revolution", "rigid", "scenario", "sphere", "subordinate", "supplement",
  "suspend", "temporary", "trigger", "unify", "violate", "vision",
  // Sublist 10
  "adjacent", "assemble", "collapse", "colleague", "compile", "conceive",
  "convince", "depress", "encounter", "enormous", "forthcoming", "incline",
  "integrity", "intrinsic", "invoke", "levy", "ongoing", "panel", "persist",
  "pose", "reluctance", "straightforward", "undergo"
];

// Từ mà quy tắc so khớp theo tiền tố gốc bắt nhầm: mặt chữ trùng gốc của một
// headword nhưng nghĩa hoàn toàn khác họ. Loại hẳn để mỗi lần quét lại không
// phải nhặt ra bằng tay nữa.
export const FALSE_MATCHES: ReadonlySet<string> = new Set([
  "rang", // quá khứ của "ring", không thuộc họ "range"
  "equator", // từ địa lý, không thuộc họ "equate"
  "tens", // số đếm, không thuộc họ "tense"
  "them", // đại từ, không thuộc họ "theme"
  "divers", // thợ lặn, không thuộc họ "diverse"
  "inferior", // "kém hơn", không thuộc họ "infer"
  "appendix" // phụ lục / ruột thừa, không thuộc họ "append"
]);

// Gốc từ dùng để so khớp cả họ từ.
// - Bỏ "e" cuối để "create" bắt được "creating", "creation"...
// - Bỏ "t" cuối ở đuôi -ant/-ent để "significant" bắt được "significance".
// - Từ ngắn (<= 4 chữ) giữ nguyên, nếu không "role" sẽ thành "rol" và ăn nhầm
//   sang "rolling".
export function academicRoot(headword: string): string {
  const lower = headword.toLowerCase();

  if (lower.length > 4 && lower.endsWith("e")) {
    return lower.slice(0, -1);
  }

  if (lower.length > 5 && (lower.endsWith("ant") || lower.endsWith("ent"))) {
    return lower.slice(0, -1);
  }

  return lower;
}

const ROOTS = AWL_HEADWORDS.map(academicRoot);

// Đuôi dài quá 5 chữ gần như chắc chắn là từ khác, không phải biến thể.
const MAX_SUFFIX_LENGTH = 5;

// Trả về gốc từ khớp được, hoặc null nếu từ không thuộc danh sách học thuật.
// Gốc này còn dùng để gom "computer"/"computers", "final"/"finally"... về cùng
// một mục — nếu không kho từ sẽ đầy các cặp gần trùng.
export function matchAcademicRoot(word: string): string | null {
  const lower = word.toLowerCase();

  if (FALSE_MATCHES.has(lower)) {
    return null;
  }

  // Gốc dài hơn thì cụ thể hơn: "constitut" phải thắng "consist" nếu cả hai cùng
  // khớp, nếu không các từ khác họ sẽ bị gom nhầm vào nhau.
  let best: string | null = null;

  for (const root of ROOTS) {
    if (lower.startsWith(root) && lower.length - root.length <= MAX_SUFFIX_LENGTH) {
      if (best === null || root.length > best.length) {
        best = root;
      }
    }
  }

  return best;
}

export function isAcademicWord(word: string): boolean {
  return matchAcademicRoot(word) !== null;
}
