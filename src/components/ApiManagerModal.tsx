"use client";

// 自定义 API 管理弹窗：新增/编辑/复制/删除/批量删除、获取模型、导入导出
import { useEffect, useRef, useState } from "react";
import { Copy, FileDown, FileUp, LoaderCircle, Pencil, Trash2, X } from "lucide-react";
import type { CustomApi } from "@/lib/types";
import { fetchModelList } from "@/lib/customApis";
import type { CustomApiMap } from "@/lib/customApis";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ToastProvider";

interface ApiManagerModalProps {
  open: boolean;
  onClose: () => void;
  customApis: CustomApiMap;
  onSaveApi: (api: CustomApi) => void;
  onCopyApi: (id: string) => void;
  onDeleteApis: (ids: string[]) => void;
  onImportApis: (apis: CustomApi[]) => void;
  onExportApis: () => void;
}

interface FormState {
  name: string;
  format: "openai" | "edge";
  endpoint: string;
  apiKey: string;
  modelEndpoint: string;
  manualSpeakers: string;
  maxLength: string;
  enableSegmentation: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  format: "openai",
  endpoint: "",
  apiKey: "",
  modelEndpoint: "",
  manualSpeakers: "",
  maxLength: "",
  enableSegmentation: true,
};

export default function ApiManagerModal({
  open,
  onClose,
  customApis,
  onSaveApi,
  onCopyApi,
  onDeleteApis,
  onImportApis,
  onExportApis,
}: ApiManagerModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { show } = useToast();

  // 每次打开时重置表单与选择状态
  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setEditingId(null);
      setBatchMode(false);
      setSelectedIds([]);
      setSelectAll(false);
    }
  }, [open]);

  if (!open) return null;

  const isOpenAi = form.format === "openai";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.endpoint.trim()) {
      show("请填写API名称和端点URL", "warning");
      return;
    }
    const manual = form.manualSpeakers
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const api: CustomApi = {
      id: editingId || `custom-${Date.now()}`,
      name: form.name.trim(),
      format: form.format,
      endpoint: form.endpoint.trim(),
      apiKey: form.apiKey.trim() || undefined,
      modelEndpoint: form.modelEndpoint.trim() || undefined,
      manual: manual.length ? manual : undefined,
      maxLength: form.maxLength ? parseInt(form.maxLength) : null,
      enableSegmentation: form.enableSegmentation,
    };
    onSaveApi(api);
    show(editingId ? `已更新API: ${api.name}` : `已保存API: ${api.name}`, "success");
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function editApi(api: CustomApi) {
    setEditingId(api.id);
    setForm({
      name: api.name,
      format: api.format,
      endpoint: api.endpoint,
      apiKey: api.apiKey || "",
      modelEndpoint: api.modelEndpoint || "",
      manualSpeakers: (api.manual || []).join(","),
      maxLength: api.maxLength ? String(api.maxLength) : "",
      enableSegmentation: api.enableSegmentation !== false,
    });
  }

  async function handleFetchModels() {
    if (!form.modelEndpoint.trim()) {
      show("请先填写模型列表端点", "warning");
      return;
    }
    setFetchingModels(true);
    try {
      const models = await fetchModelList({
        modelEndpoint: form.modelEndpoint.trim(),
        apiKey: form.apiKey.trim() || undefined,
        format: form.format,
      });
      if (models.length === 0) {
        show("未获取到模型", "warning");
      } else {
        update("manualSpeakers", models.join(","));
        show(`已获取 ${models.length} 个模型`, "success");
      }
    } catch (err) {
      show(err instanceof Error ? err.message : "获取模型失败", "danger");
    } finally {
      setFetchingModels(false);
    }
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data.apis || !Array.isArray(data.apis)) {
          throw new Error("文件格式不正确：缺少 apis 数组");
        }
        const apis: CustomApi[] = data.apis.filter((a: CustomApi) => a && a.name && a.endpoint);
        onImportApis(apis);
      } catch (err) {
        show(err instanceof Error ? err.message : "导入失败", "danger");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const apiEntries = Object.values(customApis);

  return (
    <div className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto bg-black/50 py-10">
      <div
        className="mx-4 w-full max-w-2xl rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h5 className="text-lg font-medium text-slate-800">管理自定义API</h5>
          <button type="button" onClick={onClose} className="text-slate-400 transition-colors hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-4">
          <div className="mb-4 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-700">
            您可以添加自定义的TTS API。支持两种格式：OpenAI格式和Edge API格式。
          </div>

          <form onSubmit={submitForm} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                API名称 <span className="font-normal text-slate-faint">(显示在下拉菜单中)</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="例如: 我的自定义API"
                required
                className="w-full rounded-[10px] border border-primary/15 px-3 py-2 text-sm outline-none transition-all focus:border-primary-light focus:ring-[3px] focus:ring-primary-soft"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">API格式</label>
              <SearchableSelect
                options={[
                  { value: "openai", label: "OpenAI 格式" },
                  { value: "edge", label: "Edge API 格式" },
                ]}
                value={form.format}
                onChange={(v) => update("format", v as "openai" | "edge")}
                searchPlaceholder="搜索格式..."
                unit="种格式"
              />
              <p className="mt-1 text-xs text-slate-muted">
                选择您的API所使用的格式，这将影响请求的参数格式
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">API端点URL</label>
              <input
                type="url"
                value={form.endpoint}
                onChange={(e) => update("endpoint", e.target.value)}
                placeholder={isOpenAi ? "https://api.openai.com/v1/audio/speech" : "https://your-api.example.com/tts"}
                required
                className="w-full rounded-[10px] border border-primary/15 px-3 py-2 text-sm outline-none transition-all focus:border-primary-light focus:ring-[3px] focus:ring-primary-soft"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                API密钥 <span className="font-normal text-slate-faint">(可选)</span>
              </label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => update("apiKey", e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-[10px] border border-primary/15 px-3 py-2 text-sm outline-none transition-all focus:border-primary-light focus:ring-[3px] focus:ring-primary-soft"
              />
              <p className="mt-1 text-xs text-slate-muted">
                对于OpenAI格式，使用Bearer Token；对于Edge API格式，可以使用&quot;x-api-key: 值&quot;或Bearer Token
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                模型列表端点 <span className="font-normal text-slate-faint">(用于获取可用的模型/讲述人)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={form.modelEndpoint}
                  onChange={(e) => update("modelEndpoint", e.target.value)}
                  placeholder={isOpenAi ? "https://api.openai.com/v1/models" : "https://api.example.com/v1/models"}
                  className="min-w-0 flex-1 rounded-[10px] border border-primary/15 px-3 py-2 text-sm outline-none transition-all focus:border-primary-light focus:ring-[3px] focus:ring-primary-soft"
                />
                <button
                  type="button"
                  onClick={handleFetchModels}
                  disabled={fetchingModels}
                  className="flex shrink-0 items-center gap-1 rounded-[10px] border border-primary/20 bg-white px-3 py-2 text-sm text-slate-600 transition-all hover:bg-primary-soft disabled:opacity-60"
                >
                  {fetchingModels && <LoaderCircle size={13} className="animate-spin" />}
                  获取模型
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                自定义讲述人列表 <span className="font-normal text-slate-faint">(逗号分隔)</span>
              </label>
              <textarea
                value={form.manualSpeakers}
                onChange={(e) => update("manualSpeakers", e.target.value)}
                rows={2}
                placeholder="voice1,voice2,voice3"
                className="w-full rounded-[10px] border border-primary/15 px-3 py-2 text-sm outline-none transition-all focus:border-primary-light focus:ring-[3px] focus:ring-primary-soft"
              />
              <p className="mt-1 text-xs text-slate-muted">
                如果无法自动获取模型，您可以手动输入讲述人列表
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">最大请求长度</label>
              <input
                type="number"
                value={form.maxLength}
                onChange={(e) => update("maxLength", e.target.value)}
                placeholder="例如: 5000"
                className="w-full rounded-[10px] border border-primary/15 px-3 py-2 text-sm outline-none transition-all focus:border-primary-light focus:ring-[3px] focus:ring-primary-soft"
              />
              <p className="mt-1 text-xs text-slate-muted">
                此 API 文本最大字符数限制，留空表示使用默认限制
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">长文本处理</label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.enableSegmentation}
                  onChange={(e) => update("enableSegmentation", e.target.checked)}
                  className="h-4 w-4 accent-[#4a90e2]"
                />
                启用自动分段（超出长度限制时将文本分段处理）
              </label>
              <p className="mt-1 text-xs text-slate-muted">关闭后，超长文本将被截断而不是分段</p>
            </div>

            <button
              type="submit"
              className="rounded-[10px] bg-primary px-5 py-2 text-sm font-medium text-white transition-all hover:bg-primary-dark active:scale-[0.98]"
            >
              {editingId ? "更新API" : "保存API"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
                className="ml-2 rounded-[10px] border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-all hover:bg-slate-50"
              >
                取消编辑
              </button>
            )}
          </form>

          <hr className="my-6 border-slate-100" />

          <div className="mb-3 flex items-center justify-between">
            <h6 className="m-0 text-sm font-medium text-slate-700">已保存的自定义API</h6>
            <div className="flex gap-1.5">
              <button
                type="button"
                title="导出所有自定义API配置"
                onClick={onExportApis}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition-all hover:bg-slate-50"
              >
                <FileDown size={13} /> 导出
              </button>
              <button
                type="button"
                title="导入自定义API配置"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition-all hover:bg-slate-50"
              >
                <FileUp size={13} /> 导入
              </button>
              {batchMode && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedIds.length === 0) {
                      show("请先选择要删除的API", "warning");
                      return;
                    }
                    if (confirm(`确定要删除选中的 ${selectedIds.length} 个API吗？`)) {
                      onDeleteApis(selectedIds);
                      setBatchMode(false);
                      setSelectedIds([]);
                      setSelectAll(false);
                    }
                  }}
                  className="flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1.5 text-xs text-white transition-all hover:bg-red-600"
                >
                  <Trash2 size={13} /> 删除选中
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (apiEntries.length === 0) {
                    show("没有可管理的自定义API", "info");
                    return;
                  }
                  setBatchMode((m) => !m);
                  setSelectedIds([]);
                  setSelectAll(false);
                }}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition-all hover:bg-slate-50"
              >
                {batchMode ? "取消" : "批量管理"}
              </button>
            </div>
          </div>

          {batchMode && apiEntries.length > 0 && (
            <div className="mb-2 rounded-lg bg-slate-50 px-3 py-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={(e) => {
                    setSelectAll(e.target.checked);
                    setSelectedIds(e.target.checked ? apiEntries.map((a) => a.id) : []);
                  }}
                  className="h-4 w-4 accent-[#4a90e2]"
                />
                全选
              </label>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />

          <div className="mt-3 space-y-2">
            {apiEntries.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-faint">暂无自定义API</div>
            ) : (
              apiEntries.map((api) => (
                <div
                  key={api.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 border-l-[3px] border-l-transparent px-4 py-3 transition-all hover:border-l-primary hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {batchMode && (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(api.id)}
                        onChange={(e) => {
                          setSelectedIds((prev) =>
                            e.target.checked ? [...prev, api.id] : prev.filter((id) => id !== api.id)
                          );
                        }}
                        className="h-4 w-4 shrink-0 accent-[#4a90e2]"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-800">{api.name}</div>
                      <div className="truncate text-xs text-slate-muted">
                        {api.endpoint} · {api.format === "openai" ? "OpenAI格式" : "Edge API格式"}
                        {api.manual?.length ? ` · ${api.manual.length} 个讲述人` : ""}
                      </div>
                    </div>
                  </div>
                  {!batchMode && (
                    <div className="ml-3 flex shrink-0 gap-1">
                      <button
                        type="button"
                        title="编辑"
                        onClick={() => editApi(api)}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-primary-soft hover:text-primary"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        title="复制"
                        onClick={() => onCopyApi(api.id)}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-primary-soft hover:text-primary"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        title="删除"
                        onClick={() => {
                          if (confirm(`确定要删除自定义API「${api.name}」吗？`)) {
                            onDeleteApis([api.id]);
                          }
                        }}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-all hover:bg-slate-50"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
