// 랜딩에서 고른 PDF를 리더로 넘긴다. File은 URL에 실을 수 없고
// sessionStorage는 용량 제한이 있어 모듈 메모리에 들고 있는다.
// TODO(demo): 리더에서 새로고침하면 사라져 목업 블록으로 넘어간다.
let pendingPdf: File | null = null;

export function setPendingPdf(file: File) {
  pendingPdf = file;
}

export function getPendingPdf(): File | null {
  return pendingPdf;
}
