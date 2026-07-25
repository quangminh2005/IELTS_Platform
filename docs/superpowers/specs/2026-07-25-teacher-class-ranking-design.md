# Bảng xếp hạng lớp cho giáo viên

Ngày: 2026-07-25

## Vấn đề

Bảng xếp hạng lớp hiện chỉ học viên xem được, ở `/student/ranking`. Giáo viên không có cách nào
nhìn thấy bảng xếp hạng của lớp mình dạy — muốn biết học viên đang thấy gì thì phải đăng nhập
bằng tài khoản học viên.

## Mục tiêu

Giáo viên mở được bảng xếp hạng của từng lớp mình dạy, và thấy **đúng y hệt** những gì học viên
trong lớp đó thấy.

## Phạm vi

Có:

- Trang mới `/teacher/ranking` với ô chọn lớp.
- Mục "Xếp hạng" trên sidebar giáo viên.
- Tách logic xếp hạng và giao diện bảng thành module dùng chung cho cả hai vai trò.

Không có:

- Không đổi công thức tính điểm xếp hạng.
- Không đổi `prisma/schema.prisma`.
- Không đổi giao diện học viên đang thấy.
- Không thêm bộ lọc theo khoảng thời gian, không xuất file, không so sánh giữa các lớp.

## Thiết kế

### 1. `lib/class-ranking.ts` (mới)

Một hàm duy nhất, là nguồn sự thật cho cả hai vai trò:

```ts
export type RankedClassStudent = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  averageScorePercent: number;
  averageBandValue: number | null;
  completionRate: number;
  recentActivityPercent: number;
  rankingScore: number;
};

export async function getClassRanking(classId: string): Promise<RankedClassStudent[]>;
```

Nội dung chuyển nguyên vẹn từ `app/student/ranking/page.tsx` (dòng 91–165 bản hiện tại):

- Truy vấn `prisma.classStudent.findMany` theo `classId`, kèm `student.user.image`,
  `student.attempts` (có `review.overallBand` và `answers.assignableUnit.skill`),
  và `student.recipients.status`.
- Điểm trung bình: gộp band từng lần làm bằng `attemptBand`, lấy trung bình bằng `averageBand`;
  không có band nào thì `null` (giao diện hiển thị `%` thay thế).
- Tổng điểm xếp hạng: `studentRankingScore` từ `lib/student-score.ts`.
- Sắp xếp: giảm dần theo `rankingScore`; hoà điểm thì theo `displayName.localeCompare`.

Phạm vi dữ liệu **giữ nguyên như hiện tại**: `attempts` và `recipients` của mỗi học viên lấy
toàn bộ, không lọc theo `classId`. Học viên chỉ thuộc một lớp nên thực tế không lệch, nhưng nếu
sau này một học viên vào nhiều lớp thì điểm của họ sẽ giống nhau ở mọi lớp — chấp nhận, vì đây
đúng là con số học viên đang nhìn thấy.

Hàm này không gọi `auth()`. Việc kiểm tra quyền thuộc về trang gọi nó.

### 2. `components/class-ranking-board.tsx` (mới)

Server component thuần trình bày, không truy cập dữ liệu:

```ts
type ClassRankingBoardProps = {
  students: RankedClassStudent[];
  highlightStudentId?: string | null;
};
```

Chuyển nguyên vẹn phần JSX bục huân chương + bảng từ `app/student/ranking/page.tsx`
(dòng 167–337 bản hiện tại), kèm hai hàm phụ `initials()` và `avatarColor()` cùng hằng
`AVATAR_COLORS` — chúng chỉ phục vụ phần vẽ này nên đi theo component.

Nhãn **"Bạn"** hiện khi và chỉ khi `highlightStudentId` khớp id học viên đó. Trang giáo viên
không truyền prop này nên không có học viên nào được gắn nhãn, và cũng không có dòng nào được
tô nền `bg-primary/10`. Mọi thứ còn lại — bục top 3, thứ tự 2-1-3, huy chương, `RankTierBadge`,
bảng từ hạng 4, các cột responsive — giống hệt.

Lớp rỗng (`students.length === 0`): component vẽ khối trống "Lớp chưa có học viên nào".
Trường hợp này hiện chưa từng xảy ra ở trang học viên (đã là thành viên thì lớp có ít nhất
một người), nhưng giáo viên hoàn toàn có thể mở một lớp vừa tạo.

### 3. `app/student/ranking/page.tsx` (sửa)

Rút còn: kiểm tra phiên đăng nhập → tìm `StudentProfile` → tìm `ClassStudent` mới nhất →
`getClassRanking(membership.classId)` → render `<ClassRankingBoard>` với
`highlightStudentId={student.id}`.

Giữ nguyên phần đầu trang (tiêu đề "Xếp hạng", câu mô tả có tên lớp) và khối "Bạn chưa thuộc
lớp nào". Giao diện học viên không thay đổi.

### 4. `app/teacher/ranking/page.tsx` (mới)

```ts
type TeacherRankingPageProps = { searchParams: { classId?: string } };
```

Luồng:

1. `requireTeacher()` — như mọi trang giáo viên khác.
2. Lấy danh sách lớp của giáo viên đó: `prisma.class.findMany({ where: { teacherId }, orderBy: { createdAt: "desc" } })`.
3. Chưa có lớp nào → khối trống "Chưa có lớp học nào" kèm link tới `/teacher/classes`.
4. Chọn lớp: lớp có id khớp `searchParams.classId` **và thuộc giáo viên này**; không khớp
   (thiếu tham số, id lạ, hoặc lớp của giáo viên khác) → lấy lớp đầu danh sách. Vì chỉ chọn
   trong danh sách đã lọc theo `teacherId`, không có đường nào xem được lớp người khác.
5. `getClassRanking(selectedClass.id)` → `<ClassRankingBoard students={...} />`, không truyền
   `highlightStudentId`.

Ô chọn lớp: `<form method="get">` với `<select name="classId">` và nút "Xem". Form GET thuần,
không cần client component, không cần JS. Đặt ở header trang, bên phải tiêu đề.

Header trang: nhãn "Bảng xếp hạng lớp", tiêu đề "Xếp hạng", câu mô tả nêu tên lớp đang xem và
nói rõ đây là bảng học viên trong lớp đang nhìn thấy.

### 5. `components/app-shell.tsx` (sửa)

Thêm vào `navByRole.teacher`, ngay sau *Lớp học*:

```ts
{ href: "/teacher/ranking", label: "Xếp hạng", hint: "Bảng xếp hạng lớp", icon: "trophy" }
```

Icon `trophy` đã có sẵn (sidebar học viên đang dùng).

## Kiểm thử

`tests/class-ranking.test.ts` (mới) — kiểm phần thuần logic của việc xếp hạng: sắp giảm dần theo
tổng điểm, và hoà điểm thì xếp theo tên. Để test được mà không cần database, phần sắp xếp + quy
đổi tách thành một hàm thuần trong `lib/class-ranking.ts` (ví dụ `rankClassmates(rows)`), còn
`getClassRanking` chỉ lo truy vấn rồi gọi nó.

`tests/ranking.test.ts` và `tests/student-score.test.ts` phủ công thức tính điểm, không đổi nên
phải vẫn xanh. Chạy `pnpm test` toàn bộ để chắc không có test cấu trúc nào bám vào đường dẫn cũ.

Kiểm bằng trình duyệt sau khi triển khai: đăng nhập giáo viên, mở `/teacher/ranking`, đối chiếu
thứ hạng và số điểm với ảnh chụp `/student/ranking` của cùng lớp đó — phải trùng khít, chỉ khác
ở chỗ không có nhãn "Bạn".

## Rủi ro

Rủi ro chính là làm hỏng trang học viên khi bê code sang chỗ mới. Giảm bằng cách: chuyển nguyên
văn, không nhân tiện sửa gì; và đối chiếu trực tiếp hai trang trên trình duyệt sau khi xong.
