"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, type ChangeEvent } from "react";

import { setPendingPdf } from "@/components/reader/pdf-store";
import { Button } from "@/components/ui/button";

export function PdfUploadButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // 같은 파일을 다시 골라도 change가 일어나도록 비운다.
    event.target.value = "";
    if (!file) return;

    setPendingPdf(file);
    router.push("/reader");
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleChange}
      />
      <Button
        size="lg"
        className="h-13 gap-2.5 rounded-xl px-6 text-base"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4.5" aria-hidden="true" />
        PDF 올리기
      </Button>
    </>
  );
}
