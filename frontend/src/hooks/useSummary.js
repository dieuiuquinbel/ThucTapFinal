import { useState } from 'react';
import axios, { API_BASE } from '../api/client';

export function useSummary({ showAlert } = {}) {
  const [sumDoc, setSumDoc] = useState(() => localStorage.getItem('smartstudy_sum_doc') || '');
  const [sumStyle, setSumStyle] = useState(() => localStorage.getItem('smartstudy_sum_style') || 'Trung bình');
  const [summaryResult, setSummaryResult] = useState(null);
  const [sumLoading, setSumLoading] = useState(false);

  const handleGenerateSummary = async (overrideStyle = null, overrideDoc = null) => {
    const targetDoc = (typeof overrideDoc === 'string' && overrideDoc.trim()) ? overrideDoc : sumDoc;
    if (!targetDoc) {
      if (showAlert) {
        showAlert({ title: 'Chưa chọn bài học 📚', message: 'Vui lòng chọn tài liệu để tạo Sổ tay tóm tắt!', type: 'warning' });
      } else {
        alert('Vui lòng chọn tài liệu để tóm tắt!');
      }
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
        const textErr = res.data.text || 'Không thể tạo bản tóm tắt';
        if (showAlert) {
          showAlert({ title: 'Lỗi tóm tắt ⚠️', message: textErr, type: 'warning' });
        } else {
          alert('Lỗi khi tóm tắt: ' + textErr);
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message;
      if (showAlert) {
        showAlert({ title: 'Lỗi kết nối ❌', message: 'Không thể tóm tắt: ' + errMsg, type: 'error' });
      } else {
        alert('Lỗi: ' + errMsg);
      }
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
