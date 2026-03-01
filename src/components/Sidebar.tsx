import React from 'react';
import { Folder, FileText, Settings, PlusSquare } from 'lucide-react';

interface FileItem {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: FileItem[];
}

interface FolderItem {
    name: string;
    path: string;
    files: FileItem[];
}

interface SidebarProps {
    folders: FolderItem[];
    onSelect: (file: FileItem) => void;
    onSettingsClick: () => void;
    onOpenFolder: () => void;
    onNewProject: () => void;
    onRemoveFolder: (folderPath: string) => void;
    onFileContextMenu?: (e: React.MouseEvent, file: FileItem) => void;
    currentFilePath: string | null;
    dirtyFiles: Set<string>;
}

const Sidebar: React.FC<SidebarProps> = ({ folders, onSelect, onSettingsClick, onOpenFolder, onNewProject, onRemoveFolder, onFileContextMenu, currentFilePath, dirtyFiles }) => {
    const renderFileItem = (item: FileItem) => {
        const isActive = item.path === currentFilePath;
        return (
            <div
                key={item.path}
                className="file-item"
                onClick={() => onSelect(item)}
                onContextMenu={(e) => onFileContextMenu?.(e, item)}
                style={{
                    paddingLeft: '1.5rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 0 4px 1.5rem',
                    background: isActive ? 'var(--accent-color, #4a9eff)' : 'transparent',
                    color: isActive ? '#fff' : 'inherit',
                    borderRadius: '4px',
                    fontWeight: isActive ? 'bold' : 'normal',
                }}
            >
                <FileText size={14} />
                <span style={{ fontSize: '14px' }}>
                    {item.name}
                    {dirtyFiles.has(item.path) && (
                        <span style={{ color: isActive ? '#ffd' : 'var(--accent-color)', marginLeft: '4px', fontSize: '10px' }}>●</span>
                    )}
                </span>
            </div>
        );
    };

    const renderFolder = (folder: FolderItem) => (
        <div key={folder.path} className="folder-group" style={{ marginBottom: '1rem' }}>
            <div className="folder-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: 'var(--statusbar-bg)', fontWeight: 'bold', fontSize: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Folder size={16} />
                    <span>{folder.name}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onRemoveFolder(folder.path); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontSize: '16px', lineHeight: 1, color: 'inherit' }}>×</button>
            </div>
            <div className="folder-files">
                {folder.files.map(renderFileItem)}
            </div>
        </div>
    );

    return (
        <div className="sidebar" style={{ width: '250px', background: 'var(--sidebar-bg)', height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--sidebar-border)', color: 'var(--app-text)' }}>
            <div className="sidebar-header" style={{ padding: '1rem', fontWeight: 'bold' }}>
                執筆タイトル
            </div>
            <div className="file-list" style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                {folders.map(renderFolder)}
            </div>
            <div className="sidebar-footer" style={{ padding: '1rem', borderTop: '1px solid var(--sidebar-border)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <button onClick={onNewProject} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit' }}>
                    <PlusSquare size={16} />
                    新規タイトル
                </button>
                <button onClick={onOpenFolder} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit' }}>
                    <Folder size={16} />
                    フォルダを開く
                </button>
                <button onClick={onSettingsClick} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit' }}>
                    <Settings size={16} />
                    設定
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
