import React, { useState } from 'react';
import { X, Folder } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

interface NewProjectConfig {
    parentDir: string;
    folderName: string;
    fileBaseName: string;
    fileCount: number;
    encoding: 'UTF-8' | 'Shift-JIS';
}

interface NewProjectModalProps {
    onSave: (config: NewProjectConfig) => void;
    onClose: () => void;
}

const NewProjectModal: React.FC<NewProjectModalProps> = ({ onSave, onClose }) => {
    const [config, setConfig] = useState<NewProjectConfig>({
        parentDir: '',
        folderName: 'New Project',
        fileBaseName: 'chapter',
        fileCount: 2,
        encoding: 'UTF-8'
    });

    const handleSelectDir = async () => {
        const selected = await openDialog({
            directory: true,
            multiple: false,
        });
        if (selected && typeof selected === 'string') {
            setConfig(prev => ({ ...prev, parentDir: selected }));
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setConfig(prev => ({
            ...prev,
            [name]: type === 'number' ? (parseInt(value, 10) || 0) : value
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!config.parentDir) {
            alert('親ディレクトリを選択してください。');
            return;
        }
        onSave(config);
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000
        }}>
            <div className="modal-content" style={{
                background: '#ffffff',
                color: '#333333',
                padding: '2rem',
                borderRadius: '8px',
                width: '450px',
                position: 'relative',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                border: '1px solid #cccccc'
            }}>
                <button onClick={onClose} style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'inherit'
                }}>
                    <X size={20} />
                </button>
                <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>新規プロジェクト作成</h2>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label>親ディレクトリ:</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input type="text" value={config.parentDir} readOnly style={{ flex: 1, padding: '0.4rem', background: '#f6f6f6', color: '#333333', border: '1px solid #cccccc' }} />
                            <button type="button" onClick={handleSelectDir} style={{ padding: '0.4rem 0.8rem', background: '#f0f0f0', color: '#333333', border: '1px solid #cccccc', cursor: 'pointer' }}>
                                <Folder size={16} />
                            </button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label>フォルダ名:</label>
                        <input type="text" name="folderName" value={config.folderName} onChange={handleChange} style={{ padding: '0.4rem', background: '#f6f6f6', color: '#333333', border: '1px solid #cccccc' }} required />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label>ファイル名のベース (例: chapter → chapter1.txt):</label>
                        <input type="text" name="fileBaseName" value={config.fileBaseName} onChange={handleChange} style={{ padding: '0.4rem', background: '#f6f6f6', color: '#333333', border: '1px solid #cccccc' }} required />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label>作成するファイル数:</label>
                        <input type="number" name="fileCount" value={config.fileCount} onChange={handleChange} style={{ padding: '0.4rem', background: '#f6f6f6', color: '#333333', border: '1px solid #cccccc' }} min="1" max="100" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label>文字コード:</label>
                        <select name="encoding" value={config.encoding} onChange={handleChange} style={{ padding: '0.4rem', background: '#f6f6f6', color: '#333333', border: '1px solid #cccccc' }}>
                            <option value="UTF-8">UTF-8</option>
                            <option value="Shift-JIS">Shift-JIS</option>
                        </select>
                    </div>
                    <button type="submit" style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem',
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}>
                        作成を開始する
                    </button>
                </form>
            </div>
        </div>
    );
};

export default NewProjectModal;
