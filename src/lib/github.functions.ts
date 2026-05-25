import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildGithubAuthorizeUrl,
  getOctokitForUser,
} from "./github.server";

export const getGithubAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return { url: buildGithubAuthorizeUrl(context.userId) };
  });

export const getGithubStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("github_connections")
      .select("github_username, connected_at")
      .maybeSingle();
    return { connected: !!data, username: data?.github_username ?? null };
  });

export const listMyRepos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const octo = await getOctokitForUser(context.userId);
    if (!octo) return { repos: [], error: "GitHub not connected" };
    const { data } = await octo.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: "updated",
      affiliation: "owner,collaborator",
    });
    return {
      repos: data.map((r) => ({
        id: r.id,
        full_name: r.full_name,
        owner: r.owner.login,
        name: r.name,
        default_branch: r.default_branch,
        private: r.private,
        description: r.description,
        updated_at: r.updated_at,
      })),
      error: null,
    };
  });

export const addProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ owner: z.string().min(1), name: z.string().min(1), default_branch: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("projects")
      .insert({
        repo_owner: data.owner,
        repo_name: data.name,
        default_branch: data.default_branch,
        user_id: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { project: row };
  });

export const listMyProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    return { projects: data ?? [] };
  });

export const getProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("projects")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    return { project: row };
  });

export const getRepoTree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ projectId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: proj } = await context.supabase
      .from("projects")
      .select("*")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!proj) throw new Error("Project not found");
    const octo = await getOctokitForUser(context.userId);
    if (!octo) throw new Error("GitHub not connected");
    const { data: branch } = await octo.repos.getBranch({
      owner: proj.repo_owner,
      repo: proj.repo_name,
      branch: proj.default_branch,
    });
    const { data: tree } = await octo.git.getTree({
      owner: proj.repo_owner,
      repo: proj.repo_name,
      tree_sha: branch.commit.sha,
      recursive: "true",
    });
    return {
      sha: branch.commit.sha,
      tree: tree.tree
        .filter((t) => t.type === "blob")
        .map((t) => ({ path: t.path!, sha: t.sha!, size: t.size ?? 0 })),
    };
  });

export const getFileContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ projectId: z.string().uuid(), path: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: proj } = await context.supabase
      .from("projects")
      .select("*")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!proj) throw new Error("Project not found");
    const octo = await getOctokitForUser(context.userId);
    if (!octo) throw new Error("GitHub not connected");
    const { data: file } = await octo.repos.getContent({
      owner: proj.repo_owner,
      repo: proj.repo_name,
      path: data.path,
      ref: proj.default_branch,
    });
    if (Array.isArray(file) || file.type !== "file") throw new Error("Not a file");
    const content = Buffer.from(file.content, file.encoding as BufferEncoding).toString("utf8");
    return { content, sha: file.sha, path: file.path };
  });
