/**
 * ネイティブダイアログ（@tauri-apps/plugin-dialog）のラッパー。
 *
 * Windows/WebView2 では、ask()/message()/save()/open() などのネイティブダイアログを閉じた
 * 直後に、ウィンドウが OS レベルのキーボードフォーカスを失うことがある。DOM 上のフォーカス
 * （focus()）は正しく当たっているのに文字が入力できず、キャレットも点滅しない。アプリの
 * 再起動で直ることから、WebView2 側の一時的な取りこぼしと判断し、ダイアログの Promise が
 * 解決するたびにウィンドウへ setFocus() をベストエフォートで呼び直す。
 */
import {
    ask,
    message,
    save,
    open,
} from '@tauri-apps/plugin-dialog';

export async function refocusWindow(): Promise<void> {
    try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().setFocus();
    } catch {
        // Tauri 外（ブラウザ実行時など）では黙って無視
    }
}

export async function withWindowRefocus<T>(fn: () => Promise<T>): Promise<T> {
    try {
        return await fn();
    } finally {
        await refocusWindow();
    }
}

export const askDialog: (...args: Parameters<typeof ask>) => ReturnType<typeof ask> = (...args) =>
    withWindowRefocus(() => ask(...args));

export const messageDialog: (...args: Parameters<typeof message>) => ReturnType<typeof message> = (...args) =>
    withWindowRefocus(() => message(...args));

export const saveDialog: (...args: Parameters<typeof save>) => ReturnType<typeof save> = (...args) =>
    withWindowRefocus(() => save(...args));

export const openDialog: (...args: Parameters<typeof open>) => ReturnType<typeof open> = (...args) =>
    withWindowRefocus(() => open(...args));
