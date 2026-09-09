import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import "./App.css";
import Editor from "./components/Editor";
import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import { open as openDialog, save, ask, message } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readDir } from '@tauri-apps/plugin-fs';
import { openUrl } from '@tauri-apps/plugin-opener';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { defaultSettings, AppSettings, createSettingsBackup, parseSettingsBackup } from './settings';

// Define FileItem type locally for now
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

// ファイルバッファの型定義（コンポーネント外に定義してレンダリングごとの再定義を回避）
// caret*/scroll* は既存バッファとの互換のため省略可能。無い場合は 0 として扱う
type FileBuffer = {
  content: string;
  encoding: string;
  isDirty: boolean;
  originalContent: string;
  caretStart?: number;
  caretEnd?: number;
  scrollTop?: number;
  scrollLeft?: number;
};

import { checkProofing, ProofingIssue } from "./utils/proofreader";
import { scrollCaretIntoView } from "./utils/caret";
import ProofingPanel from "./components/ProofingPanel";
import SettingsModal from "./components/SettingsModal";
import NewProjectModal from "./components/NewProjectModal";
import SearchBar from "./components/SearchBar";
import { CustomDialog } from "./components/CustomDialog";
import { CheckCircle } from "lucide-react";
import Encoding from 'encoding-japanese';

interface ProjectConfig {
  parentDir: string;
  folderName: string;
  fileBaseName: string;
  fileCount: number;
  encoding: 'UTF-8' | 'Shift-JIS';
}

// 全角=2、半角=1 で文字幅を計算する
function getStringWidth(str: string): number {
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // 半角: ASCII, 半角カナ (0xFF61-0xFF9F)
    if (code <= 0x7E || (code >= 0xFF61 && code <= 0xFF9F)) {
      width += 1;
    } else {
      width += 2;
    }
  }
  return width;
}

/**
 * 16進数カラーコードをRGBに変換
 */
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

/**
 * 背景色に基づいて適切なコントラストのカラーを返す
 */
function getContrastColor(hex: string, strength: number = 0.3) {
  const rgb = hexToRgb(hex);
  // YIQ方式で明るさを判定 (0-255)
  const yiq = ((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000;
  // 暗い背景には白っぽく、明るい背景には黒っぽく
  if (yiq < 128) {
    return `rgba(255, 255, 255, ${strength})`;
  } else {
    return `rgba(0, 0, 0, ${strength})`;
  }
}

function App() {
  const [content, setContent] = useState("");
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [settings, setSettings] = useState(defaultSettings);
  // 設定インポート後に Sidebar を強制的に再マウントし、localStorage の sidebarWidth を読み直させる
  const [sidebarKey, setSidebarKey] = useState(0);


  const [currentEncoding, setCurrentEncoding] = useState("UTF-8");
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  // isDirty state を廃止し dirtyFileSet に一本化

  // textarea への参照（querySelectorでの都度探索を廃止し一本化）
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ファイルバッファ: ファイルパス -> { content, encoding, isDirty, originalContent }
  const fileBuffers = useRef<Map<string, FileBuffer>>(new Map());
  // 未保存ファイルセット（再描画のためにstateにも持つ）
  const [dirtyFileSet, setDirtyFileSet] = useState<Set<string>>(new Set());
  const dirtyFileSetRef = useRef<Set<string>>(new Set()); // onCloseRequested用
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const markDirty = (path: string) => {
    dirtyFileSetRef.current = new Set(dirtyFileSetRef.current).add(path);
    setDirtyFileSet(prev => { const s = new Set(prev); s.add(path); return s; });
  };
  const unmarkDirty = (path: string) => {
    const next = new Set(dirtyFileSetRef.current); next.delete(path);
    dirtyFileSetRef.current = next;
    setDirtyFileSet(prev => { const s = new Set(prev); s.delete(path); return s; });
  };

  // Settings Persistence Logic (localStorage使用 - Tauriの権限に依存しない)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('app-settings');
      if (saved) {
        const savedSettings = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...savedSettings }));

      }
    } catch (err) {
      console.error("[Settings] Failed to load settings:", err);
    }
  }, []);

  const saveSettingsToFile = (newSettings: AppSettings) => {
    try {
      localStorage.setItem('app-settings', JSON.stringify(newSettings));

    } catch (err) {
      console.error("[Settings] Failed to save settings:", err);
    }
  };

  // ウィンドウサイズの保存・復元
  useEffect(() => {
    const restoreWindowSize = async () => {
      try {
        const saved = localStorage.getItem('window-size');
        if (!saved) return;
        const parsed = JSON.parse(saved);
        // 保存値は論理px（unit: 'logical'）のものだけを信頼する。
        // 旧形式（unitが無い = 物理pxがそのまま入っている値）は
        // 表示スケール分だけ膨張した壊れた値なので、変換せず無視する。
        if (parsed.unit !== 'logical') return;
        const { width, height } = parsed;
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;

        const { getCurrentWindow, currentMonitor } = await import('@tauri-apps/api/window');
        const { LogicalSize } = await import('@tauri-apps/api/dpi');

        const monitor = await currentMonitor();
        if (!monitor) return; // モニタ情報が取れない場合はデフォルトサイズのままにする（誤ったサイズを適用するより安全）

        // 画面の作業領域（タスクバーを除く）を超えるサイズにはしない。
        // これを怠るとWebView2が描画面を確保できずフリーズすることがある。
        const bounds = monitor.workArea.size.toLogical(monitor.scaleFactor);
        const w = Math.min(Math.max(width, 400), bounds.width);
        const h = Math.min(Math.max(height, 300), bounds.height);

        const win = getCurrentWindow();
        await win.setSize(new LogicalSize(w, h));
      } catch (err) {
        console.error("[Window] Failed to restore window size:", err);
      }
    };
    restoreWindowSize();
  }, []);

  useEffect(() => {
    let unlisten: any;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const setupResizeListener = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        unlisten = await win.onResized(({ payload: size }) => {
          // onResized はドラッグ中に連続発火するため、保存はデバウンスしてIPCの連打を避ける
          if (saveTimer) clearTimeout(saveTimer);
          saveTimer = setTimeout(async () => {
            try {
              // size は物理px（PhysicalSize）。そのまま保存すると復元時に
              // LogicalSizeとして適用され、表示スケール分だけ膨張してしまうため
              // 論理pxに変換してから保存する。
              const factor = await win.scaleFactor();
              const logical = size.toLogical(factor);
              localStorage.setItem('window-size', JSON.stringify({
                width: Math.round(logical.width),
                height: Math.round(logical.height),
                unit: 'logical',
              }));
            } catch (err) {
              console.error("[Window] Failed to save window size:", err);
            }
          }, 300);
        });
      } catch (err) {
        console.error("[Window] Failed to setup resize listener:", err);
      }
    };
    setupResizeListener();
    return () => {
      if (saveTimer) clearTimeout(saveTimer);
      if (typeof unlisten === 'function') unlisten();
    };
  }, []);

  // onCloseRequested クロージャ内で参照できるように ref で持つ
  const currentFilePathRef = useRef<string | null>(null);
  useEffect(() => { currentFilePathRef.current = currentFilePath; }, [currentFilePath]);

  const currentEncodingRef = useRef<string>("UTF-8");
  useEffect(() => { currentEncodingRef.current = currentEncoding; }, [currentEncoding]);


  // UseEffect for Close Confirmation
  const isClosingRef = useRef(false);
  useEffect(() => {
    let unlisten: any;

    const setupListener = async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();

      unlisten = await win.onCloseRequested((event) => {
        if (isClosingRef.current) return;

        // dirtyFileSetRef で全ダーティファイルを確認
        const dirtyPaths = Array.from(dirtyFileSetRef.current);

        if (dirtyPaths.length > 0) {
          event.preventDefault();
          const names = dirtyPaths.map(p => p.split(/[\\/]/).pop()).join('\n');
          const msg = dirtyPaths.length === 1
            ? '変更が保存されていません。終了しますか？'
            : `${dirtyPaths.length}件のファイルに未保存の変更があります:\n${names}\n\n終了しますか？`;
          ask(msg, {
            title: '警告',
            kind: 'warning',
            okLabel: 'はい',
            cancelLabel: 'いいえ'
          }).then(async (confirmed) => {
            if (confirmed) {
              isClosingRef.current = true;
              try {
                await win.destroy();
              } catch (e) {
                console.error("destroy() failed, falling back to close():", e);
                try { await win.close(); } catch (e2) { console.error(e2); }
              }
            }
          });
        }
      });
    };

    setupListener();
    return () => {
      if (typeof unlisten === 'function') unlisten();
    };
  }, []);

  // 外部変更検出: currentFilePath が変わるたびにウォッチャーをセットアップ
  const isAskingReloadRef = useRef(false);
  // パスごとに「自アプリが最後に書き込んだ時刻」を記録し、直後の watch イベントを無視する。
  // グローバルな真偽値だと、あるファイルの保存中は他ファイルの本当の外部変更まで握りつぶしてしまう
  const recentlySavedRef = useRef<Map<string, number>>(new Map());
  const markSaved = (path: string) => {
    recentlySavedRef.current.set(path, Date.now());
  };
  const wasRecentlySaved = (path: string, withinMs = 2000) => {
    const savedAt = recentlySavedRef.current.get(path);
    return savedAt !== undefined && Date.now() - savedAt < withinMs;
  };
  useEffect(() => {
    if (!currentFilePath) return;

    let unwatchFn: (() => void) | null = null;
    const watchedPath = currentFilePath;

    const setupWatch = async () => {
      try {
        const { watchImmediate } = await import('@tauri-apps/plugin-fs');
        unwatchFn = await watchImmediate(watchedPath, (_event) => {

          if (isAskingReloadRef.current || wasRecentlySaved(watchedPath)) return;
          handleExternalChange(watchedPath);
        }, { recursive: false });

      } catch (err) {
        console.error('[Watch] Failed to watch file:', err);
      }
    };

    const handleExternalChange = async (filePath: string) => {
      if (isAskingReloadRef.current || wasRecentlySaved(filePath)) return;

      try {
        const { readFile } = await import('@tauri-apps/plugin-fs');
        const uint8Array = await readFile(filePath);
        const encoding = Encoding.detect(uint8Array);
        const decoded = Encoding.convert(uint8Array, {
          to: 'UNICODE',
          from: encoding || 'AUTO',
          type: 'string'
        });
        const normalized = (decoded as string).replace(/\r\n/g, '\n');

        const existingBuffer = fileBuffers.current.get(filePath);
        if (existingBuffer && (existingBuffer.content === normalized || existingBuffer.originalContent === normalized)) {
          // 前回保存時あるいは現在のエディタ内容と同一なら、自アプリの保存イベントの遅延か実質無変更とみなして無視する
          return;
        }
      } catch (err) {
        console.error('[Watch] Failed to read file for comparison:', err);
        // 読み込めない(削除・リネームで消えた)ファイルは再読み込みを提案する対象ではないため、ダイアログを出さずに終了する
        return;
      }

      isAskingReloadRef.current = true;
      try {
        const confirmed = await ask(
          `ファイルが外部で変更されました:\n${filePath.split(/[\\/]/).pop()}\n\n再読み込みしますか？`,
          { title: 'ファイル変更検出', kind: 'info', okLabel: 'はい', cancelLabel: 'いいえ' }
        );
        if (confirmed) {
          await readFileWithEncoding(filePath);
        }
      } catch (err) {
        console.error('[Watch] Failed to handle external change:', err);
      } finally {
        isAskingReloadRef.current = false;
      }
    };

    setupWatch();
    return () => {
      if (unwatchFn) unwatchFn();
    };
  }, [currentFilePath]);

  // オートセーブ機能(20分間隔)
  useEffect(() => {
    const intervalId = setInterval(async () => {
      const dirtyPaths = Array.from(dirtyFileSetRef.current);
      if (dirtyPaths.length === 0) return;

      let savedCount = 0;
      for (const path of dirtyPaths) {
        const buf = fileBuffers.current.get(path);
        // 保存不要ならスキップ
        if (!buf || !buf.isDirty) continue;

        try {
          // 書き込み中に watch イベントが先着しても無視できるよう、書く前にも記録する
          markSaved(path);
          if (buf.encoding === 'Shift-JIS') {
            const { writeFile } = await import('@tauri-apps/plugin-fs');
            const unicodeCodes = Encoding.stringToCode(buf.content);
            const sjisCodes = Encoding.convert(unicodeCodes, { to: 'SJIS', from: 'UNICODE' });
            await writeFile(path, new Uint8Array(sjisCodes));
          } else {
            const { writeTextFile } = await import('@tauri-apps/plugin-fs');
            await writeTextFile(path, buf.content);
          }

          markSaved(path);
          fileBuffers.current.set(path, { ...buf, isDirty: false, originalContent: buf.content });
          unmarkDirty(path);
          savedCount++;
        } catch (err) {
          console.error(`Auto-save failed for ${path}:`, err);
        }
      }

      if (savedCount > 0) {
        setToastMessage('自動保存完了');
        setTimeout(() => setToastMessage(null), 3000);
      }
    }, 20 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  // Handle content change to set dirty + バッファ同期
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    if (currentFilePathRef.current) {
      const path = currentFilePathRef.current;
      const existing = fileBuffers.current.get(path);
      const original = existing?.originalContent ?? '';
      const isChanged = newContent !== original;
      fileBuffers.current.set(path, {
        content: newContent,
        encoding: currentEncodingRef.current,
        isDirty: isChanged,
        originalContent: original,
      });
      if (isChanged) {
        markDirty(path);
      } else {
        unmarkDirty(path);
      }
    }
    // Refを使うので依存なし（意図的）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string; type?: 'editor' | 'file'; targetFile?: FileItem } | null>(null);
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // キーボードショートカット（handleSave/handleOpenFolderは後方定義なのでRefで参照）
  const handleSaveRef = useRef<(() => void) | null>(null);
  const handleOpenFolderRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      switch (e.key) {
        case 'f':
          e.preventDefault();
          setShowSearch(true);
          break;
        case 's':
          e.preventDefault();
          handleSaveRef.current?.();
          break;
        case 'o':
          e.preventDefault();
          handleOpenFolderRef.current?.();
          break;
        case 'n':
          e.preventDefault();
          setShowNewProjectModal(true);
          break;
        case ',':
          e.preventDefault();
          setShowSettings(true);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.style.setProperty('--app-bg', '#2f2f2f');
      root.style.setProperty('--app-text', '#f6f6f6');
      root.style.setProperty('--content-bg', '#1a1a1a');
      root.style.setProperty('--sidebar-bg', '#252525');
      root.style.setProperty('--sidebar-border', '#444');
      root.style.setProperty('--statusbar-bg', '#333');
      root.style.setProperty('--statusbar-border', '#444');
      root.style.setProperty('--editor-bg', '#1a1a1a');
      root.style.setProperty('--editor-text', '#f0f0f0');
      root.style.setProperty('--ws-color', '#555');
      root.style.setProperty('--ws-newline-color', '#444');
      root.style.setProperty('--menu-hover', '#444');
      root.style.setProperty('--accent-color', '#3a8ee6');
    } else if (settings.theme === 'rainbow') {
      root.style.setProperty('--app-bg', 'transparent');
      root.style.setProperty('--app-text', '#fff');
      root.style.setProperty('--content-bg', 'rgba(255, 255, 255, 0.1)');
      root.style.setProperty('--sidebar-bg', 'rgba(0, 0, 0, 0.3)');
      root.style.setProperty('--sidebar-border', 'rgba(255, 255, 255, 0.3)');
      root.style.setProperty('--statusbar-bg', 'rgba(0, 0, 0, 0.4)');
      root.style.setProperty('--statusbar-border', 'rgba(255, 255, 255, 0.3)');
      root.style.setProperty('--editor-bg', 'transparent');
      root.style.setProperty('--editor-text', '#fff');
      root.style.setProperty('--ws-color', 'rgba(255, 255, 255, 0.5)');
      root.style.setProperty('--ws-newline-color', 'rgba(255, 255, 255, 0.5)');
      root.style.setProperty('--menu-hover', 'rgba(255, 255, 255, 0.2)');
      root.style.setProperty('--accent-color', 'rgba(255, 255, 255, 0.4)');
    } else if (settings.theme === 'custom') {
      const c = settings.customColors;
      root.style.setProperty('--app-bg', c.appBg);
      root.style.setProperty('--app-text', c.editorText);
      root.style.setProperty('--content-bg', c.contentBg);
      root.style.setProperty('--sidebar-bg', c.sidebarBg);
      root.style.setProperty('--statusbar-bg', c.statusbarBg);
      root.style.setProperty('--editor-bg', c.contentBg);
      root.style.setProperty('--editor-text', c.editorText);
      root.style.setProperty('--sidebar-border', 'rgba(0,0,0,0.1)');
      root.style.setProperty('--statusbar-border', 'rgba(0,0,0,0.1)');
      root.style.setProperty('--ws-color', getContrastColor(c.contentBg, 0.4));
      root.style.setProperty('--ws-newline-color', getContrastColor(c.contentBg, 0.6));
      root.style.setProperty('--accent-color', '#4a9eff');
    } else {
      root.style.removeProperty('--app-bg');
      root.style.removeProperty('--app-text');
      root.style.removeProperty('--content-bg');
      root.style.removeProperty('--sidebar-bg');
      root.style.removeProperty('--sidebar-border');
      root.style.removeProperty('--statusbar-bg');
      root.style.removeProperty('--statusbar-border');
      root.style.removeProperty('--editor-bg');
      root.style.removeProperty('--editor-text');
      root.style.removeProperty('--ws-color');
      root.style.removeProperty('--ws-newline-color');
      root.style.removeProperty('--menu-hover');
    }
  }, [settings.theme, settings.customColors]);

  // フォルダパスをlocalStorageに保存するヘルパー
  const saveFolderPaths = (updatedFolders: FolderItem[]) => {
    const paths = updatedFolders.map(f => f.path);
    localStorage.setItem('open-folders', JSON.stringify(paths));
  };

  // フォルダを読み込む共通処理
  const loadFolderFromPath = async (folderPath: string): Promise<FolderItem | null> => {
    try {
      const folderName = folderPath.split(/[\\/]/).pop() || folderPath;
      const entries = await readDir(folderPath);
      const folderItems: FileItem[] = entries
        .filter(e => e.name)
        .map(e => ({
          name: e.name,
          path: `${folderPath}/${e.name}`,
          type: (e.isDirectory ? 'folder' : 'file') as 'file' | 'folder',
        }))
        .filter(e => e.type === 'file' && e.name.endsWith('.txt'))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      return { name: folderName, path: folderPath, files: folderItems };
    } catch {
      return null; // フォルダが見つからない場合はスキップ
    }
  };

  // 起動時にフォルダを復元
  useEffect(() => {
    const restoreFolders = async () => {
      try {
        const savedPaths = localStorage.getItem('open-folders');
        if (!savedPaths) return;
        const paths: string[] = JSON.parse(savedPaths);
        const loaded = await Promise.all(paths.map(loadFolderFromPath));
        const valid = loaded.filter((f): f is FolderItem => f !== null);
        if (valid.length > 0) setFolders(valid);
      } catch (err) {
        console.error("[Folder] Failed to restore folders:", err);
      }
    };
    restoreFolders();
  }, []);

  // File Operations
  const handleOpenFolder = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        const folder = await loadFolderFromPath(selected);
        if (!folder) return;
        setFolders(prev => {
          if (prev.some(f => f.path === selected)) return prev;
          const next = [...prev, folder];
          saveFolderPaths(next);
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to open folder:", err);
    }
  };
  useEffect(() => {
    handleOpenFolderRef.current = handleOpenFolder;
  });

  const handleRemoveFolder = (folderPath: string) => {
    setFolders(prev => {
      const next = prev.filter(f => f.path !== folderPath);
      saveFolderPaths(next);
      return next;
    });
  };

  // Improved read with encoding
  const readFileWithEncoding = async (path: string) => {
    try {
      const { readFile } = await import('@tauri-apps/plugin-fs');
      const uint8Array = await readFile(path);
      const encoding = Encoding.detect(uint8Array);
      const decoded = Encoding.convert(uint8Array, {
        to: 'UNICODE',
        from: encoding || 'AUTO',
        type: 'string'
      });
      const normalized = (decoded as string).replace(/\r\n/g, '\n');
      setContent(normalized);
      setCurrentEncoding(encoding === 'SJIS' ? 'Shift-JIS' : 'UTF-8');
      setCurrentFilePath(path);
      // 読み込み後はバッファに originalContent をセット（正規化済み）
      fileBuffers.current.set(path, {
        content: normalized,
        encoding: encoding === 'SJIS' ? 'Shift-JIS' : 'UTF-8',
        isDirty: false,
        originalContent: normalized,
        caretStart: 0,
        caretEnd: 0,
        scrollTop: 0,
        scrollLeft: 0,
      });
      unmarkDirty(path);
    } catch (err) {
      console.error("Failed to read file with encoding:", err);
    }
  };

  const handleSelectFileWrapper = async (file: FileItem) => {
    if (file.type !== 'file') return;

    // 1. 現在ファイルの状態をバッファに保存（content/isDirty は handleContentChange が
    //    毎回更新済みなので再計算せず、既存バッファに caret/スクロール位置だけ足し込む）
    if (currentFilePathRef.current) {
      const path = currentFilePathRef.current;
      const existing = fileBuffers.current.get(path);
      const textarea = textareaRef.current;
      const caretFields = {
        caretStart: textarea?.selectionStart ?? 0,
        caretEnd: textarea?.selectionEnd ?? 0,
        scrollTop: textarea?.scrollTop ?? 0,
        scrollLeft: textarea?.scrollLeft ?? 0,
      };
      fileBuffers.current.set(path, existing
        ? { ...existing, ...caretFields }
        : {
          content,
          encoding: currentEncoding,
          isDirty: dirtyFileSet.has(path),
          originalContent: content,
          ...caretFields,
        });
    }

    // 2. 新ファイルがバッファにあれば従下保存済みの内容を復元
    const buffered = fileBuffers.current.get(file.path);
    if (buffered) {
      setContent(buffered.content);
      setCurrentFilePath(file.path);
      setCurrentEncoding(buffered.encoding);
      // isDirty stateはないので何もしない（dirtyFileSetに入っていれば殊画される）
    } else {
      // 3. バッファになければディスクから読み込ゅ
      await readFileWithEncoding(file.path);
    }
  };

  // ファイル切替後、DOM更新が確定してから（描画前に）カーソル位置とスクロール位置を復元する
  useLayoutEffect(() => {
    if (!currentFilePath) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const buffer = fileBuffers.current.get(currentFilePath);
    if (!buffer) return;

    const caretStart = buffer.caretStart ?? 0;
    const caretEnd = buffer.caretEnd ?? 0;
    textarea.setSelectionRange(caretStart, caretEnd);
    textarea.scrollTop = buffer.scrollTop ?? 0;
    textarea.scrollLeft = buffer.scrollLeft ?? 0;
    // サイドバークリックでフォーカスが失われているため、戻さないと次のクリックで選択範囲が上書きされる
    textarea.focus();
  }, [currentFilePath]);

  const handleSave = async () => {
    try {
      let savedPath: string | null = currentFilePath;

      if (savedPath) {
        markSaved(savedPath); // 書き込み中の watch イベント対策（完了後にも再記録する）
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        if (currentEncoding === 'Shift-JIS') {
          const unicodeCodes = Encoding.stringToCode(content);
          const sjisCodes = Encoding.convert(unicodeCodes, { to: 'SJIS', from: 'UNICODE' });
          await writeFile(savedPath, new Uint8Array(sjisCodes));
        } else {
          await writeTextFile(savedPath, content);
        }
      } else {
        const selected = await save({
          filters: [{ name: 'Text', extensions: ['txt'] }]
        });
        if (selected) {
          markSaved(selected);
          if (currentEncoding === 'Shift-JIS') {
            const { writeFile } = await import('@tauri-apps/plugin-fs');
            const unicodeCodes = Encoding.stringToCode(content);
            const sjisCodes = Encoding.convert(unicodeCodes, { to: 'SJIS', from: 'UNICODE' });
            await writeFile(selected, new Uint8Array(sjisCodes));
          } else {
            await writeTextFile(selected, content);
          }
          setCurrentFilePath(selected);
          savedPath = selected;
        }
      }

      // dirty フラグをクリア
      if (savedPath) {
        markSaved(savedPath);
        fileBuffers.current.set(savedPath, {
          content, encoding: currentEncoding, isDirty: false,
          originalContent: content,
        });
        unmarkDirty(savedPath);
      }
    } catch (err) {
      console.error('Failed to save file:', err);
      await message(`保存に失敗しました:\n${err}`, { title: 'エラー', kind: 'error' });
    }
  };
  useEffect(() => {
    handleSaveRef.current = handleSave;
  });

  const handleHelpClick = async () => {
    try {
      // Create a new window for the help manual.
      new WebviewWindow('help-manual', {
        url: '/help.html',
        title: 'Senpai Editor ヘルプマニュアル',
        width: 900,
        height: 700,
        resizable: true,
      });
      // window.open('help.html', '_blank'); fallback removed or kept?
    } catch (err) {
      console.error("Failed to open help:", err);
      try {
        window.open('/help.html', '_blank');
      } catch (err2) {
        console.error("Failed to open help fallback:", err2);
        await message(`ヘルプマニュアルを開けませんでした。\nエラー: ${err}`, { title: 'エラー', kind: 'error' });
      }
    }
  };

  const [showProofing, setShowProofing] = useState(false);
  const [proofingIssues, setProofingIssues] = useState<ProofingIssue[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const handleProofing = () => {
    const issues = checkProofing(content);
    setProofingIssues(issues);
    setShowProofing(true);
  };

  const handleJumpToLine = (lineNumber: number) => {
    const textarea = textareaRef.current;
    if (!textarea || lineNumber <= 0) return;

    // 対象行の先頭文字インデックスを計算
    const lines = textarea.value.split('\n');
    const targetLine = Math.min(lineNumber - 1, lines.length - 1);
    let charIndex = 0;
    for (let i = 0; i < targetLine; i++) {
      charIndex += lines[i].length + 1; // +1 for '\n'
    }

    // カーソルを該当行の先頭に移動
    textarea.focus();
    textarea.setSelectionRange(charIndex, charIndex + (lines[targetLine]?.length ?? 0));

    // スクロール位置を実測して合わせる（縦書き・横書きどちらにも対応）
    scrollCaretIntoView(textarea, charIndex);
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettingsToFile(newSettings);
  };

  // 設定をJSONファイルに書き出す
  const handleExportSettings = async (settingsToExport: AppSettings) => {
    try {
      const path = await save({
        defaultPath: 'senpai-editor-settings.json',
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (!path) return; // キャンセル

      const openFolders = folders.map(f => f.path);
      const savedWidth = parseInt(localStorage.getItem('sidebarWidth') || '', 10);
      const sidebarWidth = Number.isFinite(savedWidth) ? savedWidth : null;

      const backup = createSettingsBackup(settingsToExport, openFolders, sidebarWidth);
      await writeTextFile(path, JSON.stringify(backup, null, 2));
      await message('設定を書き出しました。', { title: '完了' });
    } catch (err) {
      console.error('[Settings] Failed to export settings:', err);
      await message(`設定の書き出しに失敗しました:\n${err}`, { title: 'エラー', kind: 'error' });
    }
  };

  // JSONファイルから設定を読み込み、検証・適用する
  const handleImportSettings = async (): Promise<AppSettings | null> => {
    try {
      const selected = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (!selected || typeof selected !== 'string') return null; // キャンセル

      const { readFile } = await import('@tauri-apps/plugin-fs');
      const bytes = await readFile(selected);
      const text = new TextDecoder().decode(bytes);
      const parsed = parseSettingsBackup(text);

      // 設定を適用
      handleSaveSettings(parsed.settings);

      // フォルダをマージ（既に開いているものは除外し、見つからなかったものは数える）
      const newPaths = parsed.openFolders.filter(p => !folders.some(f => f.path === p));
      const loadedResults = await Promise.all(newPaths.map(loadFolderFromPath));
      const loaded = loadedResults.filter((f): f is FolderItem => f !== null);
      const skipped = loadedResults.length - loaded.length;

      const next = [...folders, ...loaded];
      saveFolderPaths(next);
      setFolders(next);

      // サイドバー幅を復元
      if (parsed.sidebarWidth !== null) {
        localStorage.setItem('sidebarWidth', String(parsed.sidebarWidth));
        setSidebarKey(k => k + 1);
      }

      await message(
        `設定を読み込みました。\nフォルダ: ${loaded.length}件復元${skipped > 0 ? `（見つからなかったフォルダ: ${skipped}件）` : ''}`,
        { title: '完了' }
      );

      return parsed.settings;
    } catch (err) {
      console.error('[Settings] Failed to import settings:', err);
      await message(`設定の読み込みに失敗しました:\n${err instanceof Error ? err.message : String(err)}`, { title: 'エラー', kind: 'error' });
      return null;
    }
  };

  const handleCreateProject = async (config: ProjectConfig) => {
    try {
      const { mkdir, writeFile } = await import('@tauri-apps/plugin-fs');
      const { join } = await import('@tauri-apps/api/path');
      const projectPath = await join(config.parentDir, config.folderName);


      await mkdir(projectPath, { recursive: true });

      const encoder = new TextEncoder();
      for (let i = 1; i <= config.fileCount; i++) {
        const fileName = `${config.fileBaseName}${i}.txt`;
        const filePath = await join(projectPath, fileName);


        try {
          if (config.encoding === 'Shift-JIS') {
            const unicodeCodes = Encoding.stringToCode("");
            const sjisCodes = Encoding.convert(unicodeCodes, {
              to: 'SJIS',
              from: 'UNICODE'
            });
            await writeFile(filePath, new Uint8Array(sjisCodes));
          } else {
            // Use writeFile even for UTF-8 for consistency in project creation
            await writeFile(filePath, encoder.encode(""));
          }
        } catch (fileErr) {
          console.error(`Failed to create file ${fileName}:`, fileErr);
          throw new Error(`ファイル ${fileName} の作成に失敗しました: ${fileErr}`);
        }
      }

      setShowNewProjectModal(false);
      // Auto-open the new folder
      const folderName = config.folderName;
      const entries = await readDir(projectPath);
      const folderItems: FileItem[] = [];

      for (const e of entries) {
        if (e.name) {
          const itemPath = await join(projectPath, e.name);
          folderItems.push({
            name: e.name,
            path: itemPath,
            type: (e.isDirectory ? 'folder' : 'file') as 'file' | 'folder',
          });
        }
      }

      const filteredItems = folderItems
        .filter(e => e.type === 'file' && e.name.endsWith('.txt'))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      setFolders(prev => [...prev, { name: folderName, path: projectPath, files: filteredItems }]);

    } catch (err) {
      console.error("Failed to create project:", err);
      await message(`プロジェクトの作成に失敗しました。\n理由: ${err instanceof Error ? err.message : String(err)}`, { title: 'エラー', kind: 'error' });
    }
  };

  // リネーム用ダイアログの対象（開いているときだけ非null）。window.prompt は WebView2 で
  // 常に null を返すため、アプリ内蔵の CustomDialog で入力を受け取る
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);

  const handleRenameFile = (file: FileItem) => {
    setRenameTarget(file);
    setContextMenu(null);
  };

  const performRename = async (file: FileItem, newName: string) => {
    if (!newName || newName === file.name) return;

    try {
      const { rename } = await import('@tauri-apps/plugin-fs');
      const { join, dirname } = await import('@tauri-apps/api/path');

      const parentDir = await dirname(file.path);
      const newPath = await join(parentDir, newName);

      // リネームは自アプリの変更なので、旧パス・新パスの両方で発生するwatchイベントを無視させる
      markSaved(file.path);
      markSaved(newPath);
      await rename(file.path, newPath);

      // Update folder list
      setFolders(prev => prev.map(folder => {
        if (file.path.startsWith(folder.path)) {
          return {
            ...folder,
            files: folder.files.map(f => f.path === file.path ? { ...f, name: newName, path: newPath } : f)
          };
        }
        return folder;
      }));

      // バッファを旧パスから新パスに移し替える
      const oldBuffer = fileBuffers.current.get(file.path);
      if (oldBuffer) {
        fileBuffers.current.set(newPath, oldBuffer);
        fileBuffers.current.delete(file.path);
      }
      // dirtyフラグも移し替える
      if (dirtyFileSetRef.current.has(file.path)) {
        unmarkDirty(file.path);
        markDirty(newPath);
      }

      // Update current file path if renamed
      if (currentFilePath === file.path) {
        setCurrentFilePath(newPath);
      }
    } catch (err) {
      console.error("Failed to rename file:", err);
      await message(`リネームに失敗しました: ${err}`, { title: 'エラー', kind: 'error' });
    }
  };

  // Context Menu Logic
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const selection = window.getSelection()?.toString();
    if (selection) {
      setContextMenu({ x: e.clientX, y: e.clientY, text: selection, type: 'editor' });
    }
  };

  const handleFileContextMenu = (e: React.MouseEvent, file: FileItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, text: file.name, type: 'file', targetFile: file });
  };

  // Page calculation logic
  // Calculate total logical lines based on countLineLength
  const calculateTotalLines = () => {
    const lines = content.split('\n');
    let totalLines = 0;
    lines.forEach(line => {
      // Empty line still counts as 1 line
      if (line.length === 0) {
        totalLines += 1;
      } else {
        totalLines += Math.ceil(getStringWidth(line) / (settings.countLineLength * 2));
      }
    });
    return totalLines;
  };

  const totalLinesCount = calculateTotalLines();
  const pageCount = totalLinesCount / (settings.countLinesPerPage * settings.columnsPerPage);

  return (
    <main className={`app-container ${settings.theme === 'rainbow' ? 'theme-rainbow' : ''}`}>
      <Sidebar
        key={sidebarKey}
        folders={folders}
        onSelect={handleSelectFileWrapper}
        onSettingsClick={() => setShowSettings(true)}
        onOpenFolder={handleOpenFolder}
        onNewProject={() => setShowNewProjectModal(true)}
        onRemoveFolder={handleRemoveFolder}
        onFileContextMenu={handleFileContextMenu}
        onHelpClick={handleHelpClick}
        currentFilePath={currentFilePath}
        dirtyFiles={dirtyFileSet}
      />
      <div className="content-area">
        <Editor
          textareaRef={textareaRef}
          content={content}
          onChange={handleContentChange}
          settings={{
            lineLength: settings.visualLineLength,
            fontSize: settings.fontSize,
            showWhitespace: settings.showWhitespace,
            verticalWriting: settings.verticalWriting
          }}
          onContextMenu={handleContextMenu}
        />

        {/* フローティングツールバー */}
        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 100, display: 'flex', gap: '10px' }}>
          <button onClick={handleProofing} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle size={16} /> 校正
          </button>
          <button onClick={() => setShowSearch(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '5px' }} title="検索 (Ctrl+F)">
            検索
          </button>
          <button onClick={handleSave}>保存</button>
        </div>

        {showSearch && (
          <SearchBar
            textareaRef={textareaRef}
            content={content}
            onContentChange={handleContentChange}
            onClose={() => setShowSearch(false)}
          />
        )}

        <StatusBar
          charCount={content.length}
          lineCount={content.split('\n').length}
          pageCount={pageCount}
          encoding={currentEncoding}
        />
      </div>

      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '40px',
          right: '20px',
          background: 'var(--app-text, #333)',
          color: 'var(--app-bg, #fff)',
          padding: '8px 16px',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 9999,
          animation: 'fadeIn 0.3s'
        }}>
          {toastMessage}
        </div>
      )}

      {showProofing && (
        <ProofingPanel
          issues={proofingIssues}
          onJump={handleJumpToLine}
          onClose={() => setShowProofing(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
          onExport={handleExportSettings}
          onImport={handleImportSettings}
        />
      )}

      {showNewProjectModal && (
        <NewProjectModal
          onSave={handleCreateProject}
          onClose={() => setShowNewProjectModal(false)}
        />
      )}

      {/* Context Menu ... */}
      {contextMenu && (
        <div style={{
          position: 'fixed',
          top: contextMenu.y,
          left: contextMenu.x,
          background: 'var(--content-bg, white)',
          color: 'var(--app-text)',
          border: '1px solid var(--sidebar-border, #ccc)',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {contextMenu.type === 'file' ? (
            <>
              <button
                onClick={() => contextMenu.targetFile && handleRenameFile(contextMenu.targetFile)}
                style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                名前の変更
              </button>
            </>
          ) : (
            <button
              onClick={async () => {
                await openUrl(`https://www.google.com/search?q=${encodeURIComponent(contextMenu.text)}`);
                setContextMenu(null);
              }}
              style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              Google検索: "{contextMenu.text.substring(0, 20)}{contextMenu.text.length > 20 ? '...' : ''}"
            </button>
          )}
          <button
            onClick={() => setContextMenu(null)}
            style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderTop: '1px solid var(--sidebar-border, #eee)' }}
          >
            キャンセル
          </button>
        </div>
      )}

      <CustomDialog
        open={!!renameTarget}
        inputMode
        title="名前の変更"
        message="新しいファイル名を入力してください (拡張子 .txt を含む):"
        defaultValue={renameTarget?.name}
        onConfirm={(value) => {
          const target = renameTarget;
          setRenameTarget(null);
          if (target && value && value !== target.name) {
            performRename(target, value);
          }
        }}
        onCancel={() => setRenameTarget(null)}
      />
    </main>
  );
}

export default App;
