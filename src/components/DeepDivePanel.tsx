'use client';
import { useStore } from '@/store/useStore';
import { useCallback } from 'react';

// Simple markdown renderer (no extra dependency needed)
function renderMarkdown(text: string): string {
  return text
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$2</h2>'.replace('$2', '$1'))
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, match => `<ul>${match}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h|u|l])/gm, '')
    .replace(/\n/g, '<br/>');
}

export default function DeepDivePanel() {
  const { deepDiveContent, setDeepDive, selectedNodeId, nodes } = useStore();

  const handleExportPDF = useCallback(async () => {
    if (!deepDiveContent) return;
    const selectedNode = nodes.find(n => n.id === selectedNodeId);
    const title = selectedNode?.data?.label ?? 'Deep Dive Report';

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;

    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138);
    doc.text('ThinkBox — Deep Dive Report', margin, 20);

    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, 32);

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 36, pageWidth - margin, 36);

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);

    // Strip markdown markers for PDF
    const cleanText = deepDiveContent
      .replace(/^#+\s/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '');

    const lines = doc.splitTextToSize(cleanText, maxWidth);
    let y = 44;
    const lineHeight = 5.5;
    const pageHeight = doc.internal.pageSize.getHeight() - margin;

    for (const line of lines) {
      if (y + lineHeight > pageHeight) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }

    doc.save(`thinkbox-deep-dive-${Date.now()}.pdf`);
  }, [deepDiveContent, selectedNodeId, nodes]);

  if (!deepDiveContent) return null;

  return (
    <div className="deep-dive-panel">
      <div className="deep-dive-header">
        <h2 className="deep-dive-title">🔬 Deep Dive Report</h2>
        <div className="deep-dive-actions">
          <button className="pdf-btn" onClick={handleExportPDF} title="Export to PDF">
            📄 Export PDF
          </button>
          <button className="close-btn" onClick={() => setDeepDive(null)}>✕</button>
        </div>
      </div>
      <div
        className="deep-dive-content"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(deepDiveContent) }}
      />
    </div>
  );
}
