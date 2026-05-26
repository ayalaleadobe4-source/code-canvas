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

export const commitFileChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        projectId: z.string().uuid(),
        path: z.string().min(1),
        content: z.string(),
        message: z.string().min(1).max(200),
      })
      .parse(d),
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

    const owner = proj.repo_owner;
    const repo = proj.repo_name;
    const base = proj.default_branch;

    // Get base ref
    const { data: baseRef } = await octo.git.getRef({
      owner,
      repo,
      ref: `heads/${base}`,
    });
    const baseSha = baseRef.object.sha;

    // Create new branch
    const branch = `lovable-visual-edit-${Date.now()}`;
    await octo.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: baseSha,
    });

    // Get existing file sha on that branch
    let fileSha: string | undefined;
    try {
      const { data: existing } = await octo.repos.getContent({
        owner,
        repo,
        path: data.path,
        ref: branch,
      });
      if (!Array.isArray(existing) && existing.type === "file") {
        fileSha = existing.sha;
      }
    } catch {
      // file may not exist yet
    }

    // Commit change
    await octo.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: data.path,
      message: data.message,
      content: Buffer.from(data.content, "utf8").toString("base64"),
      branch,
      sha: fileSha,
    });

    // Open PR
    const { data: pr } = await octo.pulls.create({
      owner,
      repo,
      title: data.message,
      head: branch,
      base,
      body: `Edited via Lovable Visual Editor.\n\n- File: \`${data.path}\``,
    });

    return { branch, prUrl: pr.html_url, prNumber: pr.number };
  });

// =========================
// Session-batched edits
// =========================

export const getOrCreateSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("edit_sessions")
      .select("*")
      .eq("project_id", data.projectId)
      .eq("user_id", userId)
      .eq("status", "open")
      .maybeSingle();
    if (existing) return { session: existing };

    const { data: proj } = await supabase
      .from("projects")
      .select("default_branch")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!proj) throw new Error("Project not found");

    const { data: row, error } = await supabase
      .from("edit_sessions")
      .insert({
        project_id: data.projectId,
        user_id: userId,
        base_branch: proj.default_branch,
        status: "open",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { session: row };
  });

export const upsertPendingChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sessionId: z.string().uuid(),
        filePath: z.string().min(1),
        originalContent: z.string().optional(),
        modifiedContent: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("pending_changes")
      .select("id")
      .eq("session_id", data.sessionId)
      .eq("file_path", data.filePath)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("pending_changes")
        .update({ modified_content: data.modifiedContent })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }
    const { data: row, error } = await supabase
      .from("pending_changes")
      .insert({
        session_id: data.sessionId,
        user_id: userId,
        file_path: data.filePath,
        original_content: data.originalContent ?? null,
        modified_content: data.modifiedContent,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listPendingChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("pending_changes")
      .select("id, file_path, modified_content, created_at")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: true });
    return { changes: rows ?? [] };
  });

export const discardPendingChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("pending_changes")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const commitSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sessionId: z.string().uuid(),
        message: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session } = await supabase
      .from("edit_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("Session not found");

    const { data: proj } = await supabase
      .from("projects")
      .select("*")
      .eq("id", session.project_id)
      .maybeSingle();
    if (!proj) throw new Error("Project not found");

    const { data: changes } = await supabase
      .from("pending_changes")
      .select("file_path, modified_content")
      .eq("session_id", data.sessionId);

    if (!changes || changes.length === 0) {
      throw new Error("No pending changes to commit");
    }

    const octo = await getOctokitForUser(userId);
    if (!octo) throw new Error("GitHub not connected");

    const owner = proj.repo_owner;
    const repo = proj.repo_name;
    const base = proj.default_branch;

    const { data: baseRef } = await octo.git.getRef({
      owner,
      repo,
      ref: `heads/${base}`,
    });
    const baseSha = baseRef.object.sha;
    const { data: baseCommit } = await octo.git.getCommit({
      owner,
      repo,
      commit_sha: baseSha,
    });

    const blobs = await Promise.all(
      changes.map(async (c) => {
        const { data: blob } = await octo.git.createBlob({
          owner,
          repo,
          content: Buffer.from(c.modified_content, "utf8").toString("base64"),
          encoding: "base64",
        });
        return { path: c.file_path, sha: blob.sha };
      }),
    );

    const { data: newTree } = await octo.git.createTree({
      owner,
      repo,
      base_tree: baseCommit.tree.sha,
      tree: blobs.map((b) => ({
        path: b.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: b.sha,
      })),
    });

    const { data: newCommit } = await octo.git.createCommit({
      owner,
      repo,
      message: data.message,
      tree: newTree.sha,
      parents: [baseSha],
    });

    const branch = `lovable-session-${Date.now()}`;
    await octo.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: newCommit.sha,
    });

    const fileList = changes.map((c) => `- \`${c.file_path}\``).join("\n");
    const { data: pr } = await octo.pulls.create({
      owner,
      repo,
      title: data.message,
      head: branch,
      base,
      body: `Batched edits via Lovable Visual Editor.\n\n${fileList}`,
    });

    await supabase
      .from("edit_sessions")
      .update({ status: "merged", base_commit_sha: baseSha })
      .eq("id", data.sessionId);
    await supabase
      .from("pending_changes")
      .delete()
      .eq("session_id", data.sessionId);

    return {
      branch,
      prUrl: pr.html_url,
      prNumber: pr.number,
      fileCount: changes.length,
    };
  });
