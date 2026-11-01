// 랜딩에서 고른 파일을 리더로 넘긴다. File은 URL에 실을 수 없고 sessionStorage는 용량 제한이 있다.
// 메모리에만 두면 페이지가 통째로 다시 로드될 때 사라진다. 이동 요청이 실패하면(새 배포 직후의
// 옛 탭, 네트워크 끊김, 개발 서버 재시작) Next.js가 그렇게 하므로 IndexedDB에도 둔다.
// 서버로 보내지 않고 이 브라우저에만, 마지막으로 고른 파일 하나만 남긴다.
const DB_NAME = "reader-pending-file";
const STORE = "files";
const KEY = "pending";

let pendingPdf: File | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveFile(file: File) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(file, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadFile(): Promise<File | null> {
  const db = await openDb();
  const file = await new Promise<File | null>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve((request.result as File) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return file;
}

// 페이지를 옮기기 전에 끝까지 기다려야 다시 로드되어도 남아 있다.
export async function setPendingPdf(file: File) {
  pendingPdf = file;
  try {
    await saveFile(file);
  } catch (error) {
    // 저장이 막힌 브라우저에서는 메모리로만 넘긴다.
    console.warn("올린 파일을 브라우저에 저장하지 못했습니다.", error);
  }
}

export async function getPendingPdf(): Promise<File | null> {
  if (pendingPdf) return pendingPdf;
  try {
    pendingPdf = await loadFile();
  } catch (error) {
    console.warn("저장한 파일을 불러오지 못했습니다.", error);
  }
  return pendingPdf;
}
