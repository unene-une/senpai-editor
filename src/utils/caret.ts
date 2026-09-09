/**
 * textarea 内の指定文字位置が見える位置までスクロールする。
 *
 * 行高 × 行数の概算ではなく、textarea と同じスタイルを持つ非表示のミラー要素に
 * マーカーを置いて実測するため、折り返しや縦書き（writing-mode: vertical-rl）でも正しく動く。
 */

// 折り返し位置・座標に影響するプロパティ。ミラーに丸ごとコピーする
const MIRROR_PROPS: (keyof CSSStyleDeclaration)[] = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontVariantLigatures',
    'lineHeight', 'letterSpacing', 'wordSpacing', 'textTransform', 'textIndent',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'boxSizing', 'whiteSpace', 'wordBreak', 'overflowWrap', 'tabSize',
    'writingMode', 'textOrientation', 'direction',
];

function isVerticalWriting(style: CSSStyleDeclaration): boolean {
    return style.writingMode.startsWith('vertical');
}

/**
 * Chromium は vertical-rl / rtl のスクロール原点を「開始端が 0、負方向に進む」で実装しているが、
 * 環境差があり得るのでランタイムで判定する。
 * @returns 負方向規約なら true
 */
function usesNegativeScrollLeft(el: HTMLElement): boolean {
    const original = el.scrollLeft;
    el.scrollLeft = -1;
    const negative = el.scrollLeft < 0;
    el.scrollLeft = original;
    return negative;
}

export function scrollCaretIntoView(textarea: HTMLTextAreaElement, index: number): void {
    const style = getComputedStyle(textarea);
    const vertical = isVerticalWriting(style);

    const mirror = document.createElement('div');
    for (const prop of MIRROR_PROPS) {
        // CSSStyleDeclaration のプロパティは string として扱える
        (mirror.style as unknown as Record<string, string>)[prop as string] = style[prop] as string;
    }
    // スクロールバー分を除いた内側の寸法に合わせる（offsetWidth だと折り返し位置がずれる）
    mirror.style.width = `${textarea.clientWidth}px`;
    mirror.style.height = vertical ? `${textarea.clientHeight}px` : 'auto';
    if (vertical) {
        mirror.style.width = 'auto';
    }
    mirror.style.position = 'absolute';
    mirror.style.top = '0';
    mirror.style.left = '-99999px';
    mirror.style.visibility = 'hidden';
    mirror.style.overflow = 'hidden';
    mirror.style.pointerEvents = 'none';

    const before = document.createTextNode(textarea.value.substring(0, index));
    const marker = document.createElement('span');
    // 進行方向のサイズ 0 で折り返しに影響させない
    marker.style.display = 'inline-block';
    marker.style.width = vertical ? '1px' : '0';
    marker.style.height = vertical ? '0' : '1px';
    // 末尾の改行が無視されないよう、マーカー後にも文字を置く
    const after = document.createTextNode(textarea.value.substring(index) || '.');
    mirror.append(before, marker, after);
    document.body.appendChild(mirror);

    try {
        if (vertical) {
            // vertical-rl は右端から左へ流れる。開始端（右端）からの距離を求める
            const distanceFromStart = mirror.scrollWidth - (marker.offsetLeft + marker.offsetWidth);
            const target = Math.max(0, distanceFromStart - textarea.clientWidth / 3);
            if (usesNegativeScrollLeft(textarea)) {
                textarea.scrollLeft = -target;
            } else {
                const maxScroll = textarea.scrollWidth - textarea.clientWidth;
                textarea.scrollLeft = Math.max(0, maxScroll - target);
            }
        } else {
            textarea.scrollTop = Math.max(0, marker.offsetTop - textarea.clientHeight / 3);
        }
    } finally {
        mirror.remove();
    }
}
