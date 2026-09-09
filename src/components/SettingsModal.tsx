import React, { useState } from 'react';
import { X } from 'lucide-react';
import FocusTrap from 'focus-trap-react';
import { message, ask } from '@tauri-apps/plugin-dialog';
import { CustomDialog } from './CustomDialog';

interface Preset {
    id: string;
    name: string;
    countLineLength: number;
    countLinesPerPage: number;
    columnsPerPage: number;
}

interface Settings {
    visualLineLength: number;
    fontSize: number;
    countLineLength: number;
    countLinesPerPage: number;
    columnsPerPage: number;
    showWhitespace: boolean;
    verticalWriting: boolean;
    theme: 'light' | 'dark' | 'rainbow' | 'custom';
    customColors: {
        appBg: string;
        contentBg: string;
        editorText: string;
        sidebarBg: string;
        statusbarBg: string;
    },
    presets: Preset[];
    currentPresetId: string;
}

interface SettingsModalProps {
    settings: Settings;
    onSave: (newSettings: Settings) => void;
    onClose: () => void;
    onExport: (settings: Settings) => Promise<void>;
    onImport: () => Promise<Settings | null>;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose, onExport, onImport }) => {
    const [localSettings, setLocalSettings] = useState<Settings>(settings);
    // プリセット新規保存用ダイアログの表示状態。window.prompt は WebView2 で常に null を
    // 返すため、CustomDialog をこの FocusTrap のサブツリー内にインラインで描画する
    const [showPresetNameDialog, setShowPresetNameDialog] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        if (name.startsWith('color-')) {
            const colorKey = name.replace('color-', '');
            setLocalSettings(prev => ({
                ...prev,
                customColors: {
                    ...prev.customColors,
                    [colorKey]: value
                }
            }));
        } else {
            setLocalSettings(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : (type === 'number' ? (parseInt(value, 10) || 0) : value)
            }));
        }
    };

    const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const presetId = e.target.value;
        const preset = localSettings.presets.find(p => p.id === presetId);
        if (preset) {
            setLocalSettings(prev => ({
                ...prev,
                currentPresetId: presetId,
                countLineLength: preset.countLineLength,
                countLinesPerPage: preset.countLinesPerPage,
                columnsPerPage: preset.columnsPerPage
            }));
        }
    };

    const handleSaveAsNewPreset = () => {
        setShowPresetNameDialog(true);
    };

    const confirmSaveAsNewPreset = (name: string) => {
        setShowPresetNameDialog(false);
        if (!name) return;

        const newPreset: Preset = {
            id: Date.now().toString(),
            name: name,
            countLineLength: localSettings.countLineLength,
            countLinesPerPage: localSettings.countLinesPerPage,
            columnsPerPage: localSettings.columnsPerPage
        };

        setLocalSettings(prev => ({
            ...prev,
            presets: [...prev.presets, newPreset],
            currentPresetId: newPreset.id
        }));
    };

    const handleUpdatePreset = async () => {
        if (localSettings.currentPresetId === 'default') {
            await message('標準プリセットは上書きできません。新しいプリセットとして保存してください。', { title: '確認', kind: 'warning' });
            return;
        }

        setLocalSettings(prev => ({
            ...prev,
            presets: prev.presets.map(p => p.id === prev.currentPresetId ? {
                ...p,
                countLineLength: prev.countLineLength,
                countLinesPerPage: prev.countLinesPerPage,
                columnsPerPage: prev.columnsPerPage
            } : p)
        }));
        await message('プリセットを更新しました。', { title: '完了' });
    };

    const handleDeletePreset = async () => {
        if (localSettings.currentPresetId === 'default') {
            await message('標準プリセットは削除できません。', { title: '確認', kind: 'warning' });
            return;
        }

        const confirmed = await ask('このプリセットを削除してもよろしいですか？', {
            title: '確認',
            kind: 'warning',
            okLabel: '削除',
            cancelLabel: 'キャンセル'
        });
        if (!confirmed) return;

        const newPresets = localSettings.presets.filter(p => p.id !== localSettings.currentPresetId);
        setLocalSettings(prev => ({
            ...prev,
            presets: newPresets,
            currentPresetId: 'default',
            countLineLength: 40,
            countLinesPerPage: 20,
            columnsPerPage: 1
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(localSettings);
        onClose();
    };

    const handleImportClick = async () => {
        const result = await onImport();
        if (result) setLocalSettings(result);
    };

    return (
        <FocusTrap>
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
                    background: 'var(--content-bg, #ffffff)',
                    color: 'var(--app-text, #333333)',
                    padding: '2rem',
                    borderRadius: '8px',
                    width: '450px',
                    position: 'relative',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    border: '1px solid var(--sidebar-border, #cccccc)'
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
                    <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>設定 / Settings</h2>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                        <div style={{ borderBottom: '1px solid var(--sidebar-border, #cccccc)', paddingBottom: '1rem' }}>
                            <h3 style={{ fontSize: '16px', marginBottom: '0.8rem' }}>表示の設定 (Layout)</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <label htmlFor="visualLineLength">エディタの幅 (文字数):</label>
                                    <input type="number" id="visualLineLength" name="visualLineLength" value={localSettings.visualLineLength} onChange={handleChange} style={{ width: '60px', padding: '0.3rem', background: 'var(--app-bg, #f6f6f6)', color: 'var(--app-text, #333333)', border: '1px solid var(--sidebar-border, #cccccc)' }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <label htmlFor="fontSize">フォントサイズ (px):</label>
                                    <input type="number" id="fontSize" name="fontSize" value={localSettings.fontSize} onChange={handleChange} style={{ width: '60px', padding: '0.3rem', background: 'var(--app-bg, #f6f6f6)', color: 'var(--app-text, #333333)', border: '1px solid var(--sidebar-border, #cccccc)' }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <input type="checkbox" id="showWhitespace" name="showWhitespace" checked={localSettings.showWhitespace} onChange={handleChange} />
                                    <label htmlFor="showWhitespace">空白・改行を可視化する</label>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <input type="checkbox" id="verticalWriting" name="verticalWriting" checked={localSettings.verticalWriting} onChange={handleChange} />
                                    <label htmlFor="verticalWriting">縦書きモード</label>
                                </div>
                            </div>
                        </div>

                        <div style={{ borderBottom: '1px solid var(--sidebar-border, #cccccc)', paddingBottom: '1rem' }}>
                            <h3 style={{ fontSize: '16px', marginBottom: '0.8rem' }}>テーマ設定 (Theme)</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                                {(['light', 'dark', 'rainbow', 'custom'] as const).map(t => (
                                    <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                        <input type="radio" name="theme" value={t} checked={localSettings.theme === t} onChange={handleChange} />
                                        {t.charAt(0).toUpperCase() + t.slice(1)}
                                    </label>
                                ))}
                            </div>

                            {localSettings.theme === 'custom' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1rem', background: 'var(--app-bg, #f6f6f6)', borderRadius: '4px', border: '1px solid var(--sidebar-border, #cccccc)' }}>
                                    <h4 style={{ margin: 0, fontSize: '14px' }}>カスタムカラーの詳細設定</h4>
                                    {[
                                        { label: '全体背景', key: 'appBg' },
                                        { label: 'エディタ背景', key: 'contentBg' },
                                        { label: '本文文字色', key: 'editorText' },
                                        { label: 'サイドバー', key: 'sidebarBg' },
                                        { label: 'ステータスバー', key: 'statusbarBg' }
                                    ].map(c => (
                                        <div key={c.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <label style={{ fontSize: '13px' }}>{c.label}:</label>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <input type="text" name={`color-${c.key}`} value={localSettings.customColors[c.key as keyof typeof localSettings.customColors]} onChange={handleChange} style={{ width: '80px', fontSize: '12px', background: '#ffffff', color: '#333333', border: '1px solid #cccccc' }} />
                                                <input type="color" name={`color-${c.key}`} value={localSettings.customColors[c.key as keyof typeof localSettings.customColors]} onChange={handleChange} style={{ padding: 0, border: 'none', width: '24px', height: '24px', cursor: 'pointer' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <h3 style={{ fontSize: '16px', marginBottom: '0.8rem' }}>ページ計算の基準 (Manuscript)</h3>

                            {/* Preset Management UI */}
                            <div style={{ padding: '1rem', background: 'var(--app-bg, #f6f6f6)', borderRadius: '4px', border: '1px solid var(--sidebar-border, #cccccc)', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label style={{ fontSize: '13px', fontWeight: 'bold' }}>プリセットを選択:</label>
                                        <select
                                            value={localSettings.currentPresetId}
                                            onChange={handlePresetChange}
                                            style={{ width: '150px', padding: '0.2rem', background: '#ffffff', color: '#333333', border: '1px solid #cccccc' }}
                                        >
                                            {localSettings.presets.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <button type="button" onClick={handleSaveAsNewPreset} style={{ fontSize: '11px', padding: '4px 8px', cursor: 'pointer' }}>新規保存</button>
                                        <button type="button" onClick={handleUpdatePreset} style={{ fontSize: '11px', padding: '4px 8px', cursor: 'pointer' }} disabled={localSettings.currentPresetId === 'default'}>上書き</button>
                                        <button type="button" onClick={handleDeletePreset} style={{ fontSize: '11px', padding: '4px 8px', cursor: 'pointer', color: '#ff4d4f' }} disabled={localSettings.currentPresetId === 'default'}>削除</button>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <label htmlFor="countLineLength">1行あたりの文字数:</label>
                                    <input type="number" id="countLineLength" name="countLineLength" value={localSettings.countLineLength} onChange={handleChange} style={{ width: '60px', padding: '0.3rem', background: '#f6f6f6', color: '#333333', border: '1px solid #cccccc' }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <label htmlFor="countLinesPerPage">1段あたりの行数:</label>
                                    <input type="number" id="countLinesPerPage" name="countLinesPerPage" value={localSettings.countLinesPerPage} onChange={handleChange} style={{ width: '60px', padding: '0.3rem', background: '#f6f6f6', color: '#333333', border: '1px solid #cccccc' }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <label htmlFor="columnsPerPage">1ページあたりの段組み数:</label>
                                    <input type="number" id="columnsPerPage" name="columnsPerPage" value={localSettings.columnsPerPage} onChange={handleChange} style={{ width: '60px', padding: '0.3rem', background: '#f6f6f6', color: '#333333', border: '1px solid #cccccc' }} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 style={{ fontSize: '16px', marginBottom: '0.8rem' }}>バックアップ (Backup)</h3>
                            <div style={{ padding: '1rem', background: 'var(--app-bg, #f6f6f6)', borderRadius: '4px', border: '1px solid var(--sidebar-border, #cccccc)' }}>
                                <p style={{ fontSize: '12px', opacity: 0.8, margin: 0 }}>
                                    テーマ・プリセット・表示設定・開いているフォルダをJSONファイルに保存／復元できます。
                                </p>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '0.8rem' }}>
                                    <button type="button" onClick={() => onExport(localSettings)} style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer' }}>設定を書き出す</button>
                                    <button type="button" onClick={handleImportClick} style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer' }}>設定を読み込む</button>
                                </div>
                            </div>
                        </div>

                        <button type="submit" style={{
                            marginTop: '0.5rem',
                            padding: '0.75rem',
                            background: '#4a90d9',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}>
                            保存する / Save Settings
                        </button>
                    </form>
                </div>

                <CustomDialog
                    open={showPresetNameDialog}
                    inputMode
                    title="新規プリセット"
                    message="新しいプリセット名を入力してください:"
                    onConfirm={confirmSaveAsNewPreset}
                    onCancel={() => setShowPresetNameDialog(false)}
                />
            </div>
        </FocusTrap>
    );
};

export default SettingsModal;
