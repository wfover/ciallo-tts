// 文本长度计算与分段算法（自 script.js 移植为纯函数）

export interface ApiLimits {
  maxSegment: number;
  maxTotal: number;
}

export function getApiLimits(format: "openai" | "edge"): ApiLimits {
  return format === "openai"
    ? { maxSegment: 400, maxTotal: 2000 }
    : { maxSegment: 5000, maxTotal: 100000 };
}

/** 计算文本等效长度：中文 2 单位 / 英文 1 单位 / 停顿 1 秒 = 11 单位 */
export function getTextLength(str: string): number {
  // 移除 XML 标签，但记录停顿时间
  let totalPauseTime = 0;
  const textWithoutTags = str.replace(/<break\s+time="(\d+(?:\.\d+)?)(m?s)"\s*\/>/g, (_match, time: string, unit: string) => {
    const seconds = unit === "ms" ? parseFloat(time) / 1000 : parseFloat(time);
    totalPauseTime += seconds;
    return "";
  });

  const textLength = textWithoutTags.split("").reduce((acc, char) => {
    return acc + (char.charCodeAt(0) > 127 ? 2 : 1);
  }, 0);

  const pauseLength = Math.round(totalPauseTime * 11);
  return textLength + pauseLength;
}

const PUNCTUATION_GROUPS: string[][] = [
  // 第一优先级: 换行符
  ["\n", "\r\n"],
  // 第二优先级: 句末标点
  [
    "。", "！", "？", ".", "!", "?",
    "。", "！", "？", "︒", "︕", "︖",
    "｡", "!", "?", "。", "॥", "؟", "۔",
    "។", "៕", "။", "၏", "¿", "¡",
    "‼", "⁇", "⁈", "⁉", "‽", "~",
  ],
  // 第三优先级: 分号
  ["；", ";", "；", "︔", "︐", "؛", "፤", "꛶"],
  // 第四优先级: 逗号和冒号
  [
    "，", "：", ",", ":", "、", "，", "：",
    "︑", "︓", "､", ":", "、", "፣", "፥",
    "၊", "၌", "、", "؍", "׀", "，",
  ],
  // 第五优先级: 其他标点
  ["、", "…", "―", "─", "-", "—", "–", "‥", "〳", "〴", "〵", "᠁", "᠂", "᠃", "᭛", "᭜", "᭝"],
  // 第六优先级: 空格和其他分隔符
  [" ", "\t", "　", "〿", "〮", "〯", "᠀", "᭟", "᭠", "᳓", "᳔", "᳕"],
];

/** 按标点优先级将长文本分段，每段不超过 maxSegment 单位 */
export function splitText(text: string, maxSegment: number): string[] {
  const segments: string[] = [];
  let remainingText = text.trim();

  while (remainingText.length > 0) {
    let splitIndex = remainingText.length;
    let currentLength = 0;
    let bestSplitIndex = -1;

    for (let i = 0; i < remainingText.length; i++) {
      currentLength += remainingText.charCodeAt(i) > 127 ? 2 : 1;

      if (currentLength > maxSegment) {
        splitIndex = i;
        // 先遍历优先级组
        for (let priority = 0; priority < PUNCTUATION_GROUPS.length; priority++) {
          let searchLength = 0;
          // 在300单位范围内搜索当前优先级的标点
          for (let j = i; j >= 0 && searchLength <= 300; j--) {
            searchLength += remainingText.charCodeAt(j) > 127 ? 2 : 1;

            if (PUNCTUATION_GROUPS[priority].includes(remainingText[j])) {
              bestSplitIndex = j;
              break;
            }
          }
          // 如果在当前优先级找到了分段点，就不再检查更低优先级
          if (bestSplitIndex > -1) break;
        }
        break;
      }
    }

    if (bestSplitIndex > 0) {
      splitIndex = bestSplitIndex + 1;
    }

    segments.push(remainingText.substring(0, splitIndex));
    remainingText = remainingText.substring(splitIndex).trim();
  }

  return segments;
}

export function escapeXml(str: unknown): string {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] as string
  ));
}
