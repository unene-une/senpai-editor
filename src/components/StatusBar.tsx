import React from 'react';

interface StatusBarProps {
    charCount: number;
    lineCount: number;
    pageCount: number;
    encoding: string;
}

const StatusBar: React.FC<StatusBarProps> = ({ charCount, lineCount, pageCount, encoding }) => {
    return (
        <div className="status-bar" style={{ height: '30px', background: '#e0e0e0', display: 'flex', alignItems: 'center', padding: '0 1rem', fontSize: '12px', gap: '20px', borderTop: '1px solid #ccc' }}>
            <span>Characters: {charCount}</span>
            <span>Lines: {lineCount}</span>
            <span>Pages: {pageCount.toFixed(1)}</span>
            <span>Encoding: {encoding}</span>
        </div>
    );
};

export default StatusBar;
