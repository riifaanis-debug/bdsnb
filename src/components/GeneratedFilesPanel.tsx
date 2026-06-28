import { useEffect, useState } from "react";
import { X, Play, Download, Edit3, Trash2, FolderOpen, Save, RefreshCw, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VOICE_OPTIONS } from "@/data";

export type GeneratedFileRow = {
  id: string;
  name: string;
  kind: string;
  preset_id: string | null;
  host_text: string | null;
  collector_text: string | null;
  full_script: string | null;
  host_voice: string | null;
  collector_voice: string | null;
  engine: string;
  audio_path: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onLoad: (file: GeneratedFileRow, signedAudioUrl: string | null) => void;
  refreshTick: number;
}

export default function GeneratedFilesPanel({ open, onClose, onLoad, refreshTick }: Props) {
  const [files, setFiles] = useState<GeneratedFileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<GeneratedFileRow>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("generated_files")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setFiles((data as GeneratedFileRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, refreshTick]);

  const getSignedUrl = async (path: string) => {
    const { data } = await supabase.storage.from("generated-audio").createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  };

  const handlePlay = async (f: GeneratedFileRow) => {
    let url: string | null = null;
    if (f.audio_path) url = await getSignedUrl(f.audio_path);
    onLoad(f, url);
    onClose();
  };

  const handleDownload = async (f: GeneratedFileRow) => {
    if (!f.audio_path) {
      alert("هذا الملف لا يحتوي على صوت محفوظ (تم توليده عبر متصفحك). افتحه ثم أعد توليده بالوضع السحابي ليتم حفظه.");
      return;
    }
    const url = await getSignedUrl(f.audio_path);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name.endsWith(".mp3") ? f.name : `${f.name}.mp3`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDelete = async (f: GeneratedFileRow) => {
    if (!confirm(`هل تريد حذف "${f.name}"؟`)) return;
    if (f.audio_path) {
      await supabase.storage.from("generated-audio").remove([f.audio_path]);
    }
    await supabase.from("generated_files").delete().eq("id", f.id);
    load();
  };

  const startEdit = (f: GeneratedFileRow) => {
    setEditingId(f.id);
    setDraft({ ...f });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase
      .from("generated_files")
      .update({
        name: draft.name,
        host_voice: draft.host_voice,
        collector_voice: draft.collector_voice,
        host_text: draft.host_text,
        collector_text: draft.collector_text,
        full_script: draft.full_script,
      })
      .eq("id", editingId);
    if (error) {
      alert("تعذر الحفظ: " + error.message);
      return;
    }
    setEditingId(null);
    setDraft({});
    load();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" dir="rtl">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-2xl h-full bg-[#0B0F19] border-l border-slate-800 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Database className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="font-black text-slate-100 text-lg">الملفات المولّدة</h2>
              <p className="text-[11px] text-slate-400">سجل تلقائي لكل الحوارات والملفات الصوتية</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer" title="تحديث">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-3 py-2 rounded-lg text-xs">{error}</div>
          )}
          {!loading && files.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-12">
              لا توجد ملفات محفوظة بعد. عند توليد أي حوار سيتم حفظه هنا تلقائياً.
            </div>
          )}

          {files.map((f) => {
            const isEditing = editingId === f.id;
            return (
              <div key={f.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                {!isEditing ? (
                  <>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-100 text-sm truncate">{f.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                          <span>{new Date(f.created_at).toLocaleString("ar-SA")}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{f.kind}</span>
                          <span className={`px-1.5 py-0.5 rounded ${f.engine === "cloud" ? "bg-indigo-600/20 text-indigo-300" : "bg-amber-600/20 text-amber-300"}`}>
                            {f.engine === "cloud" ? "Gemini" : "متصفح"}
                          </span>
                          {f.audio_path && <span className="text-emerald-400">● صوت محفوظ</span>}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1.5">
                          المذيع: <span className="text-indigo-300">{f.host_voice || "—"}</span>
                          {" • "}
                          المحصّل: <span className="text-amber-300">{f.collector_voice || "—"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button onClick={() => handlePlay(f)} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                        <FolderOpen className="w-3.5 h-3.5" /> فتح وتشغيل
                      </button>
                      {f.audio_path && (
                        <button onClick={() => handlePlay(f)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                          <Play className="w-3.5 h-3.5" /> تشغيل
                        </button>
                      )}
                      <button onClick={() => handleDownload(f)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                        <Download className="w-3.5 h-3.5" /> تحميل
                      </button>
                      <button onClick={() => startEdit(f)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                        <Edit3 className="w-3.5 h-3.5" /> تعديل
                      </button>
                      <button onClick={() => handleDelete(f)} className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" /> حذف
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] text-slate-400 font-bold block mb-1">الاسم</label>
                      <input
                        value={draft.name || ""}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-400 font-bold block mb-1">صوت المذيع</label>
                        <select
                          value={draft.host_voice || ""}
                          onChange={(e) => setDraft({ ...draft, host_voice: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100"
                        >
                          {VOICE_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 font-bold block mb-1">صوت المحصّل</label>
                        <select
                          value={draft.collector_voice || ""}
                          onChange={(e) => setDraft({ ...draft, collector_voice: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100"
                        >
                          {VOICE_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                        </select>
                      </div>
                    </div>
                    {draft.full_script !== null && draft.full_script !== undefined && (
                      <div>
                        <label className="text-[11px] text-slate-400 font-bold block mb-1">نص الحوار الكامل</label>
                        <textarea
                          value={draft.full_script || ""}
                          onChange={(e) => setDraft({ ...draft, full_script: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 h-40 resize-none"
                        />
                      </div>
                    )}
                    {(draft.host_text || draft.collector_text) && (
                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <label className="text-[11px] text-slate-400 font-bold block mb-1">نص المذيع</label>
                          <textarea
                            value={draft.host_text || ""}
                            onChange={(e) => setDraft({ ...draft, host_text: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 h-24 resize-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 font-bold block mb-1">نص المحصّل</label>
                          <textarea
                            value={draft.collector_text || ""}
                            onChange={(e) => setDraft({ ...draft, collector_text: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 h-24 resize-none"
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button onClick={saveEdit} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                        <Save className="w-3.5 h-3.5" /> حفظ التعديلات
                      </button>
                      <button onClick={() => { setEditingId(null); setDraft({}); }} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer">
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/50 text-[11px] text-slate-500 text-center">
          يتم حفظ كل حوار يتم توليده تلقائياً في قاعدة بيانات Lovable Cloud.
        </div>
      </div>
    </div>
  );
}
