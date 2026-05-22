import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SiteContent {
  [key: string]: string; // "key:locale" → value
}

interface EditModeCtx {
  isEditMode: boolean;
  toggleEditMode: () => void;
  getContent: (key: string, locale: string, fallback: string) => string;
  saveContent: (key: string, locale: string, value: string) => Promise<void>;
}

const EditModeContext = createContext<EditModeCtx>({
  isEditMode: false,
  toggleEditMode: () => {},
  getContent: (_k, _l, fallback) => fallback,
  saveContent: async () => {},
});

export function useEditMode() {
  return useContext(EditModeContext);
}

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [content, setContent] = useState<SiteContent>({});

  // Load all site_content on mount
  useEffect(() => {
    supabase
      .from("site_content")
      .select("key, locale, value")
      .then(({ data }) => {
        if (!data) return;
        const map: SiteContent = {};
        data.forEach((row) => {
          map[`${row.key}:${row.locale}`] = row.value;
        });
        setContent(map);
      });
  }, []);

  const getContent = useCallback(
    (key: string, locale: string, fallback: string) => {
      return content[`${key}:${locale}`] ?? content[`${key}:sv`] ?? fallback;
    },
    [content]
  );

  const saveContent = useCallback(async (key: string, locale: string, value: string) => {
    const { error } = await supabase
      .from("site_content")
      .upsert({ key, locale, value, updated_at: new Date().toISOString() }, { onConflict: "key,locale" });
    if (!error) {
      setContent((prev) => ({ ...prev, [`${key}:${locale}`]: value }));
    }
  }, []);

  return (
    <EditModeContext.Provider value={{ isEditMode, toggleEditMode: () => setIsEditMode((v) => !v), getContent, saveContent }}>
      {children}
    </EditModeContext.Provider>
  );
}
