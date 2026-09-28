// Edge TTS 的 style（情绪风格）与 role（角色扮演）中文说明。
// 微软返回的都是英文标识（cheerful / YoungAdultFemale），直接展示对使用者不友好，
// 这里映射为中文名，未收录的值回退为原英文标识。

/** 默认值的展示名（留空时服务端按 general / default 处理） */
export const DEFAULT_STYLE_VALUE = "";
export const DEFAULT_ROLE_VALUE = "";

export const DEFAULT_STYLE_LABEL = "默认（通用）";
export const DEFAULT_ROLE_LABEL = "默认（原声）";

const STYLE_LABELS: Record<string, string> = {
  general: "通用",
  default: "默认",
  advertisement_upbeat: "广告·热情",
  "advertisement-upbeat": "广告·热情",
  affectionate: "亲切温柔",
  angry: "生气",
  assistant: "智能助理",
  calm: "平静",
  chat: "聊天",
  "chat-casual": "闲聊",
  cheerful: "愉快开心",
  customerservice: "客服",
  depressed: "低落沮丧",
  disgruntled: "不满抱怨",
  "documentary-narration": "纪录片旁白",
  embarrassed: "害羞尴尬",
  envious: "羡慕",
  excited: "兴奋",
  fearful: "害怕",
  friendly: "友好",
  gentle: "温柔",
  hopeful: "满怀希望",
  joyful: "喜悦",
  lyrical: "抒情朗读",
  "narration-professional": "专业旁白",
  "narration-relaxed": "轻松旁白",
  newscast: "新闻播报",
  "newscast-casual": "新闻播报·休闲",
  "newscast-formal": "新闻播报·正式",
  "poetry-reading": "诗歌朗读",
  sad: "悲伤",
  serious: "严肃",
  shouting: "大喊",
  sorry: "抱歉",
  "sports-commentary": "体育解说",
  "sports-commentary-excited": "体育解说·激动",
  terrified: "惊恐",
  unfriendly: "冷淡不友好",
  whispering: "耳语轻声",
};

const ROLE_LABELS: Record<string, string> = {
  default: "默认（原声）",
  Narrator: "旁白者",
  YoungAdultFemale: "青年女性",
  YoungAdultMale: "青年男性",
  OlderAdultFemale: "中年女性",
  OlderAdultMale: "中年男性",
  SeniorFemale: "老年女性",
  SeniorMale: "老年男性",
  Girl: "女孩",
  Boy: "男孩",
};

/** 取中文名，未收录返回原值 */
export function styleLabel(style: string): string {
  const key = style.trim();
  if (!key) return DEFAULT_STYLE_LABEL;
  return STYLE_LABELS[key] ?? STYLE_LABELS[key.toLowerCase()] ?? key;
}

export function roleLabel(role: string): string {
  const key = role.trim();
  if (!key) return DEFAULT_ROLE_LABEL;
  return ROLE_LABELS[key] ?? ROLE_LABELS[key.toLowerCase()] ?? key;
}

/** 一句说明，作为下拉项副标题或提示语 */
export function styleHint(style: string): string {
  const key = style.trim();
  if (!key) return "不指定情绪，使用语音本身的默认语气";
  const label = styleLabel(key);
  return `${label}（${key}）`;
}

export function roleHint(role: string): string {
  const key = role.trim();
  if (!key) return "不指定角色，使用语音本身音色";
  const label = roleLabel(key);
  return `${label}（${key}）`;
}
