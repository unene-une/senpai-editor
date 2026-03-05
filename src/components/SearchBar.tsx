import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ChevronUp, ChevronDown, Replace, Search } from 'lucide-react';

interface SearchBarProps {
    content: string;
    onContentChange: (newContent: string) => void;
    onClose: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ content, onContentChange, onClose }) => {
    const [inputValue, setInputValue] = useState(''); // 入力欄の表示値（常に同期）
    const [query, setQuery] = useState('');            // 検索クエリ（IME確定後のみ更新）
    const [replaceText, setReplaceText] = useState('');
    const [showReplace, setShowReplace] = useState(false);
    const [matchCase, setMatchCase] = useState(false);
    const [currentMatch, setCurrentMatch] = useState(0);
    const [matches, setMatches] = useState<number[]>([]);
    const queryRef = useRef<HTMLInputElement>(null);
    // IME変換中フラグ（nativeEvent.isComposingよりも信頼性が高い）
    const isComposingRef = useRef(false);

    // マッチ位置を計算
    useEffect(() => {
        if (!query) {
            setMatches([]);
            setCurrentMatch(0);
            return;
        }
        try {
            const flags = matchCase ? 'g' : 'gi';
            const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
            const found: number[] = [];
            let m;
            while ((m = regex.exec(content)) !== null) {
                found.push(m.index);
            }
            setMatches(found);
            setCurrentMatch(prev => Math.min(prev, Math.max(0, found.length - 1)));
        } catch {
            setMatches([]);
        }
    }, [query, content, matchCase]);

    // textarea にフォーカスして選択
    const selectMatch = useCallback((index: number) => {
        if (matches.length === 0 || index < 0) return;
        const textarea = document.querySelector('.editor-textarea') as HTMLTextAreaElement;
        if (!textarea) return;

        const pos = matches[index];
        textarea.focus();
        textarea.setSelectionRange(pos, pos + query.length);

        // スクロール位置を合わせる
        const linesBefore = content.substring(0, pos).split('\n');
        const fontSize = parseFloat(getComputedStyle(textarea).fontSize);
        const lineHeightPx = fontSize * 1.8;
        const scrollTarget = (linesBefore.length - 1) * lineHeightPx - textarea.clientHeight / 3;
        textarea.scrollTop = Math.max(0, scrollTarget);
    }, [matches, query, content]);

    const goNext = useCallback(() => {
        const next = matches.length > 0 ? (currentMatch + 1) % matches.length : 0;
        setCurrentMatch(next);
        selectMatch(next);
    }, [currentMatch, matches, selectMatch]);

    const goPrev = useCallback(() => {
        const prev = matches.length > 0 ? (currentMatch - 1 + matches.length) % matches.length : 0;
        setCurrentMatch(prev);
        selectMatch(prev);
    }, [currentMatch, matches, selectMatch]);

    // キー操作 — isComposingRef で IME 変換中は無視
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isComposingRef.current) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            e.shiftKey ? goPrev() : goNext();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    const handleReplaceCurrent = () => {
        if (matches.length === 0) return;
        const pos = matches[currentMatch];
        const newContent = content.substring(0, pos) + replaceText + content.substring(pos + query.length);
        onContentChange(newContent);
    };

    const handleReplaceAll = () => {
        if (!query) return;
        try {
            const flags = matchCase ? 'g' : 'gi';
            const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
            const newContent = content.replace(regex, replaceText);
            onContentChange(newContent);
        } catch {
            // 無効な正規表現は無視
        }
    };

    useEffect(() => {
        queryRef.current?.focus();
    }, []);

    useEffect(() => {
        if (matches.length > 0) selectMatch(currentMatch);
    }, [matches, currentMatch, selectMatch]);

    const btnStyle: React.CSSProperties = {
        border: '1px solid var(--sidebar-border)',
        background: 'var(--app-bg)',
        color: 'var(--app-text)',
        borderRadius: '4px',
        padding: '2px 8px',
        cursor: 'pointer',
        fontSize: '12px',
        whiteSpace: 'nowrap',
    };

    const inputStyle: React.CSSProperties = {
        background: 'var(--app-bg)',
        color: 'var(--app-text)',
        border: '1px solid var(--sidebar-border)',
        borderRadius: '4px',
        padding: '3px 8px',
        fontSize: '13px',
        outline: 'none',
        width: '200px',
    };

    return (
        <div style={{
            position: 'absolute',
            top: '8px',
            right: '60px',
            zIndex: 200,
            background: 'var(--content-bg)',
            border: '1px solid var(--sidebar-border)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            minWidth: '360px',
        }}>
            {/* 検索行 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Search size={14} style={{ color: 'var(--app-text)', opacity: 0.6, flexShrink: 0 }} />
                <input
                    ref={queryRef}
                    style={inputStyle}
                    placeholder="検索..."
                    value={inputValue}
                    onChange={e => {
                        setInputValue(e.target.value); // 常に表示を更新
                        if (!isComposingRef.current) {
                            setQuery(e.target.value); // 変換中でなければ検索も更新
                            setCurrentMatch(0);
                        }
                    }}
                    onCompositionStart={() => { isComposingRef.current = true; }}
                    onCompositionEnd={e => {
                        isComposingRef.current = false;
                        const val = (e.target as HTMLInputElement).value;
                        setInputValue(val);
                        setQuery(val); // 確定後に検索実行
                        setCurrentMatch(0);
                    }}
                    onKeyDown={handleKeyDown}
                />
                <span style={{ fontSize: '12px', opacity: 0.7, whiteSpace: 'nowrap', minWidth: '50px', color: 'var(--app-text)' }}>
                    {matches.length > 0 ? `${currentMatch + 1} / ${matches.length}` : query ? '見つかりません' : ''}
                </span>
                <button style={btnStyle} onClick={goPrev} title="前へ (Shift+Enter)"><ChevronUp size={14} /></button>
                <button style={btnStyle} onClick={goNext} title="次へ (Enter)"><ChevronDown size={14} /></button>
                <label title="大文字/小文字を区別する" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', cursor: 'pointer', color: 'var(--app-text)', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={matchCase} onChange={e => setMatchCase(e.target.checked)} />
                    <span style={{ fontWeight: 'bold' }}>Aa</span> 大文字/小文字区別
                </label>
                <button style={btnStyle} onClick={() => setShowReplace(v => !v)} title="置換">
                    <Replace size={14} />
                </button>
                <button style={{ ...btnStyle, border: 'none', background: 'transparent', padding: '2px 4px' }} onClick={onClose}>
                    <X size={14} />
                </button>
            </div>

            {/* 置換行 */}
            {showReplace && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: 14, flexShrink: 0 }} />
                    <input
                        style={inputStyle}
                        placeholder="置換後..."
                        value={replaceText}
                        onChange={e => setReplaceText(e.target.value)}
                        onKeyDown={e => { if (!isComposingRef.current && e.key === 'Escape') onClose(); }}
                    />
                    <button style={btnStyle} onClick={handleReplaceCurrent} disabled={matches.length === 0}>置換</button>
                    <button style={btnStyle} onClick={handleReplaceAll} disabled={matches.length === 0}>すべて置換</button>
                </div>
            )}
        </div>
    );
};

export default SearchBar;
