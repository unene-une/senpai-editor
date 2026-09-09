import React, { useEffect, useRef, useState } from 'react';
import './CustomDialog.css';
import { refocusWindow } from '../utils/dialog';

interface CustomDialogProps {
    open: boolean;
    title?: string;
    message: string;
    /** true にすると入力欄付き（window.prompt の代替）になる */
    inputMode?: boolean;
    defaultValue?: string;
    placeholder?: string;
    /** inputMode のときは入力値が渡る。それ以外は空文字 */
    onConfirm?: (value: string) => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
}

/**
 * window.prompt / confirm の代替ダイアログ。
 * WebView2 は prompt() を実装していない（常に null）ため、アプリ内で描画する。
 */
export const CustomDialog: React.FC<CustomDialogProps> = ({
    open,
    title = '確認',
    message,
    inputMode = false,
    defaultValue = '',
    placeholder,
    onConfirm,
    onCancel,
    confirmText = 'OK',
    cancelText = 'キャンセル',
}) => {
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);
    // IME 変換中の Enter で確定しないようにする
    const isComposingRef = useRef(false);

    // 開くたびに初期値へ戻し、入力欄へフォーカスする
    useEffect(() => {
        if (!open) return;
        // 保険: ネイティブダイアログ以外が原因でウィンドウのキーボードフォーカスを
        // 失っていた場合でも、この入力欄を出す時点で拾い直せるようにする
        void refocusWindow();
        setValue(defaultValue);
        if (inputMode) {
            // FocusTrap 内でも確実にフォーカスが移るよう、描画後に実行
            const id = requestAnimationFrame(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            });
            return () => cancelAnimationFrame(id);
        }
    }, [open, defaultValue, inputMode]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && onCancel) {
                e.stopPropagation();
                onCancel();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onCancel]);

    if (!open) return null;

    const confirm = () => onConfirm?.(inputMode ? value : '');

    return (
        <div className="custom-dialog-overlay" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="custom-dialog">
                {title && <h2 className="custom-dialog-title">{title}</h2>}
                <div className="custom-dialog-message">{message}</div>
                {inputMode && (
                    <input
                        ref={inputRef}
                        className="custom-dialog-input"
                        type="text"
                        value={value}
                        placeholder={placeholder}
                        onChange={(e) => setValue(e.target.value)}
                        onCompositionStart={() => { isComposingRef.current = true; }}
                        onCompositionEnd={() => { isComposingRef.current = false; }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isComposingRef.current) {
                                e.preventDefault();
                                confirm();
                            }
                        }}
                    />
                )}
                <div className="custom-dialog-actions">
                    {onCancel && (
                        <button type="button" className="custom-dialog-button" onClick={onCancel}>
                            {cancelText}
                        </button>
                    )}
                    <button type="button" className="custom-dialog-button primary" onClick={confirm}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
