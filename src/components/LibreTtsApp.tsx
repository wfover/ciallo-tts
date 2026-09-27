"use client";

// 主应用：状态编排与生成流程（替代 script.js 的 $(document).ready 编排）
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cog, LoaderCircle, Volume2 } from "lucide-react";
import SearchableSelect, { type SelectOption } from "./SearchableSelect";
import HistoryCard from "./HistoryCard";
import ApiManagerModal from "./ApiManagerModal";
import PasswordGate from "./PasswordGate";
import { ToastProvider, useToast, LOADING_STYLE } from "./ToastProvider";
import { getApiLimits, getTextLength, splitText } from "@/lib/segmentation";
import { audioExtension, makeTtsRequest, type ApiContext } from "@/lib/ttsRequest";
import {
  buildExport,
  exportFileName,
  fetchCustomSpeakers,
  loadCustomApis,
  mergeImportedApis,
  newCustomApiId,
  persistCustomApis,
  type CustomApiMap,
} from "@/lib/customApis";
import type { CustomApi, HistoryItem, SpeakerMap } from "@/lib/types";

const BUILTIN_APIs: { id: string; label: string; endpoint: string; format: "openai" | "edge" }[] = [
  { id: "edge-api", label: "Edge API", endpoint: "/api/tts", format: "edge" },
  {
    id: "oai-tts",
    label: "OAI-TTS API",
    endpoint: "https://oai-tts.zwei.de.eu.org/v1/audio/speech",
    format: "openai",
  },
];

const API_TIPS: Record<string, string> = {
  "edge-api": "Edge API 请求应该不限次数",
  "oai-tts": "OpenAI-TTS 支持情感调整，不支持停顿标签",
};

const MAX_HISTORY = 50;
const MAX_RETRIES = 3;

interface SpeakerState {
  loading: boolean;
  error: string | null;
  map: SpeakerMap;
  manual: boolean;
}

function LibreTtsAppInner() {
  const { show } = useToast();

  const [builtinSpeakers, setBuiltinSpeakers] = useState<Record<string, { speakers: SpeakerMap }>>({});
  const [customApis, setCustomApis] = useState<CustomApiMap>({});
  const [apiId, setApiId] = useState("edge-api");
  const [speakerId, setSpeakerId] = useState("");
  const [speakerState, setSpeakerState] = useState<SpeakerState>({ loading: true, error: null, map: {}, manual: false });
  const [text, setText] = useState("");
  const [rate, setRate] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [instructions, setInstructions] = useState("");
  const [audioFormat, setAudioFormat] = useState("mp3");
  const [pauseSeconds, setPauseSeconds] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [result, setResult] = useState<{ url: string; filename: string } | null>(null);
  const [progress, setProgress] = useState<{ message: string; percent: number } | null>(null);
  const [apiManagerOpen, setApiManagerOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const requestCounter = useRef(0);
  const [generating, setGenerating] = useState(false);
  const cachedAudio = useRef(new Map<string, Blob>());

  const currentApi = useMemo(() => {
    const custom = customApis[apiId];
    if (custom) {
      return {
        id: apiId,
        endpoint: custom.endpoint,
        format: custom.format || "openai",
        isCustom: true,
        apiKey: custom.apiKey,
        maxLength: custom.maxLength,
      } satisfies ApiContext;
    }
    const builtin = BUILTIN_APIs.find((a) => a.id === apiId);
    if (!builtin) return null;
    return {
      id: builtin.id,
      endpoint: builtin.endpoint,
      format: builtin.format,
      isCustom: false,
    } satisfies ApiContext;
  }, [apiId, customApis]);

  const apiFormat = currentApi?.format ?? "edge";
  const limits = getApiLimits(apiFormat);

  // 初始加载：内置讲述人 + localStorage 自定义 API
  useEffect(() => {
    fetch("/speakers.json")
      .then((res) => res.json())
      .then((data) => setBuiltinSpeakers(data))
      .catch((err) => {
        console.error("加载讲述者失败：", err);
        show("加载讲述者失败，请刷新页面重试。", "danger");
      });
    setCustomApis(loadCustomApis());
  }, [show]);

  // 讲述人选项派生：切换 API 或自定义 API 变化时重新加载
  useEffect(() => {
    let cancelled = false;
    const custom = customApis[apiId];

    if (custom) {
      if (custom.manual && custom.manual.length) {
        setSpeakerState({
          loading: false,
          error: null,
          map: Object.fromEntries(custom.manual.map((v) => [v, v])),
          manual: true,
        });
        setSpeakerId(custom.manual[0]);
        return;
      }
      if (custom.apiKey && custom.modelEndpoint) {
        setSpeakerState({ loading: true, error: null, map: {}, manual: false });
        fetchCustomSpeakers(custom)
          .then((speakers) => {
            if (cancelled) return;
            setSpeakerState({ loading: false, error: null, map: speakers, manual: false });
            const first = Object.keys(speakers)[0];
            setSpeakerId(first && first !== "default" && first !== "error" ? first : "");
          })
          .catch((err) => {
            if (cancelled) return;
            console.error("获取自定义讲述人失败:", err);
            setSpeakerState({ loading: false, error: "获取讲述人失败，请手动添加", map: {}, manual: false });
            setSpeakerId("");
          });
        return () => {
          cancelled = true;
        };
      }
      setSpeakerState({ loading: false, error: "请先获取模型或手动输入讲述人", map: {}, manual: false });
      setSpeakerId("");
      return;
    }

    const speakers = builtinSpeakers[apiId]?.speakers ?? {};
    setSpeakerState({ loading: Object.keys(speakers).length === 0, error: null, map: speakers, manual: false });
    const first = Object.keys(speakers)[0];
    setSpeakerId(first || "");
    return () => {
      cancelled = true;
    };
  }, [apiId, customApis, builtinSpeakers]);

  // API 选项列表
  const apiOptions: SelectOption[] = useMemo(
    () => [
      ...BUILTIN_APIs.map((a) => ({ value: a.id, label: a.label })),
      ...Object.values(customApis).map((a) => ({ value: a.id, label: a.name })),
    ],
    [customApis]
  );

  const speakerOptions: SelectOption[] = useMemo(
    () => Object.entries(speakerState.map).map(([value, label]) => ({ value, label })),
    [speakerState.map]
  );

  const apiTips = currentApi
    ? currentApi.isCustom
      ? `自定义API: ${customApis[apiId]?.name} - 使用${currentApi.format === "openai" ? "OpenAI格式" : "Edge API格式"}`
      : API_TIPS[apiId] || ""
    : "";

  const charCount = useMemo(() => {
    const used = getTextLength(text);
    return `${Math.min(100, Math.round((used / limits.maxTotal) * 100))}% (${used}/${limits.maxTotal}单位)`;
  }, [text, limits.maxTotal]);

  // ---------- 历史记录 ----------
  const addHistoryItem = useCallback(
    (label: string, speaker: string, rawText: string, blob: Blob, requestInfo: string) => {
      const url = URL.createObjectURL(blob);
      cachedAudio.current.set(url, blob);
      const item: HistoryItem = {
        id: Date.now() + Math.random(),
        label,
        timestamp: new Date().toLocaleTimeString(),
        speaker,
        text: rawText,
        audioUrl: url,
        blob,
        requestInfo,
      };
      setHistory((prev) => {
        const next = [item, ...prev];
        // 超出上限时移除最旧条目并释放其 URL
        while (next.length > MAX_HISTORY) {
          const removed = next.pop();
          if (removed) {
            URL.revokeObjectURL(removed.audioUrl);
            cachedAudio.current.delete(removed.audioUrl);
          }
        }
        return next;
      });
      return item;
    },
    []
  );

  const clearHistory = useCallback(() => {
    setHistory((prev) => {
      prev.forEach((item) => {
        URL.revokeObjectURL(item.audioUrl);
        cachedAudio.current.delete(item.audioUrl);
      });
      return [];
    });
    setPlayingId(null);
    alert("历史记录已清除！");
  }, []);

  // ---------- 播放与下载 ----------
  const playAudio = useCallback(
    (blob: Blob, itemId: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const url = URL.createObjectURL(blob);
      cachedAudio.current.set(url, blob);
      audio.src = url;
      audio.play().catch(() => {});
      setPlayingId(itemId);
      audio.onended = () => setPlayingId(null);
      // 回填主播放器与下载链接（与旧版行为一致）
      setResult((prev) => ({ url, filename: prev?.filename ?? "voice.mp3" }));
    },
    []
  );

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  // ---------- 生成流程 ----------
  const generateVoice = useCallback(
    async (isPreview: boolean) => {
      if (!currentApi) {
        show("请先选择API", "warning");
        return;
      }
      const rawText = text.trim();
      if (!rawText) {
        show("请输入要转换的文本", "warning");
        return;
      }
      if (!isPreview && generating) {
        show("请等待当前语音生成完成", "warning");
        return;
      }
      if (!speakerId) {
        show(speakerState.error || "请选择讲述人", "warning");
        return;
      }

      const api = currentApi;
      const voice = speakerId;
      const speakerName = speakerState.map[speakerId] || speakerId;
      setGenerating(true);

      async function requestSegment(segmentText: string, segmentPreview: boolean): Promise<Blob> {
        return makeTtsRequest(api, {
          voice,
          text: segmentText,
          rate,
          pitch,
          preview: segmentPreview,
          instructions: instructions.trim(),
          audioFormat,
        });
      }

      try {
        if (isPreview) {
          // 试听前 20 个字
          const previewText = rawText.substring(0, 20);
          const blob = await requestSegment(previewText, true);
          const url = URL.createObjectURL(blob);
          cachedAudio.current.set(url, blob);
          setResult({ url, filename: `voice.${audioExtension(api, audioFormat)}` });
          return;
        }

        setGenerating(true);
        requestCounter.current += 1;
        const requestId = requestCounter.current;

        const segments = splitText(rawText, limits.maxSegment);
        const results: Blob[] = [];

        if (segments.length > 1) {
          setProgress({ message: `正在生成#${requestId}请求的分段语音`, percent: 0 });
        } else {
          setProgress({ message: "正在生成语音，请稍候...", percent: -1 });
        }

        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];
          let blob: Blob | null = null;
          let lastError: Error | null = null;

          // 每段最多重试 MAX_RETRIES 次，指数退避
          for (let retryCount = 0; retryCount < MAX_RETRIES; retryCount++) {
            try {
              if (segments.length > 1) {
                setProgress({
                  message: `正在生成#${requestId}请求的 ${i + 1}/${segments.length} 段语音${
                    retryCount > 0 ? `(重试 ${retryCount}/${MAX_RETRIES - 1})` : ""
                  }`,
                  percent: Math.round(((i + retryCount / MAX_RETRIES) / segments.length) * 100),
                });
              }
              blob = await requestSegment(segment, false);
              break;
            } catch (err) {
              lastError = err instanceof Error ? err : new Error(String(err));
              console.error(`第 ${i + 1} 段第 ${retryCount + 1} 次请求失败:`, lastError);
              if (retryCount < MAX_RETRIES - 1) {
                await new Promise((r) => setTimeout(r, 3000 + retryCount * 2000));
              }
            }
          }

          if (!blob) {
            show(
              `#${requestId} 第 ${i + 1}/${segments.length} 段生成失败: ${lastError?.message || "未知错误"}`,
              "danger"
            );
            continue;
          }

          results.push(blob);
          addHistoryItem(
            segments.length > 1 ? `${requestId}(${i + 1}/${segments.length})` : `${requestId}`,
            speakerName,
            segment,
            blob,
            ""
          );
        }

        // 多段时合并为一条历史记录
        if (results.length > 1) {
          const merged = new Blob(results, { type: "audio/mpeg" });
          addHistoryItem(`${requestId}(合并)`, speakerName, rawText, merged, `共 ${segments.length} 段`);
        }

        if (results.length > 0) {
          const finalBlob = results.length > 1 ? new Blob(results, { type: "audio/mpeg" }) : results[0];
          const url = URL.createObjectURL(finalBlob);
          cachedAudio.current.set(url, finalBlob);
          // 音频元素通过 result 状态渲染（src + autoPlay），无需直接操作 DOM
          setResult({ url, filename: `voice.${audioExtension(api, audioFormat)}` });
        }
      } catch (err) {
        show(err instanceof Error ? err.message : "生成失败", "danger");
      } finally {
        setGenerating(false);
        setProgress(null);
      }
    },
    [currentApi, text, speakerId, speakerState, rate, pitch, instructions, audioFormat, limits.maxSegment, show, addHistoryItem]
  );

  // ---------- 插入停顿 ----------
  function insertPause() {
    const seconds = parseFloat(pauseSeconds);
    if (isNaN(seconds) || seconds < 0.01 || seconds > 100) {
      show("请输入0.01到100之间的数字", "warning");
      return;
    }
    const textarea = textareaRef.current;
    if (!textarea) return;
    const pauseTag = `<break time="${seconds}s"/>`;
    const cursorPos = textarea.selectionStart;
    const textBefore = text.substring(0, cursorPos);
    const textAfter = text.substring(textarea.selectionEnd);
    const newText = textBefore + pauseTag + textAfter;
    setText(newText);
    const newPos = cursorPos + pauseTag.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    });
  }

  // ---------- 自定义 API 管理 ----------
  function handleSaveApi(api: CustomApi) {
    setCustomApis((prev) => {
      const next = { ...prev, [api.id]: api };
      persistCustomApis(next);
      return next;
    });
  }

  function handleDeleteApis(ids: string[]) {
    setCustomApis((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      persistCustomApis(next);
      if (ids.includes(apiId)) {
        setApiId("edge-api");
      }
      return next;
    });
    show(`已删除 ${ids.length} 个自定义API`, "success");
  }

  function handleCopyApi(id: string) {
    const source = customApis[id];
    if (!source) return;
    const copy: typeof source = {
      ...source,
      id: `${newCustomApiId()}-${Object.keys(customApis).length}`,
      name: `${source.name}(复制)`,
    };
    setCustomApis((prev) => {
      const next = { ...prev, [copy.id]: copy };
      persistCustomApis(next);
      return next;
    });
    show(`已复制API: ${copy.name}`, "success");
  }

  function handleExportApis() {
    if (Object.keys(customApis).length === 0) {
      show("没有可导出的自定义API", "info");
      return;
    }
    const blob = new Blob([JSON.stringify(buildExport(customApis), null, 2)], { type: "application/json" });
    downloadBlob(blob, exportFileName());
    show("已导出自定义API配置", "success");
  }

  function handleImportApis(apis: CustomApi[]) {
    setCustomApis((prev) => {
      const next = mergeImportedApis(prev, apis);
      persistCustomApis(next);
      return next;
    });
    show(`已导入 ${apis.length} 个自定义API`, "success");
  }

  const isGeneratingActive = generating;

  return (
    <div className="mx-auto mt-8 flex min-h-[90vh] w-full flex-col items-center justify-center">
      <div className="grid w-full grid-cols-1 items-start gap-4 px-4 md:grid-cols-2 md:px-8">
        {/* 表单卡片 */}
        <div className="h-full overflow-hidden rounded-[15px] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_25px_rgba(99,102,241,0.08)]">
          <div className="relative overflow-hidden rounded-t-[15px] bg-gradient-to-r from-[#4a90e2] to-[#6bb5ff] px-4 py-4">
            <h2 className="relative m-0 text-center text-2xl font-medium text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]">
              文本转语音
            </h2>
          </div>
          <div className="rounded-b-[15px] bg-gradient-to-b from-white to-[#e6f0f8] p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">选择API：</label>
                <div className="flex gap-2">
                  <SearchableSelect
                    className="min-w-0 flex-1"
                    options={apiOptions}
                    value={apiId}
                    onChange={(v) => {
                      setApiId(v);
                      setRate(0);
                      setPitch(0);
                    }}
                    searchPlaceholder="搜索API..."
                    unit="个API"
                  />
                  <button
                    type="button"
                    title="管理自定义API"
                    onClick={() => setApiManagerOpen(true)}
                    className="flex h-[42px] shrink-0 items-center justify-center rounded-[10px] border border-primary/20 bg-white px-3 text-slate-500 transition-all hover:bg-primary-soft active:scale-[0.98]"
                  >
                    <Cog size={16} />
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-slate-muted">{apiTips}</p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">选择语音：</label>
                <SearchableSelect
                  options={speakerOptions}
                  value={speakerId}
                  onChange={setSpeakerId}
                  searchPlaceholder="搜索讲述人（名称或ID）..."
                  unit="位讲述人"
                  showSub
                  emptyText={
                    speakerState.loading
                      ? "加载中..."
                      : speakerState.error || "未找到讲述人"
                  }
                  placeholder="请选择讲述人"
                />
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">输入文本：</label>
                {apiFormat !== "openai" && (
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min={0.01}
                      max={100}
                      step={0.01}
                      value={pauseSeconds}
                      onChange={(e) => setPauseSeconds(e.target.value)}
                      placeholder="秒数"
                      className="w-20 rounded-lg border border-primary/15 px-2 py-1 text-xs outline-none transition-all focus:border-primary-light focus:ring-[3px] focus:ring-primary-soft"
                    />
                    <button
                      type="button"
                      onClick={insertPause}
                      className="rounded-lg border border-primary/20 bg-white px-2.5 py-1 text-xs text-slate-600 transition-all hover:bg-primary-soft active:scale-[0.98]"
                    >
                      插入停顿
                    </button>
                  </div>
                )}
              </div>
              <textarea
                ref={textareaRef}
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={100000}
                className="w-full rounded-[10px] border border-primary/15 bg-white px-3 py-2 text-sm outline-none transition-all hover:border-primary/30 focus:border-primary-light focus:ring-[3px] focus:ring-primary-soft"
              />
              <p className="mt-1 text-xs text-slate-muted">{charCount}</p>
            </div>

            {apiFormat === "openai" && (
              <>
                <div className="mt-4">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">语音指令（可选）：</label>
                  <input
                    type="text"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="如：请用欢快和兴奋的语气说话"
                    className="w-full rounded-[10px] border border-primary/15 px-3 py-2 text-sm outline-none transition-all focus:border-primary-light focus:ring-[3px] focus:ring-primary-soft"
                  />
                  <p className="mt-1 text-xs text-slate-muted">可用于指导语音情感、语气或风格</p>
                </div>

                <div className="mt-4">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">音频格式：</label>
                  <SearchableSelect
                    options={["mp3", "opus", "aac", "flac", "wav", "pcm"].map((f) => ({
                      value: f,
                      label: f.toUpperCase(),
                    }))}
                    value={audioFormat}
                    onChange={setAudioFormat}
                    searchPlaceholder="搜索格式..."
                    unit="种格式"
                  />
                </div>
              </>
            )}

            {apiFormat === "edge" && (
              <>
                <div className="mt-4">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    语速: <span className="font-normal">{rate}</span>
                  </label>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    className="slider w-full"
                    style={{ background: `linear-gradient(to right, #4a90e2 ${((rate + 100) / 200) * 100}%, #e2e8f0 ${((rate + 100) / 200) * 100}%)` }}
                  />
                </div>
                <div className="mt-4">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    语调: <span className="font-normal">{pitch}</span>
                  </label>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    value={pitch}
                    onChange={(e) => setPitch(Number(e.target.value))}
                    className="slider w-full"
                    style={{ background: `linear-gradient(to right, #4a90e2 ${((pitch + 100) / 200) * 100}%, #e2e8f0 ${((pitch + 100) / 200) * 100}%)` }}
                  />
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => generateVoice(true)}
              disabled={isGeneratingActive}
              className="mt-5 mb-3 flex w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-[#5bc0de] to-[#31b0d5] py-2.5 font-medium text-white transition-all hover:brightness-105 hover:-translate-y-px hover:shadow-md disabled:opacity-60 active:scale-[0.98]"
            >
              <Volume2 size={16} />
              试听前20个字
            </button>
            <button
              type="button"
              onClick={() => generateVoice(false)}
              disabled={isGeneratingActive}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary py-2.5 font-medium text-white transition-all hover:bg-primary-dark hover:-translate-y-px hover:shadow-md disabled:opacity-60 active:scale-[0.98]"
            >
              {isGeneratingActive && <LoaderCircle size={16} className="animate-spin" />}
              生成语音
            </button>

            {progress && (
              <div className="mt-4 text-center">
                <div className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white ${LOADING_STYLE}`}>
                  <LoaderCircle size={14} className="animate-spin" />
                  {progress.message}
                </div>
                {progress.percent >= 0 && (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-[#007bff] transition-all duration-300"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {result && (
              <div className="mt-4">
                <audio ref={audioRef} controls autoPlay className="mt-2 w-full rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.05)]" src={result.url} />
                <a
                  href={result.url}
                  download={result.filename}
                  className="mt-3 block w-full rounded-[10px] bg-gradient-to-r from-[#5cb85c] to-[#4cae4c] py-2.5 text-center font-medium text-white transition-all hover:brightness-105 hover:-translate-y-px active:scale-[0.98]"
                >
                  下载语音文件
                </a>
              </div>
            )}
          </div>
        </div>

        {/* 历史记录卡片 */}
        <HistoryCard
          items={history}
          playingId={playingId}
          onPlay={(item) => playAudio(item.blob, item.id)}
          onDownload={(item) => downloadBlob(item.blob, `audio-${item.label}.mp3`)}
          onClear={clearHistory}
        />
      </div>

      <ApiManagerModal
        open={apiManagerOpen}
        onClose={() => setApiManagerOpen(false)}
        customApis={customApis}
        onSaveApi={handleSaveApi}
        onCopyApi={handleCopyApi}
        onDeleteApis={handleDeleteApis}
        onImportApis={handleImportApis}
        onExportApis={handleExportApis}
      />
    </div>
  );
}

export default function LibreTtsApp() {
  return (
    <ToastProvider>
      <PasswordGate>
        <LibreTtsAppInner />
        <footer className="mt-2 py-2 text-center text-[0.9rem] text-slate-muted">
          <p className="mb-1">
            <a href="https://zwei.de.eu.org" target="_blank" rel="noreferrer" className="transition-colors hover:text-slate-700">
              Zwei
            </a>{" "}
            |{" "}
            <a
              href="https://github.com/LibreSpark/LibreTTS"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-slate-700"
            >
              Code
            </a>
          </p>
          <p className="m-0">
            由{" "}
            <a
              href="https://www.nodeseek.com/post-305185-1"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-slate-700"
            >
              NodeSupport
            </a>{" "}
            和{" "}
            <a
              href="https://yxvm.com/aff.php?aff=819"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-slate-700"
            >
              YXVM
            </a>{" "}
            赞助
          </p>
        </footer>
      </PasswordGate>
    </ToastProvider>
  );
}
