import { validateDraft, type Draft } from "./model";

type Row = { key: string; revision: number; draft: Draft };
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("diagramwise-challenge-drafts", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("drafts", { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Device storage is unavailable. Export your draft to keep it.",
        ),
      );
    request.onblocked = () =>
      reject(new Error("Close older challenge tabs and retry."));
  });
}
export async function readDraft(key: string): Promise<Row | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("drafts", "readonly");
      const request = tx.objectStore("drafts").get(key);
      tx.oncomplete = () => resolve(request.result ?? null);
      tx.onabort = tx.onerror = () =>
        reject(new Error("Could not read your saved draft."));
    });
  } finally {
    db.close();
  }
}
export async function writeDraft(
  key: string,
  draft: Draft,
  expectedRevision: number,
): Promise<number> {
  const safe = validateDraft(draft);
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("drafts", "readwrite");
      const store = tx.objectStore("drafts");
      let conflict = false;
      const request = store.get(key);
      request.onsuccess = () => {
        if ((request.result?.revision ?? 0) !== expectedRevision) {
          conflict = true;
          tx.abort();
          return;
        }
        store.put({ key, revision: expectedRevision + 1, draft: safe });
      };
      tx.oncomplete = () => resolve(expectedRevision + 1);
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            conflict
              ? "Another tab saved changes. Export this draft, then reload to continue from the saved version."
              : "Changes could not be saved on this device. Export your draft to keep it.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
