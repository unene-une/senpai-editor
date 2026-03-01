export interface ProofingIssue {
    id: string;
    line: number;
    type: 'duplicate' | 'typo' | 'bracket' | 'style';
    message: string;
    context: string;
}

export const checkProofing = (text: string): ProofingIssue[] => {
    const issues: ProofingIssue[] = [];
    const lines = text.split('\n');

    // ── 1. 句読点パターンチェック ──
    const typoPatterns: { pattern: RegExp; message: string; type: ProofingIssue['type'] }[] = [
        { pattern: /。。/g, message: '句点が連続しています', type: 'typo' },
        { pattern: /、、/g, message: '読点が連続しています', type: 'typo' },
        { pattern: /てて/g, message: '「て」が連続しています', type: 'typo' },
        { pattern: /！！/g, message: '感嘆符が連続しています', type: 'typo' },
        { pattern: /？？/g, message: '疑問符が連続しています', type: 'typo' },
        { pattern: /　　/g, message: '全角スペースが連続しています', type: 'style' },
    ];

    lines.forEach((line, index) => {
        typoPatterns.forEach(p => {
            // Reset regex lastIndex for global patterns
            p.pattern.lastIndex = 0;
            if (p.pattern.test(line)) {
                issues.push({
                    id: `typo-${index}-${p.message}`,
                    line: index + 1,
                    type: p.type,
                    message: p.message,
                    context: line.substring(0, 30)
                });
            }
        });
    });

    // ── 2. 三点リーダー（…）の個数チェック（偶数でなければ誤り）──
    lines.forEach((line, index) => {
        const count = (line.match(/…/g) || []).length;
        if (count > 0 && count % 2 !== 0) {
            issues.push({
                id: `ellipsis-${index}`,
                line: index + 1,
                type: 'style',
                message: `三点リーダー（…）が${count}個あります（偶数個が正式）`,
                context: line.substring(0, 30)
            });
        }
    });

    // ── 3. ダッシュ（―）の個数チェック（偶数でなければ誤り）──
    lines.forEach((line, index) => {
        const count = (line.match(/―/g) || []).length;
        if (count > 0 && count % 2 !== 0) {
            issues.push({
                id: `dash-${index}`,
                line: index + 1,
                type: 'style',
                message: `ダッシュ（―）が${count}個あります（偶数個が正式）`,
                context: line.substring(0, 30)
            });
        }
    });

    // ── 4. 括弧の閉じ忘れチェック ──
    const bracketPairs: [string, string][] = [
        ['「', '」'],
        ['『', '』'],
        ['（', '）'],
        ['【', '】'],
        ['〔', '〕'],
    ];

    bracketPairs.forEach(([open, close]) => {
        let openCount = 0;
        const openRegex = new RegExp(open, 'g');
        const closeRegex = new RegExp(close, 'g');
        for (let i = 0; i < lines.length; i++) {
            openCount += (lines[i].match(openRegex) || []).length;
            openCount -= (lines[i].match(closeRegex) || []).length;
        }
        if (openCount !== 0) {
            issues.push({
                id: `bracket-${open}`,
                line: 0,
                type: 'bracket',
                message: `括弧 ${open}${close} の数が合っていません（差: ${openCount > 0 ? '+' : ''}${openCount}）`,
                context: `全体`
            });
        }
    });

    // ── 5. 同じ語の近接繰り返しチェック（前後5行以内）──
    // 3文字以上の語が5行以内に2回以上出現する場合に警告
    const windowSize = 5;
    for (let i = 0; i < lines.length; i++) {
        const wordsInLine = lines[i].match(/[\u3041-\u9FFFa-zA-Z0-9]{3,}/g) || [];
        const uniqueWords = [...new Set(wordsInLine)];

        uniqueWords.forEach(word => {
            const windowStart = Math.max(0, i - windowSize);
            const windowLines = lines.slice(windowStart, i); // 前の行のみ（現在行は除く）
            const windowText = windowLines.join('\n');
            // 前の行にすでに出現している場合のみ警告
            if (windowText.includes(word) && word.length >= 4) {
                // 頻出する助詞や一般語は除外
                const ignoreWords = ['ました', 'います', 'ている', 'られる', 'られた', 'こと', 'もの', 'という', 'ような'];
                if (!ignoreWords.some(ig => word.includes(ig))) {
                    issues.push({
                        id: `repeat-${i}-${word}`,
                        line: i + 1,
                        type: 'duplicate',
                        message: `「${word}」が近い行に繰り返し使われています`,
                        context: lines[i].substring(0, 30)
                    });
                }
            }
        });
    }

    // 重複を除去して返す
    const seen = new Set<string>();
    return issues.filter(issue => {
        if (seen.has(issue.id)) return false;
        seen.add(issue.id);
        return true;
    });
};
