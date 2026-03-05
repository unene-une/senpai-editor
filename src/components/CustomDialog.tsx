import React, { useEffect } from 'react';
import './CustomDialog.css';

interface CustomDialogProps {
    open: boolean;
    title?: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
}

export const CustomDialog: React.FC<CustomDialogProps> = ({
    open,
    title = '確認',
    message,
    onConfirm,
    onCancel,
    confirmText = 'OK',
    cancelText = 'キャンセル',
}) => {
    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && onCancel) {
                onCancel();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onCancel]);

    if (!open) return null;

    return (
        <div className="custom-dialog-overlay" role="dialog" aria-modal="true">
            <div className="custom-dialog">
                {title && <h2 className="custom-dialog-title">{title}</h2>}
                <div className="custom-dialog-message">{message}</div>
                <div className="custom-dialog-actions">
                    {onCancel && (
                        <button className="custom-dialog-button" onClick={onCancel}>
                            {cancelText}
                        </button>
                    )}
                    {onConfirm && (
                        <button className="custom-dialog-button" onClick={onConfirm}>
                            {confirmText}
                        </button>
                    )}
                    {!onConfirm && !onCancel && (
                        <button className="custom-dialog-button" onClick={onCancel || onConfirm || (() => { })}>
                            {confirmText}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
