/*
  Đặt popup chọn màu sao cho luôn nằm gọn trong màn hình.

  Trên máy tính popup chỉ cần treo phía trên đoạn bôi đen là đủ. Nhưng màn hình
  điện thoại chỉ rộng ~375px, mà popup rộng hơn 220px: bôi đen một chữ ở sát mép
  trái/phải là popup lòi hẳn ra ngoài, bôi đen dòng đầu bài đọc là popup bay lên
  trên đỉnh màn hình — người dùng không bấm được vào màu nào cả.
*/

// Chừa mép để popup không dính sát cạnh màn hình.
export const POPUP_EDGE_MARGIN = 8;
// Khoảng hở giữa popup và đoạn chữ đang bôi đen.
export const POPUP_GAP = 8;
// Thanh tiêu đề phòng thi che mất phần trên cùng.
export const POPUP_TOP_SAFE = 56;

type PlaceInput = {
  // Tâm ngang của đoạn bôi đen.
  x: number;
  // Mép trên và mép dưới của đoạn bôi đen (toạ độ so với màn hình).
  top: number;
  bottom: number;
  // Kích thước thật của popup, đo sau khi gắn vào DOM.
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
};

export type PopupPlacement = {
  left: number;
  top: number;
  // Popup nằm dưới đoạn bôi đen hay không (dùng để lật mũi tên nếu cần).
  below: boolean;
};

function clamp(value: number, min: number, max: number) {
  // Màn hình hẹp hơn cả popup thì min > max; khi đó ưu tiên ghim mép trái.
  return max < min ? min : Math.min(Math.max(value, min), max);
}

export function placeHighlightPopup(input: PlaceInput): PopupPlacement {
  const { x, top, bottom, width, height, viewportWidth, viewportHeight } = input;

  const left = clamp(
    x - width / 2,
    Math.min(POPUP_EDGE_MARGIN, Math.max(0, viewportWidth - width)),
    viewportWidth - width - POPUP_EDGE_MARGIN
  );

  const aboveTop = top - POPUP_GAP - height;
  const fitsAbove = aboveTop >= POPUP_TOP_SAFE;

  const nextTop = fitsAbove
    ? aboveTop
    : clamp(
        bottom + POPUP_GAP,
        POPUP_TOP_SAFE,
        Math.max(POPUP_TOP_SAFE, viewportHeight - height - POPUP_EDGE_MARGIN)
      );

  return { left, top: nextTop, below: !fitsAbove };
}
