import { useModal as useModalContext, SweetAlert, ModalConfig } from '../utils/modal';

export const useModal = () => {
  const modal = useModalContext();

  return {
    ...modal,
    alert: (title: string, message?: string) => {
      modal.show(SweetAlert.info(title, message));
    },
    success: (title: string, message?: string) => {
      modal.show(SweetAlert.success(title, message));
    },
    error: (title: string, message?: string) => {
      modal.show(SweetAlert.error(title, message));
    },
    warning: (title: string, message?: string) => {
      modal.show(SweetAlert.warning(title, message));
    },
    confirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
      modal.show(SweetAlert.confirm(title, message, onConfirm, onCancel));
    },
    delete: (title: string, message: string, onDelete: () => void, onCancel?: () => void) => {
      modal.show(SweetAlert.delete(title, message, onDelete, onCancel));
    },
    custom: (config: ModalConfig) => {
      modal.show(config);
    },
  };
};

export default useModal;
