// Simple word-level diff for highlighting changes between two texts

export type DiffSegment = {
  text: string;
  type: "equal" | "added" | "removed";
};

// Longest Common Subsequence on word arrays
function lcsWords(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  // Use a space-optimized approach for large texts
  if (m > 2000 || n > 2000) {
    // Fallback: just return common words in order
    const setB = new Set(b);
    return a.filter((w) => setB.has(w));
  }
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const result: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}

function tokenize(text: string): string[] {
  // Split into words preserving whitespace/newlines as separate tokens
  return text.split(/(\s+)/).filter(Boolean);
}

export function computeDiff(original: string, modified: string): { original: DiffSegment[]; modified: DiffSegment[] } {
  const origTokens = tokenize(original);
  const modTokens = tokenize(modified);
  const lcs = lcsWords(origTokens, modTokens);

  const origSegments: DiffSegment[] = [];
  const modSegments: DiffSegment[] = [];

  let li = 0;
  // Mark original
  for (const token of origTokens) {
    if (li < lcs.length && token === lcs[li]) {
      origSegments.push({ text: token, type: "equal" });
      li++;
    } else {
      origSegments.push({ text: token, type: "removed" });
    }
  }

  li = 0;
  for (const token of modTokens) {
    if (li < lcs.length && token === lcs[li]) {
      modSegments.push({ text: token, type: "equal" });
      li++;
    } else {
      modSegments.push({ text: token, type: "added" });
    }
  }

  return { original: origSegments, modified: modSegments };
}
