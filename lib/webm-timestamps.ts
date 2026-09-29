// Sửa mốc thời gian nhảy vọt trong file WebM do MediaRecorder ghi ra.
//
// Sự cố 29/9/2026: Chrome 153 trên Android (trình duyệt trong Zalo) ghi gói âm
// thanh đầu tiên ở mốc 0, nhưng gói thứ hai lại mang mốc 14 giây, 45 giây, 110
// giây… có file tới 7 tiếng. Tiếng nói bên trong vẫn liền mạch (~30 giây), nhưng
// trình phát hiện tổng thời lượng "7 tiếng", kéo tua thì lệch hết — học viên
// tưởng bản ghi hỏng.
//
// Cách sửa: đọc cấu trúc EBML, dò chỗ hai gói liên tiếp cách nhau bất thường
// rồi dời mọi mốc phía sau lùi lại cho khít. Chỉ GHI ĐÈ tại chỗ (Timecode của
// Cluster, mốc tương đối của SimpleBlock, Duration, CueTime) và giữ nguyên độ
// dài từng trường — giá trị mới luôn nhỏ hơn giá trị cũ nên luôn vừa — nhờ vậy
// không phải tính lại kích thước phần tử nào. Gặp cấu trúc lạ thì trả null để
// nơi gọi tải nguyên bản ghi gốc lên: thà thời lượng hiện sai còn hơn mất bài.

const ID_SEGMENT = 0x18538067;
const ID_INFO = 0x1549a966;
const ID_TIMECODE_SCALE = 0x2ad7b1;
const ID_DURATION = 0x4489;
const ID_CLUSTER = 0x1f43b675;
const ID_TIMECODE = 0xe7;
const ID_SIMPLE_BLOCK = 0xa3;
const ID_BLOCK_GROUP = 0xa0;
const ID_BLOCK = 0xa1;
const ID_CUES = 0x1c53bb6b;
const ID_CUE_POINT = 0xbb;
const ID_CUE_TIME = 0xb3;

// Phần tử cấp 1 (con của Segment): gặp một trong số này là Cluster "không rõ
// kích thước" (kiểu ghi trực tiếp của Chrome) đã kết thúc.
const LEVEL1_IDS = new Set([
  ID_CLUSTER,
  ID_CUES,
  ID_INFO,
  0x1654ae6b, // Tracks
  0x114d9b74, // SeekHead
  0x1254c367, // Tags
  0x1043a770, // Chapters
  0x1941a469 // Attachments
]);

// Hai gói liền nhau cách quá mức này (ms) là mốc hỏng. Gói Opus dài 20–120ms,
// kể cả khi im lặng (DTX) trình duyệt cũng không bỏ trống tới 1 giây.
export const WEBM_GAP_THRESHOLD_MS = 1000;

type Field = { offset: number; length: number };
type Block = { relField: Field; rel: number; track: number };
type Cluster = { timecodeField: Field | null; timecode: number; blocks: Block[] };

type ParsedWebm = {
  clusters: Cluster[];
  duration: (Field & { value: number }) | null;
  timecodeScale: number;
  cueTimes: Array<Field & { value: number }>;
};

class WebmParseError extends Error {}

function readVint(bytes: Uint8Array, pos: number, keepMarker: boolean) {
  if (pos >= bytes.length) {
    throw new WebmParseError("hết dữ liệu");
  }
  const first = bytes[pos];
  let length = 1;
  let mask = 0x80;
  while (length <= 8 && !(first & mask)) {
    mask >>= 1;
    length += 1;
  }
  if (length > 8 || pos + length > bytes.length) {
    throw new WebmParseError("vint hỏng");
  }
  let value = keepMarker ? first : first & (mask - 1);
  let allOnes = (first & (mask - 1)) === mask - 1;
  for (let i = 1; i < length; i += 1) {
    value = value * 256 + bytes[pos + i];
    if (bytes[pos + i] !== 0xff) {
      allOnes = false;
    }
  }
  return { value, length, unknown: !keepMarker && allOnes };
}

function readUint(bytes: Uint8Array, offset: number, length: number): number {
  let value = 0;
  for (let i = 0; i < length; i += 1) {
    value = value * 256 + bytes[offset + i];
  }
  return value;
}

function writeUint(bytes: Uint8Array, field: Field, value: number) {
  let rest = Math.max(0, Math.round(value));
  for (let i = field.length - 1; i >= 0; i -= 1) {
    bytes[field.offset + i] = rest % 256;
    rest = Math.floor(rest / 256);
  }
}

type Header = { id: number; dataStart: number; dataEnd: number; unknown: boolean };

function readHeader(bytes: Uint8Array, pos: number, parentEnd: number): Header {
  const id = readVint(bytes, pos, true);
  const size = readVint(bytes, pos + id.length, false);
  const dataStart = pos + id.length + size.length;
  const dataEnd = size.unknown ? parentEnd : dataStart + size.value;
  if (dataEnd > bytes.length) {
    throw new WebmParseError("phần tử vượt quá file");
  }
  return { id: id.value, dataStart, dataEnd, unknown: size.unknown };
}

function readBlock(bytes: Uint8Array, dataStart: number): Block {
  const track = readVint(bytes, dataStart, false);
  const relOffset = dataStart + track.length;
  const raw = (bytes[relOffset] << 8) | bytes[relOffset + 1];
  const rel = raw >= 0x8000 ? raw - 0x10000 : raw;
  return { relField: { offset: relOffset, length: 2 }, rel, track: track.value };
}

// Đọc một Cluster; trả về vị trí kết thúc thật (Cluster không rõ kích thước kết
// thúc ở phần tử cấp 1 kế tiếp).
function parseCluster(bytes: Uint8Array, header: Header, clusters: Cluster[]): number {
  const cluster: Cluster = { timecodeField: null, timecode: 0, blocks: [] };
  let pos = header.dataStart;
  while (pos < header.dataEnd) {
    const peekId = readVint(bytes, pos, true).value;
    if (header.unknown && LEVEL1_IDS.has(peekId)) {
      break;
    }
    const child = readHeader(bytes, pos, header.dataEnd);
    if (child.unknown) {
      throw new WebmParseError("phần tử con không rõ kích thước");
    }
    if (child.id === ID_TIMECODE) {
      cluster.timecodeField = { offset: child.dataStart, length: child.dataEnd - child.dataStart };
      cluster.timecode = readUint(bytes, child.dataStart, child.dataEnd - child.dataStart);
    } else if (child.id === ID_SIMPLE_BLOCK) {
      cluster.blocks.push(readBlock(bytes, child.dataStart));
    } else if (child.id === ID_BLOCK_GROUP) {
      let inner = child.dataStart;
      while (inner < child.dataEnd) {
        const grandchild = readHeader(bytes, inner, child.dataEnd);
        if (grandchild.id === ID_BLOCK) {
          cluster.blocks.push(readBlock(bytes, grandchild.dataStart));
        }
        inner = grandchild.dataEnd;
      }
    }
    pos = child.dataEnd;
  }
  clusters.push(cluster);
  return pos;
}

function parseWebm(bytes: Uint8Array): ParsedWebm {
  const parsed: ParsedWebm = { clusters: [], duration: null, timecodeScale: 1_000_000, cueTimes: [] };
  let pos = 0;
  let foundSegment = false;
  while (pos < bytes.length) {
    const top = readHeader(bytes, pos, bytes.length);
    if (top.id !== ID_SEGMENT) {
      pos = top.dataEnd;
      continue;
    }
    foundSegment = true;
    let segPos = top.dataStart;
    while (segPos < top.dataEnd) {
      const child = readHeader(bytes, segPos, top.dataEnd);
      if (child.id === ID_CLUSTER) {
        segPos = parseCluster(bytes, child, parsed.clusters);
        continue;
      }
      if (child.unknown) {
        throw new WebmParseError("phần tử cấp 1 không rõ kích thước");
      }
      if (child.id === ID_INFO) {
        let inner = child.dataStart;
        while (inner < child.dataEnd) {
          const field = readHeader(bytes, inner, child.dataEnd);
          const length = field.dataEnd - field.dataStart;
          if (field.id === ID_TIMECODE_SCALE) {
            parsed.timecodeScale = readUint(bytes, field.dataStart, length);
          } else if (field.id === ID_DURATION && (length === 4 || length === 8)) {
            const view = new DataView(bytes.buffer, bytes.byteOffset + field.dataStart, length);
            parsed.duration = {
              offset: field.dataStart,
              length,
              value: length === 4 ? view.getFloat32(0) : view.getFloat64(0)
            };
          }
          inner = field.dataEnd;
        }
      } else if (child.id === ID_CUES) {
        let inner = child.dataStart;
        while (inner < child.dataEnd) {
          const point = readHeader(bytes, inner, child.dataEnd);
          if (point.id === ID_CUE_POINT) {
            let p = point.dataStart;
            while (p < point.dataEnd) {
              const field = readHeader(bytes, p, point.dataEnd);
              if (field.id === ID_CUE_TIME) {
                const length = field.dataEnd - field.dataStart;
                parsed.cueTimes.push({
                  offset: field.dataStart,
                  length,
                  value: readUint(bytes, field.dataStart, length)
                });
              }
              p = field.dataEnd;
            }
          }
          inner = point.dataEnd;
        }
      }
      segPos = child.dataEnd;
    }
    pos = top.dataEnd;
  }
  if (!foundSegment) {
    throw new WebmParseError("không có Segment");
  }
  return parsed;
}

/**
 * Trả về bản sao đã sửa mốc thời gian, hoặc null nếu file không cần sửa / không
 * đọc được (khi đó nơi gọi dùng nguyên file gốc).
 */
export function repairWebmTimestamps(input: Uint8Array): Uint8Array | null {
  let parsed: ParsedWebm;
  try {
    parsed = parseWebm(input);
  } catch {
    return null;
  }

  const blocks = parsed.clusters.flatMap((cluster) =>
    cluster.blocks.map((block) => ({ cluster, block, time: cluster.timecode + block.rel }))
  );
  if (blocks.length < 2 || new Set(blocks.map((entry) => entry.block.track)).size !== 1) {
    return null;
  }

  // Đơn vị trong file là "tick" = timecodeScale nanogiây (mặc định 1ms).
  const msPerTick = parsed.timecodeScale / 1_000_000;
  const deltas = blocks.slice(1).map((entry, i) => entry.time - blocks[i].time);
  const normal = deltas.filter((d) => d >= 0 && d * msPerTick <= WEBM_GAP_THRESHOLD_MS).sort((a, b) => a - b);
  // Khoảng cách chuẩn giữa hai gói (thường 20 hoặc 60ms) — dùng lấp vào chỗ nhảy.
  const typical = normal.length > 0 ? normal[Math.floor(normal.length / 2)] : Math.round(20 / msPerTick);

  // shiftAfter[i] = tổng số tick phải lùi cho gói thứ i.
  const shiftAfter: number[] = [0];
  for (let i = 0; i < deltas.length; i += 1) {
    const delta = deltas[i];
    if (delta < 0) {
      return null; // mốc đi lùi: cấu trúc lạ, không đụng vào
    }
    const extra = delta * msPerTick > WEBM_GAP_THRESHOLD_MS ? delta - typical : 0;
    shiftAfter.push(shiftAfter[i] + extra);
  }
  const totalShift = shiftAfter[shiftAfter.length - 1];
  if (totalShift <= 0) {
    return null;
  }

  const output = new Uint8Array(input);

  // Lượng lùi áp cho một mốc bất kỳ (Cluster rỗng, CueTime): theo gói cuối cùng
  // có mốc <= nó.
  const shiftAtTime = (time: number): number => {
    let shift = 0;
    for (let i = 0; i < blocks.length && blocks[i].time <= time; i += 1) {
      shift = shiftAfter[i];
    }
    return shift;
  };

  let index = 0;
  for (const cluster of parsed.clusters) {
    if (cluster.blocks.length === 0) {
      if (cluster.timecodeField) {
        writeUint(output, cluster.timecodeField, cluster.timecode - shiftAtTime(cluster.timecode));
      }
      continue;
    }
    // Cluster lùi đúng bằng lượng lùi của gói ĐẦU trong nó; các gói sau trong
    // cùng Cluster lùi thêm phần chênh qua mốc tương đối (vẫn vừa int16 vì chỉ
    // giảm và không xuống dưới mốc của gói đầu).
    const clusterShift = shiftAfter[index];
    const newTimecode = cluster.timecode - clusterShift;
    if (cluster.timecodeField) {
      writeUint(output, cluster.timecodeField, newTimecode);
    } else if (clusterShift !== 0) {
      return null;
    }
    for (const block of cluster.blocks) {
      const newRel = block.rel - (shiftAfter[index] - clusterShift);
      const raw = newRel < 0 ? newRel + 0x10000 : newRel;
      output[block.relField.offset] = (raw >> 8) & 0xff;
      output[block.relField.offset + 1] = raw & 0xff;
      index += 1;
    }
  }

  for (const cue of parsed.cueTimes) {
    writeUint(output, cue, cue.value - shiftAtTime(cue.value));
  }

  if (parsed.duration) {
    const view = new DataView(output.buffer, output.byteOffset + parsed.duration.offset, parsed.duration.length);
    const value = Math.max(0, parsed.duration.value - totalShift);
    if (parsed.duration.length === 4) {
      view.setFloat32(0, value);
    } else {
      view.setFloat64(0, value);
    }
  }

  return output;
}

/**
 * Bọc cho trình duyệt: nhận bản ghi MediaRecorder, trả bản đã sửa mốc thời gian
 * (hoặc chính nó nếu không phải WebM / không cần sửa / sửa lỗi). Không bao giờ
 * ném lỗi — bước này chỉ là phụ, không được làm mất bản ghi.
 */
export async function repairRecordedBlob(blob: Blob): Promise<Blob> {
  if (!blob.type.includes("webm")) {
    return blob;
  }
  try {
    const fixed = repairWebmTimestamps(new Uint8Array(await blob.arrayBuffer()));
    return fixed ? new Blob([new Uint8Array(fixed)], { type: blob.type }) : blob;
  } catch {
    return blob;
  }
}
