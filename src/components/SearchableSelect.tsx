"use client";

// 可搜索下拉框（受控组件，替代 jQuery 版 enhanceSelect）：
// 搜索过滤、命中高亮、计数、键盘 ↑↓/Enter/Esc、点外关闭、实例互斥展开
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, XCircle } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** options 为空时显示的占位文本（如“加载中...”） */
  emptyText?: string;
  searchPlaceholder?: string;
  /** 计数单位，如“位讲述人” */
  unit?: string;
  /** 选项下方是否显示 value 副标题 */
  showSub?: boolean;
  disabled?: boolean;
  /** 选中项为空时显示的文本 */
  placeholder?: string;
  /** input-group 内左侧圆角压平适配 */
  joined?: boolean;
  className?: string;
}

// 实例互斥：打开一个时关闭其他已展开实例
const closeHandlers = new Set<() => void>();

function highlight(text: string, kw: string): React.ReactNode {
  if (!kw) return text;
  const idx = text.toLowerCase().indexOf(kw.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-amber-400/40 px-0 text-inherit">
        {text.slice(idx, idx + kw.length)}
      </mark>
      {text.slice(idx + kw.length)}
    </>
  );
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  emptyText,
  searchPlaceholder = "搜索...",
  unit = "项",
  showSub = false,
  disabled = false,
  placeholder = "请选择",
  joined = false,
  className = "",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const instanceId = useId();

  const selected = options.find((o) => o.value === value);

  const matched = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(kw) || o.value.toLowerCase().includes(kw)
    );
  }, [options, keyword]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  function openPanel() {
    // 关闭其他实例
    closeHandlers.forEach((close) => close());
    setOpen(true);
    setKeyword("");
    setActiveIndex(-1);
  }

  function select(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { openPanel(); return; }
      setActiveIndex((i) => (matched.length ? (i + 1 + matched.length) % matched.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (matched.length ? (i - 1 + matched.length) % matched.length : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && matched[activeIndex]) select(matched[activeIndex].value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  // 打开时聚焦搜索框；有选中项时滚动到可视区域
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    closeHandlers.add(close);
    searchRef.current?.focus();
    const selectedEl = listRef.current?.querySelector(".voice-option-selected");
    if (selectedEl) {
      const list = listRef.current!;
      list.scrollTop = (selectedEl as HTMLElement).offsetTop - list.clientHeight / 2;
    }
    return () => {
      closeHandlers.delete(close);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`voice-select relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className={`flex h-[42px] w-full items-center justify-between gap-2 rounded-[10px] border border-primary/15 bg-white px-3 text-left text-sm transition-all duration-200 hover:border-primary/30 focus:border-primary-light focus:ring-[3px] focus:ring-primary-soft focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${joined ? "rounded-r-none" : ""}`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "text-slate-800" : "text-slate-faint"}`}>
          {selected ? selected.label : (emptyText || placeholder)}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`absolute top-[calc(100%+6px)] left-0 right-0 z-1050 rounded-xl border border-primary/15 bg-white opacity-0 shadow-[0_10px_30px_rgba(15,40,80,0.18)] transition-all duration-200 pointer-events-none -translate-y-1.5 ${open ? "translate-y-0 opacity-100 pointer-events-auto" : ""}`}
      >
        <div className="flex items-center gap-2 border-b border-primary/10 px-3 py-2.5">
          <Search size={14} className="shrink-0 text-slate-faint" />
          <input
            ref={searchRef}
            type="text"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-300"
          />
          {keyword && (
            <button
              type="button"
              aria-label="清空搜索"
              onClick={() => {
                setKeyword("");
                searchRef.current?.focus();
              }}
              className="shrink-0 text-slate-300 transition-colors hover:text-slate-muted"
            >
              <XCircle size={15} />
            </button>
          )}
        </div>
        <div className="px-3.5 pt-1.5 text-xs text-slate-faint">
          {keyword ? `匹配 ${matched.length} ${unit}` : `共 ${options.length} ${unit}`}
        </div>

        <div ref={listRef} className="voice-list mt-1 max-h-[260px] overflow-y-auto p-1.5">
          {options.length === 0 && emptyText ? (
            <div className="px-4 py-5 text-center text-sm text-slate-faint">{emptyText}</div>
          ) : matched.length === 0 ? (
            <div className="flex items-center justify-center gap-1.5 px-4 py-5 text-center text-sm text-slate-faint">
              <Search size={13} /> 未找到匹配项
            </div>
          ) : (
            matched.map((o, i) => {
              const isSelected = o.value === value;
              const isActive = i === activeIndex;
              return (
                <div
                  key={o.value}
                  role="option"
                  aria-selected={isSelected}
                  data-instance={instanceId}
                  onClick={() => select(o.value)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`voice-option cursor-pointer rounded-lg px-2.5 py-2 transition-colors duration-150 ${
                    isSelected
                      ? "voice-option-selected bg-gradient-to-r from-[#4a90e2] to-[#6bb5ff]"
                      : isActive
                        ? "bg-primary-soft"
                        : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate text-[0.95rem] ${isSelected ? "text-white" : "text-slate-800"}`}
                    >
                      {highlight(o.label, keyword.trim())}
                    </span>
                    {isSelected && <Check size={13} className="shrink-0 text-white" />}
                  </div>
                  {showSub && o.value !== o.label && (
                    <span
                      className={`block truncate text-xs ${isSelected ? "text-white/85" : "text-slate-faint"}`}
                    >
                      {highlight(o.value, keyword.trim())}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
