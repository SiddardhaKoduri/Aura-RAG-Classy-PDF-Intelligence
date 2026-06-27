import React, { useRef, useState } from 'react';
import { 
  FileText, 
  UploadCloud, 
  Trash2, 
  BookOpen, 
  Layers, 
  Loader2,
  FileCheck,
  Search,
  X
} from 'lucide-react';
import type { PDFDocumentData } from '../utils/pdfParser';
import type { DocumentChunk } from '../utils/ragEngine';

interface DocPanelProps {
  documents: PDFDocumentData[];
  chunks: DocumentChunk[];
  onUploadPDFs: (files: FileList) => void;
  onDeleteDocument: (id: string) => void;
  uploading: boolean;
  uploadProgress: number;
  selectedSource: DocumentChunk | null;
  onClearSelectedSource: () => void;
  onClose?: () => void;
  isOpen?: boolean;
}

export const DocPanel: React.FC<DocPanelProps> = ({
  documents,
  chunks,
  onUploadPDFs,
  onDeleteDocument,
  uploading,
  uploadProgress,
  selectedSource,
  onClearSelectedSource,
  onClose,
  isOpen,
}) => {
  const [activeTab, setActiveTab] = useState<'docs' | 'sources'>('docs');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadPDFs(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadPDFs(e.target.files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // If a source is selected, auto switch to sources tab
  React.useEffect(() => {
    if (selectedSource) {
      setActiveTab('sources');
    }
  }, [selectedSource]);

  return (
    <div className={`doc-panel ${isOpen ? 'open' : ''}`} style={{ borderLeft: '1px solid var(--border-glass)' }}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-glass)',
        background: 'rgba(5, 8, 15, 0.4)'
      }}>
        <button
          style={{
            flex: 1,
            padding: '16px 0',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'docs' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'docs' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'docs' ? 600 : 500,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'var(--transition-fast)'
          }}
          onClick={() => setActiveTab('docs')}
        >
          <Layers size={14} />
          Documents ({documents.length})
        </button>
        <button
          style={{
            flex: 1,
            padding: '16px 0',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'sources' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'sources' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'sources' ? 600 : 500,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'var(--transition-fast)'
          }}
          onClick={() => setActiveTab('sources')}
        >
          <BookOpen size={14} />
          Source Explorer
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="mobile-only-close btn-icon"
            style={{
              width: '42px',
              height: 'auto',
              padding: 0,
              border: 'none',
              borderLeft: '1px solid var(--border-glass)',
              borderRadius: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="doc-panel-content" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {activeTab === 'docs' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Upload Zone */}
            <div 
              className={`drag-drop-zone ${dragActive ? 'active' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileInput}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                multiple 
                accept=".pdf" 
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
                marginBottom: '4px'
              }}>
                <UploadCloud size={24} />
              </div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Drag & drop PDFs here
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  or click to browse from files
                </p>
              </div>
            </div>

            {/* Uploading Progress */}
            {uploading && (
              <div className="glass-card animate-pulse-glow" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                    <Loader2 size={14} className="animate-spin" />
                    Processing PDFs...
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{uploadProgress}%</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${uploadProgress}%`, 
                    background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))',
                    borderRadius: '2px',
                    transition: 'width 0.3s ease'
                  }}></div>
                </div>
              </div>
            )}

            {/* Document List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: 'var(--text-muted)',
                fontWeight: 700,
                marginBottom: '4px'
              }}>Active Library</span>
              
              {documents.length === 0 ? (
                <div style={{
                  padding: '30px 10px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  border: '1px dashed rgba(255,255,255,0.05)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  No documents uploaded yet.<br/>Upload a PDF to index chunks.
                </div>
              ) : (
                documents.map(doc => (
                  <div 
                    key={doc.id}
                    className="glass-card fade-in"
                    style={{
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', flex: 1 }}>
                      <div style={{ color: 'var(--color-primary)', display: 'flex', flexShrink: 0 }}>
                        <FileCheck size={18} />
                      </div>
                      <div style={{ overflow: 'hidden', flex: 1 }}>
                        <p style={{
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {doc.fileName}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {doc.fileSize} • {doc.totalPages} pages
                        </p>
                      </div>
                    </div>
                    <button 
                      className="btn-icon" 
                      style={{ width: '32px', height: '32px' }}
                      onClick={() => onDeleteDocument(doc.id)}
                    >
                      <Trash2 size={14} color="var(--color-danger)" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Quick Stats */}
            {documents.length > 0 && (
              <div style={{
                marginTop: '10px',
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.03)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Index Chunks:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{chunks.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Search Mechanism:</span>
                  <span style={{ 
                    fontWeight: 600, 
                    color: chunks.length > 0 && chunks[0].embedding ? 'var(--color-success)' : 'var(--color-warning)'
                  }}>
                    {chunks.length > 0 && chunks[0].embedding ? 'Semantic Vector' : 'Keyword Fallback'}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Source Explorer Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <span style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: 'var(--text-muted)',
              fontWeight: 700
            }}>Inspecting Source</span>

            {selectedSource ? (
              <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <FileText size={16} color="var(--color-primary)" />
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: 'var(--text-primary)'
                      }}>
                        {selectedSource.fileName}
                      </span>
                    </div>
                    <button 
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                      onClick={onClearSelectedSource}
                    >
                      Clear
                    </button>
                  </div>
                  
                  <div style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    alignSelf: 'flex-start'
                  }}>
                    Page {selectedSource.pageNumber}
                  </div>

                  <div className="source-highlight-block" style={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}>
                    "{selectedSource.text}"
                  </div>
                </div>

                <div style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0 4px'
                }}>
                  <Search size={12} />
                  <span>This passage was retrieved as context to ground the LLM's response.</span>
                </div>
              </div>
            ) : (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
                border: '1px dashed rgba(255,255,255,0.05)',
                borderRadius: 'var(--radius-md)'
              }}>
                <BookOpen size={24} style={{ marginBottom: '10px', color: 'rgba(255,255,255,0.1)' }} /><br/>
                No citation selected.<br/>
                Click a source badge `[Source X]` in the chat to highlight its reference text here.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
