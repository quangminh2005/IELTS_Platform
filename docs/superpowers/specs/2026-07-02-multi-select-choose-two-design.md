# Choose TWO (multi-select) — thiết kế

Ngày: 2026-07-02 · Hướng đã duyệt: **A** (tự nhận diện nhóm, không đổi schema/định dạng import, bài đã giao tự chạy đúng).

## Vấn đề
Các câu "Choose TWO letters, A–E" (vd Câu 17–18, 19–20 của Listening) hiện được lưu thành **2 câu `multiple_choice` riêng**, mỗi câu render một thẻ radio → học sinh chỉ chọn được 1 đáp án mỗi thẻ, có thể chọn trùng chữ ở cả hai thẻ. Cần: một khối cho phép tick đúng N đáp án trong cùng một câu.

## Ràng buộc phải giữ
Toàn app đánh số theo từng câu (thanh điều hướng 11–20, đếm "20/40", "Phần x/10", band 40 câu). Vì thế **giữ nguyên N dòng câu hỏi** trong DB; chỉ đổi cách *render* + cách *chấm*. Không migration, không đổi định dạng import.

## Nhận diện nhóm — `lib/multi-select.ts`
`detectMultiSelectGroups(questions)` (thuần, có unit test). Xét các câu **liên tiếp theo order trong cùng một phần**. Một dãy là "nhóm chọn N" khi:
- Độ dài dãy ≥ 2.
- Mọi câu `questionType === "multiple_choice"`.
- Mọi câu cùng **bộ options y hệt** (cùng số lượng, cùng thứ tự giá trị).
- Tập đáp án đúng (dạng set) của mỗi câu **bằng nhau** = `S`.
- `|S| === độ dài dãy` (số đáp án đúng = số câu trong dãy) — đặc điểm riêng của cách làm "choose N".
- `S ⊆ options`.

Trả về `Array<{ questionIds: string[]; selectCount: number }>` với `selectCount = questionIds.length`.
Dùng chung cho: (a) trang làm bài (server tính rồi truyền xuống client), (b) chấm bài.

## Render khi làm bài — `MultiSelectQuestionSet` (attempt-workspace)
- Server (`app/student/assignments/[recipientId]/page.tsx`) gọi helper, truyền prop `multiSelectGroups` xuống `AttemptWorkspace` (chỉ gồm id + selectCount, **không lộ đáp án**).
- Trong pipeline gom câu, nếu gặp câu mở đầu một nhóm → phát item `multiselect`, nuốt N câu, **ưu tiên trước** nhánh grid/single. Các câu thành viên không render lại ở nhánh khác.
- Widget: hiện options A–E dạng **checkbox**, nhãn "Chọn N đáp án". Tick tối đa N; đủ N thì các ô còn lại khoá (muốn đổi thì bỏ tick). Reuse `groupBox` cho khung "Choose TWO letters…".
- Lưu đáp án: N chữ đã chọn gán vào N ô (slot) theo thứ tự → mỗi slot ghi vào `answers[questionId]` (qua `onAnswerChange`) và một `<input type="hidden" name="q_<id>">` để nộp như các dạng khác. Khôi phục lựa chọn từ `savedAnswers` khi tải lại.
- Điều hướng: thêm anchor `#question-<id>` cho từng câu thành viên để nút 17/18 vẫn cuộn tới đúng khối; trạng thái "đã trả lời" theo slot có giá trị.

## Chấm điểm — `submitAttempt` (lib/actions/attempts.ts)
Trước khi map từng câu, gọi helper để biết nhóm. Với mỗi nhóm:
- `S` = tập đáp án đúng (lấy từ `correctAnswerJson` của câu trong nhóm — mọi câu như nhau).
- Gom giá trị các slot của nhóm, chuẩn hoá, **loại trùng**.
- Duyệt slot theo thứ tự, giữ set "chữ đúng đã tính": slot đúng (1đ) nếu chữ ∈ `S` và chưa được tính trước đó; ngược lại 0đ; slot trống → 0đ.
- Rải `isCorrect`/`pointsAwarded` vào từng dòng (mỗi dòng 1 điểm) → band/% vẫn đúng, cộng dồn đúng số đáp án đúng phân biệt (chấm phần: đúng 1 trong 2 → 1đ).
- Câu ngoài nhóm: chấm như cũ.

## Trang kết quả/chấm
Giữ hiển thị theo từng dòng như hiện tại (mỗi dòng: chữ học sinh chọn vs tập đúng) — đủ đúng, không phình scope.

## Không đụng tới
Schema DB, định dạng/prompt import, `band-score.ts`, thanh điều hướng, các bộ đếm câu, trang kết quả.

## Kiểm thử
- Unit test `detectMultiSelectGroups`: nhận đúng nhóm choose-2; bỏ qua MC đơn thường, dãy khác options, `|S| ≠ độ dài`.
- Unit test hàm chấm theo tập: đúng cả 2 → 2đ; đúng 1 → 1đ; sai hết → 0đ; chọn trùng → không nhân đôi; slot trống.
