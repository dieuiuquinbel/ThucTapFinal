import { useState, useCallback } from 'react';

export function useNoticeModal() {
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'confirm',
    title: '',
    message: '',
    confirmText: 'Xác nhận',
    cancelText: 'Hủy bỏ',
    confirmVariant: 'danger',
    onConfirm: null
  });

  const closeModal = useCallback(() => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }, []);

  const showConfirm = useCallback(({
    title = 'Xác nhận hành động',
    message,
    confirmText = 'Đồng ý',
    cancelText = 'Hủy bỏ',
    confirmVariant = 'danger',
    onConfirm
  }) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      confirmText,
      cancelText,
      confirmVariant,
      onConfirm
    });
  }, []);

  const showAlert = useCallback(({
    title = 'Thông báo',
    message,
    type = 'info'
  }) => {
    setModalConfig({
      isOpen: true,
      type,
      title,
      message,
      confirmText: 'Đã hiểu rồi',
      cancelText: '',
      confirmVariant: 'primary',
      onConfirm: null
    });
  }, []);

  return {
    modalConfig,
    closeModal,
    showConfirm,
    showAlert
  };
}
