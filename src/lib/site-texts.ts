import { useEffect, useState } from "react";
import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export interface SiteText {
  key: string;
  group_key: string;
  label: string;
  value: string;
}

interface SiteTextsState {
  texts: Record<string, string>;
  all: SiteText[];
  loaded: boolean;
  load: () => Promise<void>;
  update: (key: string, value: string) => Promise<void>;
}

export const useSiteTextsStore = create<SiteTextsState>((set, get) => ({
  texts: {},
  all: [],
  loaded: false,
  load: async () => {
    const { data, error } = await supabase
      .from("site_texts")
      .select("key,group_key,label,value")
      .order("group_key", { ascending: true });
    if (error) {
      set({ loaded: true });
      return;
    }
    const rows = (data ?? []) as SiteText[];
    const map: Record<string, string> = {};
    rows.forEach((row) => (map[row.key] = row.value));
    set({ all: rows, texts: map, loaded: true });
  },
  update: async (key, value) => {
    const { error } = await supabase
      .from("site_texts")
      .update({ value })
      .eq("key", key);
    if (error) throw error;
    const all = get().all.map((t) => (t.key === key ? { ...t, value } : t));
    const texts = { ...get().texts, [key]: value };
    set({ all, texts });
  },
}));

let started = false;
export function useSiteTextsSync() {
  const load = useSiteTextsStore((s) => s.load);
  useEffect(() => {
    if (started) return;
    started = true;
    void load();
    const ch = supabase
      .channel("site_texts_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_texts" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
      started = false;
    };
  }, [load]);
}

export function useSiteText(key: string, fallback: string): string {
  const value = useSiteTextsStore((s) => s.texts[key]);
  const loaded = useSiteTextsStore((s) => s.loaded);
  // While loading, just show fallback to avoid flash
  return loaded ? (value ?? fallback) : fallback;
}

// Settings (key/value JSONB) -----------------------------------------------

export interface SupplierReminderSettings {
  timing: "evening_before" | "morning_of" | "both";
  recipients: string[]; // user_ids
}

const DEFAULT_REMINDERS: SupplierReminderSettings = {
  timing: "morning_of",
  recipients: [],
};

export async function fetchAppSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return ((data?.value as T) ?? fallback) as T;
}

export async function saveAppSetting<T>(key: string, value: T): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value: value as never }, { onConflict: "key" });
  if (error) throw error;
}

export function useSupplierReminderSettings() {
  const [settings, setSettings] = useState<SupplierReminderSettings>(DEFAULT_REMINDERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchAppSetting<SupplierReminderSettings>("supplier_reminders", DEFAULT_REMINDERS).then(
      (v) => {
        if (cancelled) return;
        setSettings(v);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (next: SupplierReminderSettings) => {
    await saveAppSetting("supplier_reminders", next);
    setSettings(next);
  };

  return { settings, setLocal: setSettings, save, loading };
}
