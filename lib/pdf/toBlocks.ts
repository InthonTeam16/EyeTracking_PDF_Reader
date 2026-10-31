import type { Block } from "@/types";
import { extractPage, type PageContent } from "./extract";
import { pagesToBlocks } from "./segment";

// 브라우저 전용. "use client" 컴포넌트에서 호출한다.
// 텍스트가 없는 PDF(스캔본)는 빈 배열, 읽을 수 없는 파일은 에러를 던진다.
export async function toBlocks(file: File): Promise<Block[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const cdn = `https://unpkg.com/pdfjs-dist@${pdfjs.version}`;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    // 한글 CID 폰트 PDF는 CMap이 있어야 텍스트가 깨지지 않고,
    // 글꼴을 내장하지 않은 PDF는 표준 글꼴 데이터가 있어야 글자 폭(띄어쓰기 판단)이 정확하다
    // TODO(demo): CDN 의존. 오프라인 데모가 필요하면 cmaps, standard_fonts를 public/에 복사해 쓴다.
    cMapUrl: `${cdn}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${cdn}/standard_fonts/`,
  });

  try {
    const doc = await task.promise;
    const pages: PageContent[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      pages.push(await extractPage(await doc.getPage(n), pdfjs.OPS));
    }
    return pagesToBlocks(pages);
  } finally {
    await task.destroy();
  }
}
