/**
 * textarea の一部を、ブラウザのアンドゥ履歴を保ったまま置き換える。
 *
 * React 経由で value を丸ごと差し替えると WebView2/Chromium はアンドゥ履歴を破棄するため、
 * 範囲を選択してから execCommand('insertText') で挿入する。この経路なら input イベントも
 * 発火するので、React の onChange は通常どおり呼ばれる。
 *
 * @returns execCommand が成功したら true。false の場合は呼び出し側でフォールバックすること。
 */
export function replaceRange(
    textarea: HTMLTextAreaElement,
    start: number,
    end: number,
    text: string,
): boolean {
    const before = textarea.value;
    const expected = before.substring(0, start) + text + before.substring(end);

    focusForIme(textarea);
    textarea.setSelectionRange(start, end);
    try {
        // 非推奨 API だが、アンドゥ履歴を維持できる標準の代替手段が存在しない
        const ok = document.execCommand('insertText', false, text);
        if (!ok) return false;
    } catch {
        return false;
    }
    // execCommand が「成功」を返しても何も挿入されない環境があるため、期待する全文と厳密に比較する
    // （挿入文字列の先頭一致だけだと、空文字への置換で何も起きなかった場合を見逃す）
    return textarea.value === expected;
}

/**
 * textarea にフォーカスを当て直し、IME に入力欄の状態を再通知させる。
 *
 * Chromium/WebView2 では、ウィンドウが OS のフォーカスを取り戻したときや、スクリプトで
 * フォーカスを移したときに、IME へ入力欄の情報（キャレット位置など）が再通知されないことがある。
 * その状態で日本語を打つと変換ウィンドウが画面左上に浮いて出る。一度 blur してから focus し直すと
 * 再通知が走るので、スクリプトからフォーカスを当てる箇所は必ずこれを通す。
 * 選択範囲とスクロール位置は維持する。
 */
export function focusForIme(textarea: HTMLTextAreaElement): void {
    const { selectionStart, selectionEnd, selectionDirection, scrollTop, scrollLeft } = textarea;

    if (document.activeElement === textarea) {
        textarea.blur();
    }
    textarea.focus({ preventScroll: true });

    textarea.setSelectionRange(selectionStart, selectionEnd, selectionDirection ?? undefined);
    textarea.scrollTop = scrollTop;
    textarea.scrollLeft = scrollLeft;
}
