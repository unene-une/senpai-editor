import React from 'react';
import { AlertTriangle, XCircle } from 'lucide-react';
import { ProofingIssue } from '../utils/proofreader';

interface ProofingPanelProps {
    issues: ProofingIssue[];
    onJump: (line: number) => void;
    onClose: () => void;
}

const typeColor: Record<ProofingIssue['type'], string> = {
    duplicate: '#e6a800',
    typo: '#d32f2f',
    bracket: '#1565c0',
    style: '#6a1b9a',
};

const ProofingPanel: React.FC<ProofingPanelProps> = ({ issues, onJump, onClose }) => {
    return (
        <div className="proofing-panel" style={{
            width: '260px',
            background: 'var(--sidebar-bg)',
            color: 'var(--app-text)',
            height: '100%',
            borderLeft: '1px solid var(--sidebar-border)',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div className="panel-header" style={{
                padding: '0.5rem 0.75rem',
                borderBottom: '1px solid var(--sidebar-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <strong style={{ fontSize: '14px' }}>校正結果 ({issues.length}件)</strong>
                <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'inherit' }}>
                    <XCircle size={16} />
                </button>
            </div>
            <div className="issues-list" style={{ flex: 1, overflowY: 'auto' }}>
                {issues.length === 0 ? (
                    <div style={{ padding: '1rem', color: 'var(--app-text)', opacity: 0.5, textAlign: 'center', fontSize: '13px' }}>
                        指摘事項はありません
                    </div>
                ) : (
                    issues.map(issue => (
                        <div
                            key={issue.id}
                            className="issue-item"
                            onClick={() => issue.line > 0 && onJump(issue.line)}
                            style={{
                                padding: '0.5rem 0.75rem',
                                borderBottom: '1px solid var(--sidebar-border)',
                                cursor: issue.line > 0 ? 'pointer' : 'default',
                                fontSize: '12px',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: typeColor[issue.type], fontWeight: 'bold', marginBottom: '2px' }}>
                                <AlertTriangle size={12} />
                                <span>{issue.line > 0 ? `${issue.line}行目` : '全体'}</span>
                            </div>
                            <div style={{ marginBottom: '2px', color: 'var(--app-text)' }}>{issue.message}</div>
                            <div style={{ color: 'var(--app-text)', opacity: 0.6, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                「{issue.context}」
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ProofingPanel;
