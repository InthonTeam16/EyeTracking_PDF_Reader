"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, type ChangeEvent } from "react";

import { setPendingPdf } from "@/components/reader/pdf-store";
import { Button } from "@/components/ui/button";

export function PdfUploadButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    // 고른 순간 내용을 메모리로 복사한다. 디스크 파일 참조만 넘기면 입력칸을 비우거나
    // 페이지를 옮긴 뒤 읽을 때 브라우저가 접근을 끊어 NotFoundError가 날 수 있다.
    let copy = file;
    try {
      copy = new File([await file.arrayBuffer()], file.name, {
        type: file.type,
      });
    } catch (error) {
      // 복사에 실패해도 원래 파일로 계속한다. 리더에서 다시 읽어 보고, 안 되면 샘플을 보여준다.
      console.warn("올린 파일을 미리 읽지 못했습니다.", error);
    }
    // 같은 파일을 다시 골라도 change가 일어나도록 비운다.
    input.value = "";

    setPendingPdf(copy);
    router.push("/reader");
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf,text/plain,.txt"
        className="hidden"
        onChange={handleChange}
      />
      <Button
        size="lg"
        className="h-13 gap-2.5 rounded-xl px-6 text-base"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4.5" aria-hidden="true" />
        파일 열기(PDF·TXT)
      </Button>
    </>
  );
}
