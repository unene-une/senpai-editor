import React, { CSSProperties } from 'react';

interface EditorProps {
    content: string;
    onChange: (newContent: string) => void;
    settings: {
        lineLength: number;
        fontSize: number;
        verticalWriting?: boolean;
        showWhitespace?: boolean;
    };
    onContextMenu?: (e: React.MouseEvent) => void;
}

const Editor: React.FC<EditorProps> = ({ content, onChange, settings, onContextMenu }) => {
    const lineHeightPx = Math.round(settings.fontSize * 1.8);
    const commonStyle: CSSProperties = {
        fontSize: `${settings.fontSize}px`,
        width: `calc(${settings.lineLength + 1}em + 4rem)`,
        maxWidth: '100%',
        lineHeight: `${lineHeightPx}px`,
        fontFamily: '"BIZ UDGothic", "MS Gothic", "Cascadia Code", "Consolas", "Inconsolata", monospace',
        padding: '2rem',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        boxSizing: 'border-box',
        letterSpacing: '0px',
        tabSize: 4,
        fontVariantLigatures: 'none',
    };

    const textareaStyle: CSSProperties = {
        ...commonStyle,
        margin: '0',
        outline: 'none',
        border: 'none',
        resize: 'none',
        height: '100%',
        overflowY: 'auto',
        background: 'transparent',
        color: 'inherit',
        position: 'relative',
        zIndex: 1,
    };

    const backdropStyle: CSSProperties = {
        ...commonStyle,
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        color: 'transparent',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
        border: 'none',
        margin: '0',
    };

    // 空白記号を直接文字として描画（元文字の幅を変えない）
    const renderBackdropContent = () => {
        if (!settings.showWhitespace) return null;

        return content.split('\n').map((line, i, arr) => {
            const elements: React.ReactNode[] = [];
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                if (char === ' ') {
                    elements.push(
                        <span key={j} style={{
                            display: 'inline-block',
                            overflow: 'visible',
                            color: 'var(--ws-color)',
                        }}>·</span>
                    );
                } else if (char === '　') {
                    elements.push(
                        <span key={j} style={{
                            display: 'inline-block',
                            overflow: 'visible',
                            color: 'var(--ws-color)',
                        }}>□</span>
                    );
                } else if (char === '\t') {
                    elements.push(
                        <span key={j} style={{
                            display: 'inline-block',
                            overflow: 'visible',
                            color: 'var(--ws-color)',
                        }}>»</span>
                    );
                } else {
                    elements.push(<span key={j} style={{ color: 'transparent' }}>{char}</span>);
                }
            }

            return (
                <React.Fragment key={i}>
                    {elements}
                    {/* 改行記号: width:0 で折り返し幅に影響させない */}
                    <span style={{
                        display: 'inline-block',
                        width: 0,
                        overflow: 'visible',
                        whiteSpace: 'nowrap',
                        color: 'var(--ws-newline-color)',
                        opacity: 0.8,
                        verticalAlign: 'top',
                    }}>↵</span>
                    {i < arr.length - 1 && '\n'}
                </React.Fragment>
            );
        });
    };


    return (
        <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden', scrollbarGutter: 'stable' }}>
            {settings.showWhitespace && (
                <div style={backdropStyle} className="editor-backdrop">
                    {renderBackdropContent()}
                </div>
            )}
            <textarea
                value={content}
                onChange={(e) => onChange(e.target.value)}
                style={textareaStyle}
                className="editor-textarea"
                spellCheck={false}
                onContextMenu={onContextMenu}
                onScroll={(e) => {
                    const backdrop = e.currentTarget.parentElement?.querySelector('.editor-backdrop');
                    if (backdrop) {
                        backdrop.scrollTop = e.currentTarget.scrollTop;
                        backdrop.scrollLeft = e.currentTarget.scrollLeft;
                    }
                }}
            />
        </div>
    );
};

export default Editor;
