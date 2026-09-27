"use client";

// 历史记录卡片：50 条上限、点击回填播放、逐条下载、清除
import { Download, Pause, Play } from "lucide-react";
import type { HistoryItem } from "@/lib/types";

interface HistoryCardProps {
  items: HistoryItem[];
  playingId: number | null;
  onPlay: (item: HistoryItem) => void;
  onDownload: (item: HistoryItem) => void;
  onClear: () => void;
}

function cleanText(text: string): string {
  return text.replace(/<break\s+time=["'](\d+(?:\.\d+)?[ms]s?)["']\s*\/>/g, "").trim();
}

export default function HistoryCard({ items, playingId, onPlay, onDownload, onClear }: HistoryCardProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[15px] border-none shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_25px_rgba(99,102,241,0.08)]">
      <div className="relative overflow-hidden rounded-t-[15px] bg-gradient-to-r from-[#4a90e2] to-[#6bb5ff] px-4 py-4">
        <h2 className="relative m-0 text-center text-2xl font-medium text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]">
          历史记录
        </h2>
      </div>
      <div className="flex flex-1 flex-col rounded-b-[15px] bg-gradient-to-b from-white to-[#e6f0f8] p-4">
        <button
          type="button"
          onClick={onClear}
          className="mb-3 w-full shrink-0 rounded-[10px] bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] py-2 font-medium text-white transition-all hover:from-[#f59e0b] hover:to-[#d97706] active:scale-[0.98]"
        >
          清除历史
        </button>
        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-10 text-sm text-slate-faint">
            暂无历史记录，生成语音后会显示在这里
          </div>
        ) : (
          <div className="history-container max-h-[560px] min-h-0 flex-1 overflow-y-auto p-0.5">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  onPlay(item);
                }}
                className="mb-3 cursor-pointer rounded-[10px] border border-primary/8 bg-gradient-to-br from-white to-[#f8faff] p-4 transition-all duration-200 hover:-translate-y-px hover:border-primary/15 hover:from-[#f8faff] hover:to-[#f0f7ff] hover:shadow-[0_4px_12px_rgba(99,102,241,0.08)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1 text-sm text-slate-700">
                    <span className="mr-1 font-medium text-primary">#{item.label}</span>
                    {item.timestamp} - <span className="text-primary">{item.speaker}</span> -{" "}
                    {cleanText(item.text).slice(0, 7)}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      title="播放"
                      onClick={() => onPlay(item)}
                      className="rounded-lg border border-primary/20 bg-white p-1.5 text-primary transition-all hover:bg-primary-soft active:scale-95"
                    >
                      {playingId === item.id ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button
                      type="button"
                      title="下载"
                      onClick={() => onDownload(item)}
                      className="rounded-lg border border-primary/20 bg-white p-1.5 text-primary transition-all hover:bg-primary-soft active:scale-95"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
                {item.requestInfo && (
                  <div className="mt-1 truncate text-xs text-slate-faint">{item.requestInfo}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
