// アプリ設定のデフォルト値・型定義・バックアップ（エクスポート/インポート）用のロジック。
// React に依存しない純粋な関数のみを置く（テストやバリデーションをしやすくするため）。

export const defaultSettings = {
  visualLineLength: 40,
  fontSize: 18,
  countLineLength: 40,
  countLinesPerPage: 20,
  columnsPerPage: 1,
  showWhitespace: false,
  verticalWriting: false,
  theme: 'light' as 'light' | 'dark' | 'rainbow' | 'custom',
  customColors: {
    appBg: '#f6f6f6',
    contentBg: '#ffffff',
    editorText: '#333333',
    sidebarBg: '#f0f0f0',
    statusbarBg: '#e0e0e0',
  },
  presets: [
    { id: 'default', name: '標準 (40x20)', countLineLength: 40, countLinesPerPage: 20, columnsPerPage: 1 }
  ],
  currentPresetId: 'default'
};

export type AppSettings = typeof defaultSettings;

// バックアップファイルのフォーマットバージョン。中身のスキーマを壊す変更をしたら上げる。
export const SETTINGS_BACKUP_VERSION = 1;

export interface SettingsBackup {
  app: 'senpai-editor';
  version: number;
  exportedAt: string;
  settings: AppSettings;
  openFolders: string[];
  sidebarWidth: number | null;
}

/**
 * 現在の設定・開いているフォルダ・サイドバー幅からバックアップ用オブジェクトを作る。
 */
export function createSettingsBackup(
  settings: AppSettings,
  openFolders: string[],
  sidebarWidth: number | null
): SettingsBackup {
  return {
    app: 'senpai-editor',
    version: SETTINGS_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    openFolders,
    sidebarWidth,
  };
}

// 型ガード用の小さなヘルパー群
function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isValidTheme(value: unknown): value is AppSettings['theme'] {
  return value === 'light' || value === 'dark' || value === 'rainbow' || value === 'custom';
}

// customColors を安全に取り込む。デフォルトを土台にし、文字列の値だけ上書きする
function sanitizeCustomColors(input: unknown): AppSettings['customColors'] {
  const result = { ...defaultSettings.customColors };
  if (input && typeof input === 'object') {
    for (const key of Object.keys(result) as (keyof AppSettings['customColors'])[]) {
      const value = (input as Record<string, unknown>)[key];
      if (typeof value === 'string') {
        result[key] = value;
      }
    }
  }
  return result;
}

type Preset = AppSettings['presets'][number];

function isValidPresetEntry(entry: unknown): entry is Preset {
  if (!entry || typeof entry !== 'object') return false;
  const p = entry as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    isFinitePositiveNumber(p.countLineLength) &&
    isFinitePositiveNumber(p.countLinesPerPage) &&
    isFinitePositiveNumber(p.columnsPerPage)
  );
}

// presets を安全に取り込む。不正な要素は捨て、標準プリセットが欠けていれば先頭に補う
function sanitizePresets(input: unknown): Preset[] {
  const valid = Array.isArray(input) ? input.filter(isValidPresetEntry) : [];
  const defaultPreset = defaultSettings.presets[0];
  if (!valid.some(p => p.id === defaultPreset.id)) {
    return [defaultPreset, ...valid];
  }
  return valid;
}

// settings オブジェクトをフィールドごとにデフォルト値と突き合わせて安全な値にする
export function sanitizeSettings(input: unknown): AppSettings {
  const raw = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {};

  const visualLineLength = isFinitePositiveNumber(raw.visualLineLength) ? raw.visualLineLength : defaultSettings.visualLineLength;
  const fontSize = isFinitePositiveNumber(raw.fontSize) ? raw.fontSize : defaultSettings.fontSize;
  const countLineLength = isFinitePositiveNumber(raw.countLineLength) ? raw.countLineLength : defaultSettings.countLineLength;
  const countLinesPerPage = isFinitePositiveNumber(raw.countLinesPerPage) ? raw.countLinesPerPage : defaultSettings.countLinesPerPage;
  const columnsPerPage = isFinitePositiveNumber(raw.columnsPerPage) ? raw.columnsPerPage : defaultSettings.columnsPerPage;
  const showWhitespace = isBoolean(raw.showWhitespace) ? raw.showWhitespace : defaultSettings.showWhitespace;
  const verticalWriting = isBoolean(raw.verticalWriting) ? raw.verticalWriting : defaultSettings.verticalWriting;
  const theme = isValidTheme(raw.theme) ? raw.theme : 'light';
  const customColors = sanitizeCustomColors(raw.customColors);
  const presets = sanitizePresets(raw.presets);
  const currentPresetId = (typeof raw.currentPresetId === 'string' && presets.some(p => p.id === raw.currentPresetId))
    ? raw.currentPresetId
    : 'default';

  return {
    visualLineLength,
    fontSize,
    countLineLength,
    countLinesPerPage,
    columnsPerPage,
    showWhitespace,
    verticalWriting,
    theme,
    customColors,
    presets,
    currentPresetId,
  };
}

/**
 * JSON文字列からバックアップを復元する。フォーマットとして不正な場合は日本語のメッセージ付き
 * Error を投げるが、settings の中身の細かい不整合は例外にせず、フィールド単位でデフォルトに
 * フォールバックさせる（インポート自体は失敗させない）。
 */
export function parseSettingsBackup(json: string): {
  settings: AppSettings;
  openFolders: string[];
  sidebarWidth: number | null;
} {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('ファイルの形式が正しくありません（JSONとして読み込めませんでした）');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Senpai Editor の設定ファイルではありません');
  }

  const obj = data as Record<string, unknown>;

  if (obj.app !== 'senpai-editor' || !obj.settings || typeof obj.settings !== 'object') {
    throw new Error('Senpai Editor の設定ファイルではありません');
  }

  const version = typeof obj.version === 'number' ? obj.version : 0;
  if (version > SETTINGS_BACKUP_VERSION) {
    throw new Error('このファイルは新しいバージョンの Senpai Editor で書き出されたため読み込めません');
  }

  const settings = sanitizeSettings(obj.settings);

  const openFolders = Array.isArray(obj.openFolders)
    ? obj.openFolders.filter((p): p is string => typeof p === 'string' && p.length > 0)
    : [];

  const sidebarWidth = (typeof obj.sidebarWidth === 'number' && Number.isFinite(obj.sidebarWidth) && obj.sidebarWidth >= 150 && obj.sidebarWidth <= 600)
    ? obj.sidebarWidth
    : null;

  return { settings, openFolders, sidebarWidth };
}
