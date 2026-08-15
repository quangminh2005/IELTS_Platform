import { describe, expect, it } from "vitest";
import { cleanExamText, extractCandidates } from "../lib/vocab-extract";

const run = (text: string) =>
  extractCandidates({ text, skill: "reading", unitId: "unit-1" });

describe("cleanExamText", () => {
  it("bỏ dòng fence ::: và ô trống [[n]]", () => {
    const raw = ":::box\nA cat\n:::\nThe [[3]] policy was approved.";
    expect(cleanExamText(raw)).toBe("A cat\nThe  policy was approved.");
  });
});

describe("extractCandidates", () => {
  it("giữ từ học thuật và kèm câu chứa nó", () => {
    const result = run(
      "The government approved a new policy last year. Everyone was happy about it."
    );
    const policy = result.find((item) => item.word === "policy");
    expect(policy).toBeDefined();
    expect(policy?.sentence).toBe(
      "The government approved a new policy last year."
    );
    expect(policy?.unitId).toBe("unit-1");
    expect(policy?.skill).toBe("reading");
  });

  it("loại từ thường ngày không thuộc danh sách học thuật", () => {
    const words = run("The water was very cold and the people were tired.").map(
      (item) => item.word
    );
    expect(words).not.toContain("water");
    expect(words).not.toContain("people");
  });

  it("loại tên riêng: từ chỉ xuất hiện dạng viết hoa giữa câu", () => {
    // "Major" ở đây là tên người, luôn viết hoa giữa câu.
    const words = run(
      "We met Major yesterday. Later that evening Major left the building."
    ).map((item) => item.word);
    expect(words).not.toContain("major");
  });

  it("giữ từ viết hoa đầu câu nếu chỗ khác có dạng chữ thường", () => {
    const words = run(
      "Policy matters a lot here. The new policy takes effect soon."
    ).map((item) => item.word);
    expect(words).toContain("policy");
  });

  it("mỗi từ chỉ trả về một lần, lấy câu xuất hiện đầu tiên", () => {
    // Cả hai câu đều phải dài hơn 30 ký tự, nếu không câu đầu bị bỏ qua và test
    // đo nhầm câu thứ hai.
    const result = run(
      "The research team was extremely slow last winter. " +
        "Another research group joined the project later on."
    );
    const hits = result.filter((item) => item.word === "research");
    expect(hits).toHaveLength(1);
    expect(hits[0].sentence).toBe(
      "The research team was extremely slow last winter."
    );
  });

  it("gom các từ cùng họ về một mục, giữ dạng ngắn nhất", () => {
    const result = run(
      "Modern computers changed the workplace forever. " +
        "Every computer in the office was replaced last month."
    );
    const words = result.map((item) => item.word);
    expect(words).toContain("computer");
    expect(words).not.toContain("computers");
  });

  it("câu ví dụ luôn chứa đúng dạng từ được giữ lại", () => {
    const result = run(
      "Modern computers changed the workplace forever. " +
        "Every computer in the office was replaced last month."
    );
    for (const item of result) {
      expect(item.sentence.toLowerCase()).toContain(item.word);
    }
  });

  it("bỏ lời dẫn đề trong transcript, không lấy làm câu ví dụ", () => {
    const result = run(
      "Section 3 Narrator: Now turn to section 3 of the listening paper. " +
        "The regional policy was finally approved by the committee."
    );
    // "section" chỉ xuất hiện trong lời dẫn nên không được nhận
    expect(result.map((item) => item.word)).not.toContain("section");
    // câu nội dung thật thì vẫn nhận bình thường
    expect(result.map((item) => item.word)).toContain("policy");
  });

  it("bỏ mẩu hội thoại có nhãn người nói ở đầu câu", () => {
    expect(
      run("Dave: What, the constraints on the learning chapter we discussed?")
    ).toHaveLength(0);
  });

  it.each([
    "• Tutor: The program is designed to deliver advanced theory to everyone.",
    "Miss Harris: Then pursue that idea until it is completely finished.",
    "• Speaker 2 (Woman): Following is a brief summary of the regional tours."
  ])("bỏ nhãn người nói có dấu đầu dòng hoặc tên nhiều chữ: %s", (line) => {
    expect(run(line)).toHaveLength(0);
  });

  it("không nhầm câu thường thành nhãn người nói", () => {
    const words = run(
      "The research team published a detailed summary of the regional policy."
    ).map((item) => item.word);
    expect(words).toContain("summary");
  });

  it("loại hẳn các từ máy bắt nhầm họ", () => {
    const words = run(
      "Jacinta said that was just why she rang the office again this morning."
    ).map((item) => item.word);
    expect(words).not.toContain("rang");
  });

  it("bỏ câu ví dụ quá ngắn hoặc quá dài", () => {
    expect(run("Policy.")).toHaveLength(0);
  });

  it("văn bản rỗng trả về mảng rỗng", () => {
    expect(run("")).toEqual([]);
  });
});
