import React from 'react';

interface StatusBarProps {
    charCount: number;
    rawCharCount: number;
    selectionCount: number | null;
    lineCount: number;
    pageCount: number;
    encoding: string;
}

// 項目区切り用のセパレータ。opacity で控えめに表示する
const Separator: React.FC = () => (
    <span style={{ opacity: 0.4 }}>│</span>
);

const StatusBar: React.FC<StatusBarProps> = ({ charCount, rawCharCount, selectionCount, lineCount, pageCount, encoding }) => {
    return (
        <div className="status-bar" style={{ height: '30px', background: '#e0e0e0', display: 'flex', alignItems: 'center', padding: '0 1rem', fontSize: '12px', gap: '20px', borderTop: '1px solid #ccc' }}>
            <span>文字数: {charCount.toLocaleString('ja-JP')}</span>
            <Separator />
            <span>改行・空白込: {rawCharCount.toLocaleString('ja-JP')}</span>
            {selectionCount !== null && selectionCount > 0 && (
                <>
                    <Separator />
                    <span>選択: {selectionCount.toLocaleString('ja-JP')}字</span>
                </>
            )}
            <Separator />
            <span>行数: {lineCount.toLocaleString('ja-JP')}</span>
            <Separator />
            <span>ページ: {pageCount.toFixed(1)}</span>
            <Separator />
            <span>エンコード: {encoding}</span>
        </div>
    );
};

export default StatusBar;
