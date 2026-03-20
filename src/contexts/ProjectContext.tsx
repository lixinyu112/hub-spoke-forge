import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Project = Tables<"projects">;

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  setCurrentProject: (p: Project | null) => void;
  loading: boolean;
  createProject: (name: string, description?: string) => Promise<Project>;
  refetch: () => void;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    const list = data || [];
    setProjects(list);
    if (!currentProject && list.length > 0) {
      setCurrentProject(list[0]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, []);

  const createProject = async (name: string, description?: string) => {
    const { data, error } = await supabase.from("projects").insert({ name, description }).select().single();
    if (error) throw error;
    await fetchProjects();
    setCurrentProject(data);
    return data;
  };

  return (
    <ProjectContext.Provider value={{ projects, currentProject, setCurrentProject, loading, createProject, refetch: fetchProjects }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
