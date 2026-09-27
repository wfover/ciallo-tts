"use client";

// 全局消息提示体系（替代 jQuery 版 showMessage/showError/showInfo/showWarning）
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CircleCheck, CircleX, Info, TriangleAlert, LoaderCircle } from "lucide-react";

type ToastType = "danger" | "warning" | "info" | "success";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
  /** 生成进度：显示固定位置的进度提示（percent < 0 表示无进度条） */
  progress: { message: string; percent: number } | null;
  showProgress: (message: string, percent?: number) => void;
  hideProgress: () => void;
}

const ToastContext = createContext<ToastContextValue>({
  show: () => {},
  progress: null,
  showProgress: () => {},
  hideProgress: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const TYPE_STYLES: Record<ToastType, string> = {
  danger: "bg-gradient-to-r from-red-500 to-red-600",
  warning: "bg-gradient-to-r from-amber-500 to-amber-600",
  info: "bg-gradient-to-r from-blue-500 to-blue-600",
  success: "bg-gradient-to-r from-emerald-500 to-emerald-600",
};

const TYPE_ICONS: Record<ToastType, React.ReactNode> = {
  danger: <CircleX size={16} />,
  warning: <TriangleAlert size={16} />,
  info: <Info size={16} />,
  success: <CircleCheck size={16} />,
};

const LOADING_STYLE = "bg-gradient-to-r from-indigo-500 to-indigo-600";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [progress, setProgress] = useState<{ message: string; percent: number } | null>(null);
  const nextId = useRef(0);

  const show = useCallback((message: string, type: ToastType = "info") => {
    const id = ++nextId.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const showProgress = useCallback((message: string, percent = -1) => {
    setProgress({ message, percent });
  }, []);

  const hideProgress = useCallback(() => setProgress(null), []);

  return (
    <ToastContext.Provider value={{ show, progress, showProgress, hideProgress }}>
      {children}
      <div className="fixed top-4 right-4 left-4 sm:left-auto z-[9999] flex flex-col-reverse gap-2 sm:max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm text-white shadow-lg transition-all duration-300 ${TYPE_STYLES[toast.type]}`}
          >
            {TYPE_ICONS[toast.type]}
            <span className="break-all">{toast.message}</span>
          </div>
        ))}
        {progress && (
          <div className={`rounded-lg px-4 py-3 text-sm text-white shadow-lg ${LOADING_STYLE}`}>
            <div className="flex items-center gap-2">
              <LoaderCircle size={14} className="animate-spin" />
              <span className="break-all">{progress.message}</span>
            </div>
            {progress.percent >= 0 && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full rounded-full bg-white transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export { LOADING_STYLE, LoaderCircle };
