import { useState, useEffect, useRef } from 'react';
import axios, { API_BASE } from '../api/client';

export function useDocuments({ onDocsLoaded, onDocDeleted, showConfirm, showAlert } = {}) {
  const [systemStatus, setSystemStatus] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDocFilter, setSelectedDocFilter] = useState('Tất cả tài liệu');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState('');
  const uploadAbortRef = useRef(null);

  const fetchStatusAndDocs = async () => {
    try {
      const [resStatus, resDocs] = await Promise.all([
        axios.get(`${API_BASE}/status`),
        axios.get(`${API_BASE}/documents`)
      ]);
      setSystemStatus(resStatus.data);
      setDocuments(resDocs.data);
      if (resDocs.data && resDocs.data.length > 0 && onDocsLoaded) {
        onDocsLoaded(resDocs.data);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu khởi tạo:', err);
    }
  };

  useEffect(() => {
    fetchStatusAndDocs();
    const interval = setInterval(fetchStatusAndDocs, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCancelUpload = () => {
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort();
      uploadAbortRef.current = null;
    }
    setUploading(false);
    setUploadProgress(0);
    setUploadStep('');
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    setUploading(true);
    setUploadProgress(5);
    setUploadStep('Đang tải tệp lên server...');

    const controller = new AbortController();
    uploadAbortRef.current = controller;
    const uploadStartTime = Date.now();

    const progressTimer = setInterval(() => {
      const elapsed = Math.round((Date.now() - uploadStartTime) / 1000);
      setUploadProgress(prev => {
        const current = Math.round(prev);
        if (current < 25) {
          setUploadStep(`Đang trích xuất văn bản... (${elapsed}s)`);
          return current + 5;
        } else if (current < 60) {
          setUploadStep(`Đang nhúng vector BGE-M3... (${elapsed}s)`);
          return current + 4;
        } else if (current < 85) {
          setUploadStep(`Đang lưu chỉ mục ChromaDB... (${elapsed}s)`);
          return current + 2;
        } else if (current < 95) {
          setUploadStep(`Sắp hoàn tất, vui lòng chờ... (${elapsed}s)`);
          return current + 1;
        }
        return 95;
      });
    }, 800);

    try {
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: controller.signal,
        timeout: 180000
      });
      clearInterval(progressTimer);

      const failed = res.data?.details?.filter(d => d.status === 'error') || [];
      if (failed.length > 0) {
        const errorMsgs = failed.map(f => `• ${f.filename}: ${f.error}`).join('\n');
        if (showAlert) {
          showAlert({ title: 'Thông báo tải tài liệu ⚠️', message: errorMsgs, type: 'warning' });
        } else {
          alert(`Thông báo tải tài liệu:\n${errorMsgs}`);
        }
      }

      setUploadProgress(100);
      setUploadStep(failed.length > 0 ? '⚠️ Hoàn tất có cảnh báo' : '✅ Hoàn tất!');
      await fetchStatusAndDocs();
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        setUploadStep('');
      }, 1200);
    } catch (err) {
      clearInterval(progressTimer);
      if (axios.isCancel(err) || err.name === 'CanceledError') {
        setUploading(false);
        setUploadProgress(0);
        setUploadStep('');
      } else if (err.code === 'ECONNABORTED') {
        const timeoutMsg = 'Quá thời gian xử lý (>180s). Hãy thử tải lên tài liệu nhỏ hơn hoặc kiểm tra Ollama.';
        if (showAlert) {
          showAlert({ title: 'Quá thời gian xử lý ⏳', message: timeoutMsg, type: 'warning' });
        } else {
          alert(timeoutMsg);
        }
        setUploading(false);
        setUploadProgress(0);
        setUploadStep('');
      } else {
        const errMsg = 'Lỗi khi xử lý tài liệu: ' + (err.response?.data?.detail || err.message);
        if (showAlert) {
          showAlert({ title: 'Lỗi tải tệp tin ❌', message: errMsg, type: 'error' });
        } else {
          alert(errMsg);
        }
        setUploading(false);
        setUploadProgress(0);
        setUploadStep('');
      }
    } finally {
      uploadAbortRef.current = null;
      e.target.value = null;
    }
  };

  const handleDeleteDoc = (sourceName) => {
    const doDelete = async () => {
      try {
        await axios.delete(`${API_BASE}/documents/${encodeURIComponent(sourceName)}`);
        if (onDocDeleted) {
          onDocDeleted(sourceName);
        }
        await fetchStatusAndDocs();
      } catch (err) {
        if (showAlert) {
          showAlert({ title: 'Lỗi xóa tài liệu ❌', message: 'Lỗi: ' + err.message, type: 'error' });
        } else {
          alert('Lỗi khi xóa tài liệu: ' + err.message);
        }
      }
    };

    if (showConfirm) {
      showConfirm({
        title: 'Xác nhận xóa tài liệu 🗑️',
        message: `Bạn có chắc chắn muốn xóa tài liệu "${sourceName}"?\nHệ thống sẽ xóa toàn bộ vector, cache tóm tắt và cache đề thi tương ứng.`,
        confirmText: 'Đồng ý xóa',
        cancelText: 'Hủy bỏ',
        confirmVariant: 'danger',
        onConfirm: doDelete
      });
    } else {
      if (!window.confirm(`Bạn có chắc chắn muốn xóa tài liệu "${sourceName}"?`)) return;
      doDelete();
    }
  };

  return {
    systemStatus,
    documents,
    selectedDocFilter,
    setSelectedDocFilter,
    uploading,
    uploadProgress,
    uploadStep,
    fetchStatusAndDocs,
    handleFileUpload,
    handleCancelUpload,
    handleDeleteDoc
  };
}
