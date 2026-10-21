// Windows で予約されているデバイス名（拡張子が付いていても作れない）
const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

/**
 * ユーザーが入力したファイル名・フォルダ名を検証する。
 * `..\` などでフォルダの外へ移動してしまうのを防ぎ、
 * Windows で作成できない名前（予約名・使えない文字など）も弾く。
 *
 * @returns 問題があれば理由を表す日本語のメッセージ、問題なければ null
 */
export function validateFileName(name: string): string | null {
  // 空、または空白だけ
  if (name.trim() === '') {
    return 'ファイル名を入力してください';
  }

  // パス区切りや Windows で使えない文字
  if (/[\\/:*?"<>|]/.test(name)) {
    return '次の文字は使えません: / \\ : * ? " < > |';
  }

  // 親フォルダへ抜けるための「..」
  if (name.includes('..')) {
    return '「..」は使えません';
  }

  // 制御文字（U+0000〜U+001F）
  if (/[\u0000-\u001f]/.test(name)) {
    return '制御文字は使えません';
  }

  // Windows は末尾のドットや空白を黙って削除してしまう
  if (name.endsWith('.') || name.endsWith(' ')) {
    return '末尾にドットや空白は使えません';
  }

  // 最初の「.」より前（基本名）が予約名かどうか。大文字小文字は区別しない
  const baseName = name.split('.')[0].toUpperCase();
  if (WINDOWS_RESERVED_NAMES.has(baseName)) {
    return `「${baseName}」はWindowsで予約された名前のため使えません`;
  }

  return null;
}
