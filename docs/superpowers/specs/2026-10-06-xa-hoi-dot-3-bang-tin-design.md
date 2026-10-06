# Mạng xã hội Đợt 3: bảng tin hoạt động + tim + bình luận (6/10/2026)

## 1. Bối cảnh

- **Đợt 1** (đã ship 6/10/2026): bảng xếp hạng, hồ sơ mở cho toàn trường, thưởng Xu.
- **Đợt 2** (đã ship 6/10/2026): theo dõi bạn, thả cảm xúc lên hồ sơ, tab Bạn bè.
- **Đợt 3** thêm bảng tin kiểu chin.edu.vn. Hoạt động học tập của các em tự hiện lên
  bảng tin, bạn bè và thầy thả tim, bình luận. Thầy có chỗ để gỡ bình luận.

**Thầy chốt cho Đợt 3 (6/10/2026):**
- **Phạm vi:** hai tab, **Bạn bè** (mặc định: mình + những người mình theo dõi) và
  **Toàn trường**.
- **Hoạt động tự đăng:** cả 4 nhóm. Gồm hoàn thành bài, mốc chuỗi 🔥 và lên hạng XP,
  ôn Sổ từ, thành tích và thưởng tháng. **Không bao giờ hiện điểm, band hay số Xu.**
- **Bình luận:** đăng ngay, thầy gỡ sau. Chủ hoạt động và người viết tự xoá được. Có
  bộ lọc từ thô tục cơ bản.
- **Thầy tham gia:** thầy xem bảng tin toàn trường, thả tim và bình luận, có nhãn
  Giáo viên. Thầy có tab "Bình luận mới" để gỡ.
- **Em tự chọn, thầy đã đồng ý:** bảng tin chỉ lấy 14 ngày gần nhất; ôn Sổ từ chỉ lên
  bảng tin khi ôn từ 10 thẻ trong ngày; đồ tự mua bằng Xu không lên bảng tin.

## 2. Phạm vi

**Làm:**
- trang `/student/feed` với hai tab, cùng mục "Bảng tin" trong menu học viên;
- trang `/teacher/feed` với hai tab "Bảng tin" và "Bình luận mới", cùng mục menu thầy;
- tim và bình luận cho cả học viên lẫn thầy;
- 2 loại thông báo mới ở chuông học viên;
- 2 bảng mới `FeedHeart` và `FeedComment`.

**Không làm:**
- học viên tự viết bài đăng;
- trả lời lồng nhau (bình luận chỉ có một tầng);
- sửa bình luận;
- báo cáo bình luận;
- khối bảng tin ở trang chủ;
- hoạt động gần đây trên hồ sơ;
- chuông cho thầy;
- giải đấu tuần, huy hiệu.

## 3. Hoạt động: dựng lúc đọc, có mã cố định

Hướng đã chọn là **dựng lúc đọc**, giống chuông. Không có bảng sự kiện và không sửa
các đường ghi dữ liệu. Mỗi hoạt động có `eventKey` cố định, **luôn bắt đầu bằng
`<loại>:<studentId>:`**, nên chỉ cần đọc mã là biết chủ hoạt động. Tim và bình luận
gắn vào `eventKey`.

| Loại | `eventKey` | Nguồn | Câu hiển thị | Thời điểm |
|---|---|---|---|---|
| Hoàn thành bài | `work:<sid>:<attemptId>:<dayKey>` | `AttemptSkill.submittedAt` (lượt cũ không có AttemptSkill thì lấy `Attempt.submittedAt`) | "hoàn thành Listening + Reading · <tên bài>"; bài tự luyện thêm "(tự luyện)" | lần nộp mới nhất trong ngày |
| Mốc chuỗi | `streak:<sid>:<dayKey>` | ngày có học mà chuỗi kết thúc ở ngày đó đúng bằng `minDays` của một cấp lửa | "đạt chuỗi 7 ngày — cấp Cháy 🔥" | lần nộp hoặc ôn thẻ đầu tiên của ngày đó; ngày chỉ có ôn thẻ thì lấy `updatedAt` |
| Lên hạng XP | `rank:<sid>:<levelIndex>` | dòng `CoinTransaction` kind ∈ `XP_EARN_KINDS`, cộng dồn theo `createdAt`, lấy dòng làm tổng vượt mốc `min` của một cấp (`ALL_LEVELS`) | "lên hạng Bạc II" | `createdAt` của dòng đó |
| Ôn Sổ từ | `vocab:<sid>:<dayKey>` | `VocabQuizDay` có `total ≥ 10` | "ôn 40 thẻ Sổ từ" | `updatedAt` |
| Thành tích | `item:<sid>:<studentItemId>` | `StudentItem` có `source` ∈ `achievement`, `streak` | "nhận khung Quán quân tháng 9" hoặc "mở tư thế Vẫy tay của Cú" | `createdAt` |
| Thưởng tháng | `prize:<sid>:<YYYY-MM>` | `CoinTransaction` kind `monthly_prize` | "Hạng #1 Học Bá tháng 10/2026 🏆" (lấy từ `note`, không ghi số Xu) | `createdAt` |

Quy tắc chung:
- Chỉ lấy hoạt động có thời điểm trong **14 ngày** gần nhất.
- Bỏ học viên có `hiddenFromBoards = true`.
- Sắp xếp mới nhất trước.
- Tên bài lấy từ `Assignment.title`.
- Lên hạng: một dòng sổ có thể nhảy qua 2 cấp. Khi đó chỉ hiện **cấp cao nhất**, mã
  dùng `levelIndex` của cấp đó.
- Lên hạng: mốc đầu tiên (Đồng I, XP 0) không bao giờ là sự kiện.
- Mốc chuỗi dùng lại dữ liệu từ `loadSchoolStreakInput` (đã đọc lùi 400 ngày, đủ cho
  cấp Bất Diệt 100). Ngày được cứu bằng Xu tính là ngày có học khi đếm chuỗi, nhưng
  không tự sinh mốc. Mốc chỉ rơi vào ngày thật sự có học.

### 3.1 Code

- **`lib/feed.ts`** (thuần, không Prisma):
  - kiểu `FeedEvent` = `{ key, kind, studentId, text, emoji, at }`;
  - các hàm `workEvents`, `streakMilestoneEvents`, `rankUpEvents`, `vocabEvents`,
    `itemEvents`, `prizeEvents`, cùng `mergeFeed(events, { since, hiddenIds })`;
  - `parseEventKey(key)` trả `{ kind, studentId }` hoặc `null`.
- **`lib/feed-data.ts`**:
  - `getSchoolFeed(now)`: đọc DB, dựng danh sách. Kết quả cache bằng `unstable_cache`
    (khoá theo ngày VN, `revalidate: 300`, tag `leaderboard`, nên `submitSkill` đã xoá
    sẵn cache này);
  - `getFeedPage({ viewerUserId, scope, friendIds, limit })`: lọc theo phạm vi, cắt
    trang, gắn tên và avatar chủ hoạt động, rồi đọc **trực tiếp, không cache**: số
    tim, mình đã tim chưa, số bình luận.

## 4. Dữ liệu mới (thêm vào ensure-db)

```prisma
model FeedHeart {
  eventKey  String
  userId    String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([eventKey, userId])
  @@index([eventKey])
}

model FeedComment {
  id             String   @id @default(cuid())
  eventKey       String
  ownerStudentId String   // chủ hoạt động, lấy từ eventKey, phục vụ chuông
  authorUserId   String
  body           String   // ≤ 200 ký tự, văn bản thuần
  createdAt      DateTime @default(now())
  owner          StudentProfile @relation(fields: [ownerStudentId], references: [id], onDelete: Cascade)
  author         User           @relation(fields: [authorUserId], references: [id], onDelete: Cascade)

  @@index([eventKey, createdAt])
  @@index([ownerStudentId, createdAt])
  @@index([createdAt])
}
```

- Tác giả là `User` nên thầy và học viên dùng chung bảng.
- Tên hiển thị: học viên lấy `StudentProfile.displayName`, thầy lấy
  `TeacherProfile.displayName`.
- Gỡ hay xoá đều là **xoá hẳn** dòng, không lưu nhật ký.

## 5. Action: `lib/actions/feed.ts`

Mỗi action bắt đầu bằng `requireFeedUser()`:
- trả `{ userId, role, studentId | null }` cho học viên hoặc thầy;
- ai khác thì ném lỗi.

Các action:

- **`toggleHeart(eventKey)`**:
  - `eventKey` phải có trong `getSchoolFeed(now)` (14 ngày, không phải tài khoản ẩn);
  - học viên không tự tim hoạt động của mình;
  - bấm lần nữa thì bỏ tim;
  - lỗi trùng khoá (P2002) coi như thành công.
- **`addComment(eventKey, body)`**:
  - `body` được cắt khoảng trắng, dài 1–200 ký tự;
  - `eventKey` phải có trong feed;
  - chặn nếu `containsProfanity(body)`, báo "Bình luận có từ không phù hợp.";
  - học viên tối đa **30 bình luận mỗi ngày giờ VN**, đếm theo `authorUserId`;
    thầy không giới hạn;
  - ghi `ownerStudentId` từ `parseEventKey`.
- **`deleteComment(commentId)`**: được phép nếu là người viết, chủ hoạt động
  (`ownerStudentId`) hoặc thầy.

Sau mỗi action gọi `revalidatePath("/student/feed")` và `revalidatePath("/teacher/feed")`.
Không action nào cộng Xu hay XP.

**Lọc từ thô tục** nằm ở `lib/feed-moderation.ts` (thuần):
- danh sách từ tiếng Việt và tiếng Anh cơ bản;
- so không dấu bằng `foldVietnamese` từ `lib/social.ts`;
- khớp nguyên từ, kể cả kiểu viết tách bằng dấu chấm hoặc gạch như "đ.m".

## 6. Giao diện

### 6.1 Học viên: `/student/feed`

- Menu thêm mục "Bảng tin" (gợi ý "Hoạt động bạn bè"), đặt ngay sau "Xếp hạng".
- **Hai tab** là link `?scope=friends|school`, mặc định `friends`. Nếu tab Bạn bè
  trống vì chưa theo dõi ai, hiện lời mời "Theo dõi bạn bè…" kèm link về
  `/student/profile#ban-be` và link sang tab Toàn trường.
- **Thẻ hoạt động** (`FeedCard`, client):
  - avatar và tên chủ hoạt động, bấm vào thì mở hồ sơ;
  - emoji, câu mô tả, thời gian tương đối;
  - nút ❤️ kèm số (cập nhật ngay, server lỗi thì quay lại);
  - nút 💬 kèm số. Bấm 💬 thì mở các bình luận dưới thẻ: đọc qua server action
    `listComments(eventKey)`, cũ trước, có ô viết và đếm ký tự.
  - Mỗi bình luận hiện avatar, tên, nhãn **Giáo viên** nếu thầy viết, thời gian, và
    nút Xoá nếu mình có quyền.
- **Trang**: 20 hoạt động một trang, nút "Xem thêm" là link `?limit=40…`, tối đa 200.
- `?focus=<eventKey>` (link từ chuông) đưa hoạt động đó lên đầu và mở sẵn bình luận.
  Hoạt động đã quá 14 ngày thì báo "Hoạt động này đã cũ".

### 6.2 Thầy: `/teacher/feed`

- Dùng `requireTeacherPage()`.
- Menu thầy thêm "Bảng tin" (gợi ý "Hoạt động & bình luận").
- **Tab Bảng tin**: dùng chung `FeedCard`, phạm vi toàn trường. Tên học viên link
  sang `/teacher/students/<id>`.
- **Tab Bình luận mới**: 50 bình luận mới nhất mỗi trang, mỗi dòng gồm:
  - tác giả, nội dung, câu mô tả hoạt động (lấy từ feed nếu còn trong 14 ngày, nếu
    không thì ghi "Hoạt động cũ");
  - chủ hoạt động, thời gian;
  - nút **Gỡ** (gọi `deleteComment`).

### 6.3 Chuông học viên

- **`feed_heart`**: tim vào hoạt động của mình, gộp theo ngày giờ VN, dùng
  `namesSentence`. Ví dụ: "Linh và 2 bạn khác đã thả tim hoạt động của bạn". Id là
  `feed_heart:<dayKey>`, href là `/student/feed?scope=school`.
- **`feed_comment`**: mỗi bình luận của người khác vào hoạt động của mình là một dòng.
  Ví dụ: "Thầy Anh Vũ bình luận: “Giỏi lắm!”", phần trích cắt ở 80 ký tự. Id là
  `feed_comment:<id>`, href là `/student/feed?focus=<eventKey>`.
- Không báo khi chính mình tim hoặc bình luận.
- Đọc 30 ngày gần nhất, tối đa 200 dòng, bọc try/catch. Truyền vào
  `buildStudentNotifications` qua tham số tuỳ chọn thứ 9.

## 7. Bảo mật và riêng tư

- Câu mô tả chỉ dựng từ tên bài, tên kỹ năng, số thẻ, tên hạng và tên đồ. Không đọc
  `score`, `scorePercent`, `overallBand`. Số Xu không bao giờ vào câu mô tả: lên hạng có cộng `amount`
  của dòng XP nhưng chỉ để tìm mốc. Test cấu trúc ép `lib/feed.ts` và
  `lib/feed-data.ts` không chứa `score`, `scorePercent`, `overallBand`, `Band`.
- Bình luận và tên là văn bản thuần, không dùng `dangerouslySetInnerHTML`.
- Mọi action xác định người dùng từ phiên đăng nhập. `eventKey` được đối chiếu với
  feed thật, nên không gắn được tim hay bình luận vào mã bịa.
- Tài khoản thử đã ẩn không có hoạt động trên bảng tin, nên cũng không nhận được tim
  hay bình luận.

## 8. Kiểm thử

- **`tests/feed.test.ts`** (thuần), các trường hợp:
  - gộp kỹ năng theo lượt và ngày, có nhãn tự luyện;
  - mốc chuỗi đúng ngày chạm 1/3/7, không sinh mốc ở ngày được cứu bằng Xu;
  - lên hạng nhảy hai cấp thì chỉ lấy cấp cao; Đồng I không phải sự kiện;
  - ngưỡng 10 thẻ;
  - lọc 14 ngày và lọc tài khoản ẩn;
  - `parseEventKey`.
- **`tests/feed-moderation.test.ts`**: bắt được từ thô tục có dấu, không dấu, tách
  bằng dấu chấm; không bắt nhầm từ thường (ví dụ "đi mua", "class").
- **Notifications**: gộp tim theo ngày, mỗi bình luận một dòng, không báo hoạt động
  của chính mình.
- **Test cấu trúc**:
  - schema và ensure-db có 2 bảng;
  - action gọi `requireFeedUser` đầu tiên;
  - trang thầy dùng `requireTeacherPage`;
  - feed không đọc điểm hay band.
- **Thủ công**: ở local, 2 học viên và thầy tim, bình luận, xoá, gỡ, xem chuông. Sau
  đó kiểm trên prod bằng Chrome.
