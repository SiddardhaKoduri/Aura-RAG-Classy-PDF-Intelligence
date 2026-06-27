import type { PDFDocumentData } from './pdfParser';
import type { DocumentChunk } from './ragEngine';

const DB_NAME = 'AuraRAGDatabase';
const DB_VERSION = 1;
const DOCS_STORE = 'documents';
const CHUNKS_STORE = 'chunks';

// Extend PDFDocumentData & DocumentChunk to support username internally for DB
export interface UserPDFDocumentData extends PDFDocumentData {
  username: string;
}

export interface UserDocumentChunk extends DocumentChunk {
  username: string;
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        db.createObjectStore(DOCS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        db.createObjectStore(CHUNKS_STORE, { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDocumentToDB(doc: PDFDocumentData, chunks: DocumentChunk[], username: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([DOCS_STORE, CHUNKS_STORE], 'readwrite');
  const docStore = tx.objectStore(DOCS_STORE);
  const chunkStore = tx.objectStore(CHUNKS_STORE);
  
  // Attach username to document and chunks before saving
  const userDoc: UserPDFDocumentData = { ...doc, username };
  docStore.put(userDoc);
  
  chunks.forEach(chunk => {
    const userChunk: UserDocumentChunk = { ...chunk, username };
    chunkStore.put(userChunk);
  });
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadDocumentsFromDB(username: string): Promise<{ documents: PDFDocumentData[], chunks: DocumentChunk[] }> {
  try {
    const db = await getDB();
    
    const getDocs = new Promise<PDFDocumentData[]>((resolve, reject) => {
      const tx = db.transaction(DOCS_STORE, 'readonly');
      const store = tx.objectStore(DOCS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const allDocs = req.result as UserPDFDocumentData[];
        // Filter by username
        const userDocs = allDocs.filter(d => d.username === username);
        resolve(userDocs);
      };
      req.onerror = () => reject(req.error);
    });

    const getChunks = new Promise<DocumentChunk[]>((resolve, reject) => {
      const tx = db.transaction(CHUNKS_STORE, 'readonly');
      const store = tx.objectStore(CHUNKS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const allChunks = req.result as UserDocumentChunk[];
        // Filter by username
        const userChunks = allChunks.filter(c => c.username === username);
        resolve(userChunks);
      };
      req.onerror = () => reject(req.error);
    });

    const [documents, chunks] = await Promise.all([getDocs, getChunks]);
    return { documents, chunks };
  } catch (err) {
    console.error("Failed to load documents from IndexedDB:", err);
    return { documents: [], chunks: [] };
  }
}

export async function deleteDocumentFromDB(docId: string, username: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([DOCS_STORE, CHUNKS_STORE], 'readwrite');
  const docStore = tx.objectStore(DOCS_STORE);
  const chunkStore = tx.objectStore(CHUNKS_STORE);
  
  // Verify document username owner before deleting
  const checkReq = docStore.get(docId);
  checkReq.onsuccess = () => {
    const doc = checkReq.result as UserPDFDocumentData | undefined;
    if (doc && doc.username === username) {
      docStore.delete(docId);
    }
  };
  
  // Open cursor to delete matching chunks belonging to this user
  const req = chunkStore.openCursor();
  req.onsuccess = () => {
    const cursor = req.result;
    if (cursor) {
      const val = cursor.value as UserDocumentChunk;
      if (val.docId === docId && val.username === username) {
        cursor.delete();
      }
      cursor.continue();
    }
  };

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllFromDB(username: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([DOCS_STORE, CHUNKS_STORE], 'readwrite');
  const docStore = tx.objectStore(DOCS_STORE);
  const chunkStore = tx.objectStore(CHUNKS_STORE);
  
  // Delete all docs matching username
  const docsReq = docStore.openCursor();
  docsReq.onsuccess = () => {
    const cursor = docsReq.result;
    if (cursor) {
      if ((cursor.value as UserPDFDocumentData).username === username) {
        cursor.delete();
      }
      cursor.continue();
    }
  };

  // Delete all chunks matching username
  const chunksReq = chunkStore.openCursor();
  chunksReq.onsuccess = () => {
    const cursor = chunksReq.result;
    if (cursor) {
      if ((cursor.value as UserDocumentChunk).username === username) {
        cursor.delete();
      }
      cursor.continue();
    }
  };

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
