import { useState, useEffect } from 'react';
import { Sidebar, type ChatSession } from './components/Sidebar';
import { DocPanel } from './components/DocPanel';
import { ChatArea, type ChatMessage } from './components/ChatArea';
import { parsePDF, type PDFDocumentData } from './utils/pdfParser';
import { 
  chunkText, 
  embedChunks, 
  retrieveRelevantChunks, 
  generateRAGAnswer, 
  type APIConfig, 
  type APIProvider,
  type DocumentChunk,
  PROVIDER_DEFAULTS
} from './utils/ragEngine';
import { 
  saveDocumentToDB, 
  loadDocumentsFromDB, 
  deleteDocumentFromDB,
  clearAllFromDB 
} from './utils/db';

const getInitialConfig = (): APIConfig => {
  const envProvider = import.meta.env.VITE_DEFAULT_PROVIDER;
  const defaultProvider: APIProvider = (envProvider === 'nvidia' || envProvider === 'gemini') ? envProvider : 'nvidia';
  const defaultApiKey = defaultProvider === 'nvidia' 
    ? (import.meta.env.VITE_NVIDIA_API_KEY || '') 
    : (import.meta.env.VITE_GEMINI_API_KEY || '');
  return {
    provider: defaultProvider,
    apiKey: defaultApiKey,
    chatModel: PROVIDER_DEFAULTS[defaultProvider].chatModel,
    embedModel: PROVIDER_DEFAULTS[defaultProvider].embedModel
  };
};

export default function App() {
  // 1. Session State (Static)
  const currentUser = 'default';

  // 2. Main App State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<PDFDocumentData[]>([]);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [selectedSource, setSelectedSource] = useState<DocumentChunk | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const [config, setConfig] = useState<APIConfig>(getInitialConfig);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isDocPanelOpen, setIsDocPanelOpen] = useState<boolean>(false);

  // Dynamic user-prefixed storage keys helper
  const getKeys = () => {
    const user = currentUser.toLowerCase();
    return {
      SESSIONS: `aura-${user}-sessions`,
      ACTIVE_SESSION: `aura-${user}-active-session`,
      CONFIG: `aura-${user}-config`,
      MESSAGES_PREFIX: `aura-${user}-messages-`
    };
  };

  const keys = getKeys();

  // Load configuration, sessions, documents on mount
  useEffect(() => {
    const userKeys = getKeys();

    // Config
    const savedConfig = localStorage.getItem(userKeys.CONFIG);
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        // Fallback to env API key if stored key is empty but env has it for that provider
        if (!parsed.apiKey) {
          const envKey = parsed.provider === 'nvidia' 
            ? import.meta.env.VITE_NVIDIA_API_KEY 
            : import.meta.env.VITE_GEMINI_API_KEY;
          if (envKey) {
            parsed.apiKey = envKey;
          }
        }
        setConfig(parsed);
      } catch (e) {
        console.error("Failed to parse API config:", e);
      }
    } else {
      setConfig(getInitialConfig());
    }

    // Sessions
    const savedSessions = localStorage.getItem(userKeys.SESSIONS);
    let loadedSessions: ChatSession[] = [];
    if (savedSessions) {
      try {
        loadedSessions = JSON.parse(savedSessions);
        setSessions(loadedSessions);
      } catch (e) {
        console.error("Failed to parse sessions:", e);
      }
    } else {
      setSessions([]);
    }

    // Active Session ID
    const savedActiveId = localStorage.getItem(userKeys.ACTIVE_SESSION);
    if (savedActiveId && loadedSessions.some(s => s.id === savedActiveId)) {
      setActiveSessionId(savedActiveId);
    } else if (loadedSessions.length > 0) {
      setActiveSessionId(loadedSessions[0].id);
    } else {
      // Create default first session
      const defaultId = `${Date.now()}`;
      const defaultSession: ChatSession = {
        id: defaultId,
        title: 'New Chat Session',
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setSessions([defaultSession]);
      setActiveSessionId(defaultId);
      localStorage.setItem(userKeys.SESSIONS, JSON.stringify([defaultSession]));
      localStorage.setItem(userKeys.ACTIVE_SESSION, defaultId);
    }

    // Load PDF documents from IndexedDB
    const initDB = async () => {
      const data = await loadDocumentsFromDB(currentUser);
      setDocuments(data.documents);
      setChunks(data.chunks);
    };
    initDB();
  }, []);

  // Load chat messages when session changes
  useEffect(() => {
    if (!activeSessionId) return;
    localStorage.setItem(keys.ACTIVE_SESSION, activeSessionId);
    
    const savedMsgs = localStorage.getItem(`${keys.MESSAGES_PREFIX}${activeSessionId}`);
    if (savedMsgs) {
      try {
        setMessages(JSON.parse(savedMsgs));
      } catch (e) {
        console.error("Failed to parse session messages:", e);
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);



  // Session actions
  const handleCreateSession = () => {
    if (!keys) return;
    const newId = `${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat Session',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const updated = [newSession, ...sessions];
    setSessions(updated);
    setActiveSessionId(newId);
    localStorage.setItem(keys.SESSIONS, JSON.stringify(updated));
  };

  const handleDeleteSession = (id: string) => {
    if (!keys) return;
    const updated = sessions.filter(s => s.id !== id);
    localStorage.removeItem(`${keys.MESSAGES_PREFIX}${id}`);
    
    setSessions(updated);
    localStorage.setItem(keys.SESSIONS, JSON.stringify(updated));

    if (activeSessionId === id) {
      if (updated.length > 0) {
        setActiveSessionId(updated[0].id);
      } else {
        const newId = `${Date.now()}`;
        const defaultSession: ChatSession = {
          id: newId,
          title: 'New Chat Session',
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setSessions([defaultSession]);
        setActiveSessionId(newId);
        localStorage.setItem(keys.SESSIONS, JSON.stringify([defaultSession]));
      }
    }
  };

  const handleClearAllSessions = async () => {
    if (!keys) return;
    if (!window.confirm("Are you sure you want to delete ALL chat sessions and documents? This cannot be undone.")) return;
    
    sessions.forEach(s => {
      localStorage.removeItem(`${keys.MESSAGES_PREFIX}${s.id}`);
    });

    await clearAllFromDB(currentUser);
    setDocuments([]);
    setChunks([]);

    const newId = `${Date.now()}`;
    const defaultSession: ChatSession = {
      id: newId,
      title: 'New Chat Session',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setSessions([defaultSession]);
    setActiveSessionId(newId);
    setMessages([]);
    localStorage.setItem(keys.SESSIONS, JSON.stringify([defaultSession]));
    localStorage.setItem(keys.ACTIVE_SESSION, newId);
  };

  const handleClearChat = () => {
    if (!keys) return;
    if (!window.confirm("Clear all messages in this conversation?")) return;
    setMessages([]);
    localStorage.removeItem(`${keys.MESSAGES_PREFIX}${activeSessionId}`);
  };

  // PDF processing & user indexing
  const handleUploadPDFs = async (files: FileList) => {
    setUploading(true);
    setUploadProgress(5);

    try {
      const parsedDocs: PDFDocumentData[] = [];
      let allNewChunks: DocumentChunk[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (!isPDF) {
          alert(`File "${file.name}" is not a PDF.`);
          continue;
        }

        const parsedDoc = await parsePDF(file, (percent) => {
          const currentProgress = Math.round(((i / files.length) * 100) + (percent / files.length) * 0.4);
          setUploadProgress(Math.max(5, currentProgress));
        });

        const docChunks: DocumentChunk[] = [];
        parsedDoc.pages.forEach(page => {
          const pageChunks = chunkText(page.text, parsedDoc.fileName, parsedDoc.id, page.pageNumber);
          docChunks.push(...pageChunks);
        });

        parsedDocs.push(parsedDoc);
        allNewChunks.push(...docChunks);
      }

      if (config.apiKey) {
        setUploadProgress(45);
        allNewChunks = await embedChunks(allNewChunks, config, (current, total) => {
          const embedProgress = Math.round(45 + ((current / total) * 55));
          setUploadProgress(embedProgress);
        });
      } else {
        console.warn("No API key entered; skipping embedding indexing. Fallback to keyword search.");
        setUploadProgress(100);
      }

      // Save each doc linked to this user
      for (const doc of parsedDocs) {
        const docChunks = allNewChunks.filter(c => c.docId === doc.id);
        await saveDocumentToDB(doc, docChunks, currentUser);
      }

      setDocuments(prev => [...prev, ...parsedDocs]);
      setChunks(prev => [...prev, ...allNewChunks]);

    } catch (err) {
      console.error("Error processing PDFs:", err);
      alert(`Error indexing PDFs: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this document from the library?")) return;
    
    await deleteDocumentFromDB(id, currentUser);
    setDocuments(prev => prev.filter(d => d.id !== id));
    setChunks(prev => prev.filter(c => c.docId !== id));

    if (selectedSource?.docId === id) {
      setSelectedSource(null);
    }
  };

  // Q&A Messaging
  const handleSendMessage = async (text: string) => {
    if (!keys) return;
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    localStorage.setItem(`${keys.MESSAGES_PREFIX}${activeSessionId}`, JSON.stringify(updatedMsgs));

    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (activeSession && activeSession.title === 'New Chat Session') {
      const words = text.split(/\s+/).slice(0, 5).join(' ');
      const newTitle = words.length > 25 ? `${words.slice(0, 25)}...` : words;
      const renamedSessions = sessions.map(s => s.id === activeSessionId ? { ...s, title: newTitle } : s);
      setSessions(renamedSessions);
      localStorage.setItem(keys.SESSIONS, JSON.stringify(renamedSessions));
    }

    setIsGenerating(true);

    try {
      if (!config.apiKey) {
        throw new Error("Please open 'Configuration Settings' at the bottom of the sidebar and input your API key first.");
      }

      const retrievedChunks = await retrieveRelevantChunks(text, chunks, config, 4);
      const answer = await generateRAGAnswer(text, retrievedChunks, config, messages.map(m => ({ role: m.role, content: m.content })));

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: retrievedChunks
      };

      const finalMsgs = [...updatedMsgs, assistantMsg];
      setMessages(finalMsgs);
      localStorage.setItem(`${keys.MESSAGES_PREFIX}${activeSessionId}`, JSON.stringify(finalMsgs));

    } catch (err) {
      console.error("RAG flow error:", err);
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: `⚠️ **Error generating answer:**\n${err instanceof Error ? err.message : String(err)}\n\nPlease ensure your API credentials are correct.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const finalMsgs = [...updatedMsgs, errorMsg];
      setMessages(finalMsgs);
      localStorage.setItem(`${keys.MESSAGES_PREFIX}${activeSessionId}`, JSON.stringify(finalMsgs));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-layout">
      {/* Mobile backdrop dimming layer */}
      {(isSidebarOpen || isDocPanelOpen) && (
        <div 
          className="mobile-backdrop fade-in"
          onClick={() => {
            setIsSidebarOpen(false);
            setIsDocPanelOpen(false);
          }}
        />
      )}

      {/* 1. Sidebar */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => {
          setActiveSessionId(id);
          setIsSidebarOpen(false); // Close sidebar on mobile after selecting a session
        }}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteSession}
        onClearAllSessions={handleClearAllSessions}
        config={config}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="main-content">
        {/* 2. Chat Area */}
        <ChatArea
          messages={messages}
          onSendMessage={handleSendMessage}
          onClearChat={handleClearChat}
          onSelectSource={(chunk) => {
            setSelectedSource(chunk);
            setIsDocPanelOpen(true); // Auto-open document panel on mobile to inspect source
          }}
          isGenerating={isGenerating}
          activeSessionId={activeSessionId}
          hasDocuments={documents.length > 0}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onToggleDocPanel={() => setIsDocPanelOpen(!isDocPanelOpen)}
        />

        {/* 3. Document Sidebar */}
        <DocPanel
          documents={documents}
          chunks={chunks}
          onUploadPDFs={handleUploadPDFs}
          onDeleteDocument={handleDeleteDocument}
          uploading={uploading}
          uploadProgress={uploadProgress}
          selectedSource={selectedSource}
          onClearSelectedSource={() => setSelectedSource(null)}
          isOpen={isDocPanelOpen}
          onClose={() => setIsDocPanelOpen(false)}
        />
      </div>
    </div>
  );
}
