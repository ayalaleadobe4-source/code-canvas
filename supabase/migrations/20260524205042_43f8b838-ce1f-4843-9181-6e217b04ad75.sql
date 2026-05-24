
-- Profiles table (linked to auth users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- GitHub OAuth connections (token stored encrypted via pgsodium-like approach: we just store it; RLS protects)
CREATE TABLE public.github_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_username TEXT NOT NULL,
  github_user_id BIGINT NOT NULL,
  access_token TEXT NOT NULL,
  scope TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own gh connection" ON public.github_connections FOR SELECT USING (auth.uid() = user_id);
-- Inserts/updates go through server functions using service role (no direct client write policies)

-- Projects (linked GitHub repos)
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, repo_owner, repo_name)
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- Edit sessions (a working session = a branch of pending edits)
CREATE TABLE public.edit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_branch TEXT NOT NULL,
  base_commit_sha TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.edit_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own sessions" ON public.edit_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sessions" ON public.edit_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sessions" ON public.edit_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sessions" ON public.edit_sessions FOR DELETE USING (auth.uid() = user_id);

-- Pending file changes within a session
CREATE TABLE public.pending_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.edit_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  original_content TEXT,
  modified_content TEXT NOT NULL,
  element_loc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pending_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own changes" ON public.pending_changes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own changes" ON public.pending_changes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own changes" ON public.pending_changes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own changes" ON public.pending_changes FOR DELETE USING (auth.uid() = user_id);
