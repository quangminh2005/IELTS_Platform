# Mạng xã hội Đợt 2: Theo dõi bạn bè + thả cảm xúc (6/10/2026)

## 1. Bối cảnh

Đợt 1 đã ship ngày 6/10/2026 (spec `2026-10-05-xa-hoi-dot-1-bang-xep-hang-ho-so-design.md`):
hồ sơ mở cho toàn trường, ba bảng Học Bá / Chuỗi / Điểm lớp, thưởng Xu Top 10, ẩn tài
khoản thử. Đợt 2 thêm phần "bạn bè" theo kiểu chin.edu.vn: theo dõi nhau, tab Bạn bè trên
bảng xếp hạng, tìm bạn trong trường, thả cảm xúc lên hồ sơ, có báo qua chuông.

**Thầy chốt cho Đợt 2 (6/10/2026):**
- Theo dõi **một chiều, không cần duyệt**. Bấm là thành, người kia nhận báo ở chuông.
- Có 3 cảm xúc 👏 Cổ vũ · 🔥 Truyền lửa · 🎯 Tiếp mục tiêu. **Mỗi loại được gửi 1 lần
  mỗi ngày cho mỗi người**, nên mỗi ngày A gửi được tối đa 3 cảm xúc cho B.
- Chuông **gộp theo ngày**, không báo từng cái.
- Cảm xúc **không thưởng Xu/XP**, để các em không rủ nhau bấm qua lại để kiếm Xu.
- **Chưa làm "Mời bạn bè".** Sau này học viên mới sẽ tự đăng ký được, lúc đó mới làm
  link mời. Hiện tại người ngoài chưa có tài khoản thì vẫn dừng ở trang chờ.

## 2. Phạm vi

**Làm:**
- 2 bảng mới `Follow` và `ProfileReaction`;
- nút Theo dõi, số người theo dõi và 3 nút cảm xúc trên hồ sơ bạn khác;
- thẻ "Bạn bè" trên hồ sơ của mình, gồm tìm bạn, gợi ý bạn cùng lớp và hai danh sách;
- danh sách theo dõi trên hồ sơ bạn khác;
- tab phạm vi "Bạn bè" trên bảng Học Bá và bảng Chuỗi;
- 2 loại thông báo mới ở chuông.

**Không làm:**
- mời bạn bè;
- bảng tin, tim, bình luận (để Đợt 3);
- giải đấu tuần, huy hiệu;
- công cụ phía thầy để xem hay gỡ theo dõi và cảm xúc;
- tab Bạn bè cho khối Top 5 ở trang chủ;
- chặn hoặc báo cáo người dùng.

## 3. Dữ liệu

### 3.1 Bảng `Follow`

```prisma
model Follow {
  followerId  String
  followingId String
  createdAt   DateTime @default(now())
  follower    StudentProfile @relation("FollowFollower", fields: [followerId], references: [id], onDelete: Cascade)
  following   StudentProfile @relation("FollowFollowing", fields: [followingId], references: [id], onDelete: Cascade)

  @@id([followerId, followingId])
  @@index([followingId, createdAt])
}
```

- Mỗi dòng nghĩa là `follower` đang theo dõi `following`.
- Bỏ theo dõi thì xoá dòng. Dòng báo ở chuông cũng tự mất theo, chấp nhận điều này.
- Không lưu lịch sử.

### 3.2 Bảng `ProfileReaction`

```prisma
model ProfileReaction {
  id        String   @id @default(cuid())
  fromId    String
  toId      String
  kind      String   // cheer | fire | target
  dayKey    String   // "YYYY-MM-DD" giờ VN (vietnamDateKey)
  createdAt DateTime @default(now())
  from      StudentProfile @relation("ReactionFrom", fields: [fromId], references: [id], onDelete: Cascade)
  to        StudentProfile @relation("ReactionTo", fields: [toId], references: [id], onDelete: Cascade)

  @@unique([fromId, toId, kind, dayKey])
  @@index([toId, createdAt])
}
```

- Ràng buộc `@@unique` thực thi luật "mỗi loại 1 lần/ngày/người" ở tầng DB, bấm hai lần
  cùng lúc cũng không lọt.
- Cảm xúc không gỡ được. Không có nút huỷ.
- Phải thêm giá trị `kind` vào comment enum ở đầu `schema.prisma` theo đúng quy ước.

### 3.3 Đưa lên prod

Cả hai bảng, kèm index và khoá ngoại, được thêm vào `scripts/ensure-db.mjs` dưới dạng
`CREATE TABLE IF NOT EXISTS`, giống `CoinTransaction`. Mọi chỗ **đọc** hai bảng này
trên các trang đã có sẵn (chuông, hồ sơ, xếp hạng) đều bọc try/catch và rơi về rỗng,
để trang không sập nếu ensure-db chưa chạy.

## 4. Logic thuần: `lib/social.ts`

File này không import Prisma, để dùng được ở client component và để test.

- `REACTIONS`: danh sách `{ kind, emoji, label }` theo thứ tự cố định: cheer 👏 Cổ vũ,
  fire 🔥 Truyền lửa, target 🎯 Tiếp mục tiêu. Có thêm `isReactionKind(value)`.
- `foldVietnamese(text)`: chuyển chữ thường, bỏ dấu (NFD rồi xoá dấu kết hợp), đổi
  `đ` thành `d`, gộp khoảng trắng.
- `searchStudents(people, query, limit = 8)`: lọc theo `foldVietnamese(displayName)`.
  Kết quả khớp ở **đầu một từ** xếp trước, khớp ở giữa xếp sau, rồi sắp theo tên.
  Query rỗng thì trả `[]`.
- `groupSocialNotifications(...)`: gộp follow và reaction theo `dayKey` của
  `createdAt` (giờ VN). Mỗi ngày có tối đa 1 mục follow và 1 mục reaction.
  - Mục reaction:
    - tên người gửi lấy theo thứ tự lần gửi đầu tiên trong ngày, mỗi người chỉ một lần;
    - emoji là tập các loại có trong ngày, xếp theo thứ tự `REACTIONS`;
    - `createdAt` của mục là lần gửi mới nhất trong ngày.
  - Câu chữ:
    - 1 người: "Linh đã gửi 👏🔥 cho bạn";
    - 2 người: "Linh và Minh đã gửi …";
    - từ 3 người: "Linh, Minh và 2 bạn khác đã gửi …".
  - Mục follow dùng cùng quy tắc tên, câu là "… đã theo dõi bạn".
- `friendScope(meId, followingIds)`: trả `Set` gồm mình và những người mình theo dõi.

## 5. Đọc và ghi DB

### 5.1 `lib/social-data.ts` (chỉ chạy ở server)

- `getFollowCounts(studentId)` trả `{ following, followers }`.
- `getFollowLists(studentId)` trả hai danh sách `BoardPerson` (Đang theo dõi / Người
  theo dõi), mới nhất trước, tối đa 200 người mỗi danh sách.
- `getReactionTotals(studentId)` trả tổng đã nhận theo từng `kind`, tính từ trước tới
  nay.
- `getMyReactionsToday(fromId, toId, now)` trả các `kind` mình đã gửi cho người này
  hôm nay.
- `isFollowing(meId, targetId)`.
- `getFollowingIds(meId)`.
- `getSchoolDirectory()`: mọi học viên có `hiddenFromBoards = false` và có `userId`
  (đã đăng nhập ít nhất một lần), lấy các trường `BoardPerson`.
- `getClassmateSuggestions(meId)`: bạn cùng lớp mà mình chưa theo dõi, bỏ tài khoản ẩn,
  tối đa 6 người.

### 5.2 Server action: `lib/actions/social.ts`

Mỗi action đều gọi `requireStudent()` đầu tiên và kiểm tra id bằng zod
`z.string().min(1).max(64)`:

- `toggleFollow(targetId)`:
  - nếu `targetId` là chính mình hoặc học viên không tồn tại thì trả lỗi
    `ActionResult`;
  - nếu đang theo dõi thì xoá dòng, ngược lại thì tạo dòng. Lỗi trùng khoá (P2002)
    do bấm hai lần được coi là thành công.
  - Sau đó gọi `revalidatePath` cho hồ sơ người đó, hồ sơ của mình và
    `/student/ranking`.
- `sendReaction(targetId, kind)`:
  - `kind` phải qua `z.enum(["cheer","fire","target"])`, không gửi cho chính mình;
  - tạo dòng với `dayKey = vietnamDateKey(now)`. Trùng khoá (P2002) thì coi như đã
    gửi và trả thành công.
  - Sau đó `revalidatePath` hồ sơ người nhận.

## 6. Giao diện

### 6.1 Hồ sơ bạn khác: `/student/profile/[studentId]`

- **Thanh số đếm** dưới dòng "Lớp", dùng component `FollowStats`: "**N** đang theo
  dõi · **N** người theo dõi".
- **Nút Theo dõi** là `FollowButton`, client component dùng `useTransition` gọi
  `toggleFollow`:
  - chưa theo dõi: nút chính "Theo dõi";
  - đang theo dõi: nút viền "Đang theo dõi ✓". Rê chuột hoặc chạm vào thì đổi chữ thành
    "Bỏ theo dõi".
  - Trong lúc chờ server thì nút đổi trạng thái ngay (optimistic), lỗi thì quay lại.
- **Thanh cảm xúc** là `ReactionBar`, gồm 3 nút. Mỗi nút có emoji, nhãn và tổng đã
  nhận:
  - loại mình đã gửi hôm nay thì nút ở trạng thái "đã gửi" (nền nhạt màu chính,
    `aria-pressed`) và bị khoá, có `title` "Mai bạn gửi tiếp được nhé";
  - bấm thì số tăng 1 ngay (optimistic) và có hiệu ứng nảy nhẹ.
- **Cột phải** thêm thẻ `FollowListsCard`, ở chế độ chỉ xem: hai tab Đang theo dõi /
  Người theo dõi, mỗi dòng có avatar và tên, bấm vào thì mở hồ sơ (của mình thì về
  `/student/profile`). Danh sách dài thì cuộn trong thẻ, cao tối đa khoảng 320px.

### 6.2 Hồ sơ của mình: `/student/profile`

- Có cùng thanh số đếm và tổng cảm xúc đã nhận. Ở đây chỉ hiện số, không phải nút.
- Cột phải thêm thẻ **"Bạn bè"** (`FriendsCard`, client), gồm:
  - **Ô tìm** "Tìm bạn trong trường…". Danh sách cả trường (`getSchoolDirectory`, bỏ
    chính mình) truyền xuống từ server, lọc trong trình duyệt bằng `searchStudents`.
    Mỗi kết quả có avatar, tên và nút Theo dõi thu nhỏ.
  - **"Bạn cùng lớp"**: gợi ý khi ô tìm đang trống, có nút Theo dõi. Không còn ai để
    gợi ý thì ẩn mục này.
  - **Hai tab** Đang theo dõi / Người theo dõi, dùng lại phần danh sách của
    `FollowListsCard`.
  - Chưa theo dõi ai thì hiện dòng trống "Theo dõi bạn bè để so tài trên tab Bạn bè
    ở trang Xếp hạng."

### 6.3 Xếp hạng: `/student/ranking`

- Thêm `scope=friends` vào `resolveRankingParams` và `rankingHref`. Thanh phạm vi
  thành **Bạn bè · Lớp · Toàn trường**. Phạm vi mặc định giữ như cũ.
- Học Bá và Chuỗi lọc bằng `friendScope(me, followingIds)`, theo đúng cách đang lọc
  theo lớp (`members`). Component bảng giữ nguyên.
- Chưa theo dõi ai thì hiện ô trống: "Bạn chưa theo dõi ai" kèm link "Tìm bạn →" về
  `/student/profile#ban-be`.
- Tab Điểm lớp không có phạm vi Bạn bè.

### 6.4 Chuông

- Thêm 2 loại vào `StudentNotificationType`: `follow_new` và `reaction_new`.
  - id có dạng `follow:<dayKey>` và `reaction:<dayKey>`;
  - href là `/student/profile`.
  - Tính chưa đọc như các loại khác, so `createdAt` với `notificationsReadAt`.
- `getStudentNotifications` đọc `Follow` (người theo dõi mình) và `ProfileReaction`
  (gửi cho mình) trong 30 ngày gần nhất, tối đa 200 dòng mỗi bảng, có kèm tên người
  gửi. Kết quả đưa qua `groupSocialNotifications`, rồi thành tham số tuỳ chọn thứ 8 của
  `buildStudentNotifications`. Phần đọc bọc try/catch như các nguồn khác.
- Icon và màu cho hai loại mới trong component chuông dùng emoji 👥 và 👏.

## 7. Bảo mật và riêng tư

- Hồ sơ vẫn không lộ band, điểm, mục tiêu, bài làm hay số Xu. Test
  `profile-visibility` giữ nguyên và mở rộng ra các component mới.
- Mọi action lấy `fromId`/`followerId` từ `requireStudent()`, không bao giờ lấy từ
  input.
- Tài khoản ẩn (`hiddenFromBoards`) không hiện trong ô tìm, gợi ý và tab Bạn bè trên
  bảng xếp hạng (bảng vốn đã lọc sẵn). Nếu ai đó đã theo dõi một tài khoản ẩn thì tài
  khoản đó vẫn hiện trong danh sách theo dõi. Chấp nhận điều này, vì tài khoản ẩn chỉ
  là tài khoản thử của thầy.
- Tên hiển thị là văn bản thuần, không dùng `dangerouslySetInnerHTML`.

## 8. Kiểm thử

- `tests/social.test.ts` (logic thuần):
  - `foldVietnamese`: "Tuấn" khớp "tuan", "Đức" khớp "duc";
  - thứ tự kết quả của `searchStudents`;
  - `groupSocialNotifications`: 1, 2 và từ 3 người; nhiều ngày; thứ tự emoji; một
    người gửi 3 loại;
  - `friendScope`;
  - `resolveRankingParams` nhận `scope=friends`.
- Test cấu trúc:
  - `schema.prisma` có `Follow` và `ProfileReaction` với đúng khoá;
  - `ensure-db.mjs` có `CREATE TABLE IF NOT EXISTS` cho cả hai bảng;
  - `lib/actions/social.ts` gọi `requireStudent()` trong mọi action.
- Thủ công:
  - local: tự ký JWT cho 2 học viên để thử theo dõi, cảm xúc, chuông và tab Bạn bè;
  - prod: dùng Chrome kiểm cả hai vai sau khi deploy. Kiểm thêm điện thoại (chạm vào
    nút "Đang theo dõi", ô tìm).
