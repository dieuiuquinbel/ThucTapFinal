import { useState } from 'react';
import axios, { API_BASE } from '../api/client';

export function useSummary() {
  const [sumDoc, setSumDoc] = useState(() => localStorage.getItem('smartstudy_sum_doc') || '');
  const [sumStyle, setSumStyle] = useState(() => localStorage.getItem('smartstudy_sum_style') || 'Trung bình');
  const [summaryResult, setSummaryResult] = useState(null);
  const [sumLoading, setSumLoading] = useState(false);

  const handleGenerateSummary = async (overrideStyle = null, overrideDoc = null) => {
    const targetDoc = (typeof overrideDoc === 'string' && overrideDoc.trim()) ? overrideDoc : sumDoc;
    if (!targetDoc) {
      alert('Vui lòng chọn tài liệu để tóm tắt!');
      return;
    }
    const targetStyle = (typeof overrideStyle === 'string' && overrideStyle.trim()) ? overrideStyle : sumStyle;
    setSumLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/summarize`, {
        document_source: targetDoc,
        style: targetStyle
      });
      if (res.data.success) {
        setSummaryResult(res.data);
      } else {
        alert('Lỗi khi tóm tắt: ' + res.data.text);
      }
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSumLoading(false);
    }
  };

  return {
    sumDoc,
    setSumDoc,
    sumStyle,
    setSumStyle,
    summaryResult,
    setSummaryResult,
    sumLoading,
    handleGenerateSummary
  };
}
