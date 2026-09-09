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

    textarea.focus();
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
