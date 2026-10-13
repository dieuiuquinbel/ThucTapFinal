import React from 'react';

// Xử lý in đậm inline và trích dẫn [1], [2]
export function renderInlineFormattedText(text) {
  if (!text) return null;
  const tokens = text.split(/(\*\*.*?\*\*|\[\d+\])/g);

  return tokens.map((tok, idx) => {
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
      const boldContent = tok.slice(2, -2).trim();
      return (
        <strong key={idx} className="font-bold text-slate-900 bg-amber-50/90 px-1 py-0.5 rounded text-[13px] border border-amber-200/60">
          {boldContent}
        </strong>
      );
    }
    const citationMatch = tok.match(/^\[(\d+)\]$/);
    if (citationMatch) {
      return (
        <span 
          key={idx} 
          className="inline-flex items-center px-1.5 py-0.2 mx-0.5 text-[11px] font-bold text-blue-700 bg-blue-100/90 border border-blue-300 rounded font-mono shadow-3xs"
          title={`Trích dẫn nguồn [${citationMatch[1]}]`}
        >
          [{citationMatch[1]}]
        </span>
      );
    }
    const cleanTok = tok.replace(/\\\*/g, '*').replace(/(?<!\*)\*(?!\*)/g, '');
    return <span key={idx}>{cleanTok}</span>;
  });
}

// Component hiển thị nội dung tóm tắt gọn gàng: Section heading + list item dạng ghi chú sách
export default function RichContentRenderer({ text }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let currentParagraph = [];
  let listBuffer = []; // Gom nhiều bullet liên tiếp vào 1 khối

  const flushParagraph = (keyPrefix) => {
    if (currentParagraph.length > 0) {
      const pText = currentParagraph.join(' ').trim();
      if (pText) {
        elements.push(
          <p key={`${keyPrefix}-${elements.length}`} className="leading-relaxed text-slate-700 my-1.5 text-[13px]">
            {renderInlineFormattedText(pText)}
          </p>
        );
      }
      currentParagraph = [];
    }
  };

  const flushListBuffer = (keyPrefix) => {
    if (listBuffer.length > 0) {
      elements.push(
        <div key={`list-${keyPrefix}`} className="my-2 ml-1 space-y-1 border-l-2 border-indigo-200 pl-3.5">
          {listBuffer.map((item) => item)}
        </div>
      );
      listBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      flushParagraph(`p-${i}`);
      flushListBuffer(i);
      continue;
    }

    // 1. Tiêu đề lớn: ### hoặc ## hoặc PHẦN N: hoặc chữ in hoa dạng "1. CÁC KHÁI NIỆM..."
    const headingMatch = line.match(/^(?:###?\s*\d*\.?\s*|PHẦN\s+\d+\s*[:\-]?\s*)(.+)$/i);
    if (headingMatch) {
      flushParagraph(`head-${i}`);
      flushListBuffer(i);
      const headingTitle = headingMatch[1].replace(/\*\*/g, '').trim();
      elements.push(
        <div key={`h-${i}`} className="mt-5 mb-2 p-2.5 rounded-lg bg-gradient-to-r from-blue-50 via-indigo-50/50 to-transparent border-l-4 border-blue-500 flex items-center gap-2 text-blue-900 font-bold text-[13px]">
          <span>{headingTitle}</span>
        </div>
      );
      continue;
    }

    // 2. Sub-heading: **a. Tiêu đề** hoặc **I. Tiêu đề** hoặc **Nguồn gốc nhận thức** (dòng chỉ có bold)
    const subHeadingMatch = line.match(/^\*\*(.*?)\*\*\s*$/);
    if (subHeadingMatch && !line.includes(':')) {
      flushParagraph(`subh-${i}`);
      flushListBuffer(i);
      const subTitle = subHeadingMatch[1].trim();
      elements.push(
        <div key={`sh-${i}`} className="mt-3 mb-1.5 font-semibold text-indigo-800 text-[13px] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
          <span>{subTitle}</span>
        </div>
      );
      continue;
    }

    // 3. Concept item: "- **Khái niệm**: Giải thích..." hoặc "1. **Khái niệm**: Giải thích..."
    const conceptMatch = line.match(/^(\d+[\.)]|[-*•])\s*\*\*(.*?)\*\*\s*[:\-]?\s*(.*)$/);
    if (conceptMatch) {
      flushParagraph(`c-${i}`);
      const conceptName = conceptMatch[2].trim();
      const explanation = conceptMatch[3].trim();

      listBuffer.push(
        <div key={`item-${i}`} className="py-1">
          <span className="font-semibold text-slate-900 text-[13px]">{conceptName}</span>
          {explanation && (
            <span className="text-slate-600 text-[13px]">
              {': '}{renderInlineFormattedText(explanation)}
            </span>
          )}
        </div>
      );
      continue;
    }

    // 4. Gạch đầu dòng thông thường (không có bold title): "- nội dung"
    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph(`b-${i}`);
      listBuffer.push(
        <div key={`b-${i}`} className="flex items-start gap-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-2 shrink-0"></span>
          <span className="text-slate-700 text-[13px] leading-relaxed">
            {renderInlineFormattedText(bulletMatch[1])}
          </span>
        </div>
      );
      continue;
    }

    // 5. Đoạn văn xuôi thông thường
    currentParagraph.push(line);
  }

  flushParagraph('final');
  flushListBuffer('final');

  return <div className="space-y-0.5">{elements}</div>;
}
