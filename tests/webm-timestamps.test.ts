import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { repairWebmTimestamps } from "@/lib/webm-timestamps";

// Dựng file WebM tối giản bằng tay: đủ các phần tử mà hàm sửa đọc/ghi.
function el(id: number[], payload: number[], unknownSize = false): number[] {
  if (unknownSize) {
    return [...id, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, ...payload];
  }
  const size = payload.length;
  const sizeBytes = [0x01, 0, 0, 0, (size >>> 24) & 0xff, (size >>> 16) & 0xff, (size >>> 8) & 0xff, size & 0xff];
  return [...id, ...sizeBytes, ...payload];
}

function uint(value: number, length: number): number[] {
  const out: number[] = [];
  for (let i = length - 1; i >= 0; i -= 1) {
    out.push(Math.floor(value / 256 ** i) % 256);
  }
  return out;
}

function float64(value: number): number[] {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  return Array.from(new Uint8Array(view.buffer));
}

const EBML_HEADER = el([0x1a, 0x45, 0xdf, 0xa3], el([0x42, 0x82], [0x77, 0x65, 0x62, 0x6d]));
const simpleBlock = (rel: number) => el([0xa3], [0x81, ...uint(rel < 0 ? rel + 0x10000 : rel, 2), 0x80, 0xaa, 0xbb]);
const timecode = (value: number, length: number) => el([0xe7], uint(value, length));
const cluster = (children: number[][], unknownSize = false) =>
  el([0x1f, 0x43, 0xb6, 0x75], children.flat(), unknownSize);
const info = (duration: number) =>
  el([0x15, 0x49, 0xa9, 0x66], [...el([0x2a, 0xd7, 0xb1], uint(1_000_000, 3)), ...el([0x44, 0x89], float64(duration))]);
const cues = (times: Array<[number, number]>) =>
  el(
    [0x1c, 0x53, 0xbb, 0x6b],
    times.flatMap(([time, length]) => el([0xbb], el([0xb3], uint(time, length))))
  );
const segment = (children: number[][]) => el([0x18, 0x53, 0x80, 0x67], children.flat());

// Đọc lại mọi mốc tuyệt đối của gói (ms) từ file đã dựng — đủ cho các ca test.
function blockTimes(bytes: Uint8Array): number[] {
  const times: number[] = [];
  let clusterTc = 0;
  for (let i = 0; i < bytes.length - 4; i += 1) {
    if (bytes[i] === 0xe7 && bytes[i + 1] === 0x01) {
      const len = bytes[i + 8];
      clusterTc = Number(Array.from(bytes.slice(i + 9, i + 9 + len)).reduce((a, b) => a * 256 + b, 0));
      i += 8 + len;
    } else if (bytes[i] === 0xa3 && bytes[i + 1] === 0x01 && bytes[i + 9] === 0x81) {
      const raw = (bytes[i + 10] << 8) | bytes[i + 11];
      times.push(clusterTc + (raw >= 0x8000 ? raw - 0x10000 : raw));
      i += 8;
    }
  }
  return times;
}

function durationOf(bytes: Uint8Array): number {
  for (let i = 0; i < bytes.length - 18; i += 1) {
    if (bytes[i] === 0x44 && bytes[i + 1] === 0x89) {
      return new DataView(bytes.buffer, bytes.byteOffset + i + 10, 8).getFloat64(0);
    }
  }
  return Number.NaN;
}

describe("repairWebmTimestamps", () => {
  it("sửa ca Zalo 29/9: gói đầu ở mốc 0, Cluster sau nhảy lên 7 tiếng", () => {
    const file = new Uint8Array([
      ...EBML_HEADER,
      ...segment([
        info(25_596_743),
        cluster([timecode(0, 1), simpleBlock(0)]),
        cluster([timecode(25_596_623, 4), simpleBlock(0), simpleBlock(60), simpleBlock(120)]),
        cues([[0, 1], [25_596_623, 4]])
      ])
    ]);

    const fixed = repairWebmTimestamps(file);

    expect(fixed).not.toBeNull();
    expect(blockTimes(fixed!)).toEqual([0, 60, 120, 180]);
    expect(durationOf(fixed!)).toBe(180);
    // Chỉ ghi đè tại chỗ, không đổi kích thước file.
    expect(fixed!.length).toBe(file.length);
    // Bản gốc không bị đụng vào (nơi gọi còn dùng khi cần).
    expect(blockTimes(file)).toEqual([0, 25_596_623, 25_596_683, 25_596_743]);
  });

  it("sửa chỗ nhảy nằm trong cùng một Cluster (mốc tương đối của SimpleBlock)", () => {
    const file = new Uint8Array([
      ...EBML_HEADER,
      ...segment([
        cluster([timecode(0, 1), simpleBlock(0), simpleBlock(14_353), simpleBlock(14_413), simpleBlock(14_473)]),
        cluster([timecode(14_533, 2), simpleBlock(0), simpleBlock(60)])
      ])
    ]);

    const fixed = repairWebmTimestamps(file);

    expect(blockTimes(fixed!)).toEqual([0, 60, 120, 180, 240, 300]);
  });

  it("đọc được Cluster không rõ kích thước (kiểu Chrome ghi trực tiếp)", () => {
    const file = new Uint8Array([
      ...EBML_HEADER,
      ...segment([
        cluster([timecode(0, 1), simpleBlock(0)], true),
        cluster([timecode(110_821, 3), simpleBlock(0), simpleBlock(60)], true)
      ])
    ]);

    expect(blockTimes(repairWebmTimestamps(file)!)).toEqual([0, 60, 120]);
  });

  it("file lành thì không sửa gì", () => {
    const file = new Uint8Array([
      ...EBML_HEADER,
      ...segment([cluster([timecode(0, 1), simpleBlock(0), simpleBlock(60), simpleBlock(120)])])
    ]);

    expect(repairWebmTimestamps(file)).toBeNull();
  });

  it("sửa xong chạy lại lần nữa thì không đổi gì thêm", () => {
    const file = new Uint8Array([
      ...EBML_HEADER,
      ...segment([cluster([timecode(0, 1), simpleBlock(0)]), cluster([timecode(45_280, 2), simpleBlock(0)])])
    ]);

    expect(repairWebmTimestamps(repairWebmTimestamps(file)!)).toBeNull();
  });

  it("dữ liệu không phải WebM thì trả null, không ném lỗi", () => {
    expect(repairWebmTimestamps(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
    expect(repairWebmTimestamps(new Uint8Array(0))).toBeNull();
    // File bị cắt cụt giữa chừng.
    const file = new Uint8Array([...EBML_HEADER, ...segment([cluster([timecode(0, 1), simpleBlock(0)])])]);
    expect(repairWebmTimestamps(file.slice(0, file.length - 4))).toBeNull();
  });
});

describe("ô ghi âm sửa mốc thời gian trước khi tải lên", () => {
  const recorder = readFileSync(join(process.cwd(), "components", "audio-recorder-answer.tsx"), "utf8");

  it("bản ghi trực tiếp đi qua repairRecordedBlob rồi mới upload", () => {
    expect(recorder).toMatch(/repairRecordedBlob\(blob\)[\s\S]{0,120}uploadRecording\(body, type, "recorded"\)/);
  });
});
