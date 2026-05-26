import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  FileCode2,
  Loader2,
  GitPullRequest,
  Type,
  Plus,
  Trash2,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  getProject,
  getRepoTree,
  getFileContent,
  getOrCreateSession,
  upsertPendingChange,
  listPendingChanges,
  discardPendingChange,
  commitSession,
} from "@/lib/github.functions";
import { extractEditableTexts, applyTextEdits } from "@/lib/jsx-texts";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectView,
});

function ProjectView() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();

  const getProjectFn = useServerFn(getProject);
  const getTreeFn = useServerFn(getRepoTree);
  const getFileFn = useServerFn(getFileContent);
  const sessionFn = useServerFn(getOrCreateSession);
  const upsertFn = useServerFn(upsertPendingChange);
  const listChangesFn = useServerFn(listPendingChanges);
  const discardFn = useServerFn(discardPendingChange);
  const commitFn = useServerFn(commitSession);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [textOverrides, setTextOverrides] = useState<Record<string, string>>({});

  const proj = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProjectFn({ data: { id: projectId } }),
  });
  const tree = useQuery({
    queryKey: ["tree", projectId],
    queryFn: () => getTreeFn({ data: { projectId } }),
    enabled: !!proj.data?.project,
  });
  const session = useQuery({
    queryKey: ["session", projectId],
    queryFn: () => sessionFn({ data: { projectId } }),
    enabled: !!proj.data?.project,
  });
  const sessionId = session.data?.session?.id;
  const pending = useQuery({
    queryKey: ["pending", sessionId],
    queryFn: () => listChangesFn({ data: { sessionId: sessionId! } }),
    enabled: !!sessionId,
  });

  const pendingByPath = useMemo(() => {
    const m = new Map<string, { id: string; modified_content: string }>();
    pending.data?.changes.forEach((c) =>
      m.set(c.file_path, { id: c.id, modified_content: c.modified_content }),
    );
    return m;
  }, [pending.data]);

  const file = useQuery({
    queryKey: ["file", projectId, selectedPath],
    queryFn: () => getFileFn({ data: { projectId, path: selectedPath! } }),
    enabled: !!selectedPath,
  });

  useEffect(() => {
    if (file.data?.content !== undefined && selectedPath) {
      const pendingForFile = pendingByPath.get(selectedPath);
      setDraft(pendingForFile?.modified_content ?? file.data.content);
      setTextOverrides({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.data, selectedPath]);

  const texts = useMemo(() => {
    if (!file.data?.content) return [];
    const isJsx = /\.(tsx|jsx)$/i.test(selectedPath ?? "");
    if (!isJsx) return [];
    return extractEditableTexts(file.data.content);
  }, [file.data, selectedPath]);

  const composedDraft = useMemo(() => {
    if (!file.data?.content) return draft;
    if (Object.keys(textOverrides).length === 0) return draft;
    const edits = texts
      .filter((t) => textOverrides[t.id] !== undefined)
      .map((t) => ({ start: t.start, end: t.end, value: textOverrides[t.id] }));
    return applyTextEdits(file.data.content, edits);
  }, [file.data, draft, texts, textOverrides]);

  const dirty = !!file.data && composedDraft !== file.data.content;

  const addToBatch = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          sessionId: sessionId!,
          filePath: selectedPath!,
          originalContent: file.data?.content,
          modifiedContent: composedDraft,
        },
      }),
    onSuccess: () => {
      toast.success(`${selectedPath} added to batch`);
      qc.invalidateQueries({ queryKey: ["pending", sessionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const discard = useMutation({
    mutationFn: (id: string) => discardFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending", sessionId] }),
  });

  const commit = useMutation({
    mutationFn: () =>
      commitFn({
        data: {
          sessionId: sessionId!,
          message: message || `Batched edits (${pending.data?.changes.length})`,
        },
      }),
    onSuccess: (res) => {
      toast.success(`PR #${res.prNumber} created`, {
        description: `${res.fileCount} files on ${res.branch}`,
        action: { label: "Open", onClick: () => window.open(res.prUrl, "_blank") },
      });
      setMessage("");
      qc.invalidateQueries({ queryKey: ["session", projectId] });
      qc.invalidateQueries({ queryKey: ["pending"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const project = proj.data?.project;
  const pendingCount = pending.data?.changes.length ?? 0;

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
        {project && (
          <h1 className="font-semibold">
            {project.repo_owner}/{project.repo_name}
            <span className="ml-2 text-xs text-muted-foreground">
              @{project.default_branch}
            </span>
          </h1>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* File tree */}
        <aside className="col-span-3 rounded-lg border bg-card">
          <div className="border-b px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
            Files
          </div>
          {tree.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : tree.error ? (
            <p className="p-4 text-sm text-destructive">
              {(tree.error as Error).message}
            </p>
          ) : (
            <ScrollArea className="h-[70vh]">
              <ul className="p-2">
                {tree.data?.tree
                  .filter((f) => /\.(tsx?|jsx?|css|md|json|html)$/i.test(f.path))
                  .map((f) => {
                    const queued = pendingByPath.has(f.path);
                    return (
                      <li key={f.sha}>
                        <button
                          onClick={() => setSelectedPath(f.path)}
                          className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent ${
                            selectedPath === f.path ? "bg-accent font-medium" : ""
                          }`}
                        >
                          <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="flex-1 truncate">{f.path}</span>
                          {queued && (
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                          )}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </ScrollArea>
          )}
        </aside>

        {/* Editor */}
        <section className="col-span-6 rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              {selectedPath ?? "Select a file"}
              {dirty && <span className="ml-2 text-amber-600">● unsaved</span>}
            </span>
            {selectedPath && (
              <Button
                size="sm"
                disabled={!dirty || addToBatch.isPending || !sessionId}
                onClick={() => addToBatch.mutate()}
              >
                {addToBatch.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                Add to batch
              </Button>
            )}
          </div>

          {!selectedPath ? (
            <div className="flex h-[70vh] items-center justify-center text-sm text-muted-foreground">
              Pick a file from the left to edit.
            </div>
          ) : file.isLoading ? (
            <div className="flex h-[70vh] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : file.error ? (
            <p className="p-4 text-sm text-destructive">
              {(file.error as Error).message}
            </p>
          ) : (
            <Tabs defaultValue="visual" className="flex h-[70vh] flex-col">
              <div className="border-b px-3 pt-2">
                <TabsList>
                  <TabsTrigger value="visual">
                    <Type className="mr-1 h-3.5 w-3.5" /> Visual texts
                    {texts.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {texts.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="code">
                    <FileCode2 className="mr-1 h-3.5 w-3.5" /> Code
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="visual" className="m-0 flex-1 overflow-hidden">
                {texts.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No editable text or string attributes found in this file.
                  </div>
                ) : (
                  <ScrollArea className="h-full">
                    <ul className="space-y-2 p-3">
                      {texts.map((t) => {
                        const v = textOverrides[t.id] ?? t.value;
                        const changed = textOverrides[t.id] !== undefined;
                        return (
                          <li key={t.id} className="rounded border p-2">
                            <div className="mb-1 flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
                              <span>
                                line {t.line} ·{" "}
                                {t.kind === "jsx-attr" ? t.attrName : "text"}
                              </span>
                              {changed && (
                                <span className="text-amber-600">● modified</span>
                              )}
                            </div>
                            <Textarea
                              value={v}
                              onChange={(e) =>
                                setTextOverrides((s) => ({
                                  ...s,
                                  [t.id]: e.target.value,
                                }))
                              }
                              rows={Math.max(1, v.split("\n").length)}
                              className="text-sm"
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="code" className="m-0 flex-1 overflow-hidden">
                <Textarea
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setTextOverrides({});
                  }}
                  className="h-full resize-none rounded-none border-0 font-mono text-xs leading-relaxed"
                  spellCheck={false}
                />
              </TabsContent>
            </Tabs>
          )}
        </section>

        {/* Batch panel */}
        <aside className="col-span-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
              <Layers className="h-3.5 w-3.5" /> Batch
            </span>
            <Badge variant={pendingCount ? "default" : "secondary"}>
              {pendingCount}
            </Badge>
          </div>

          <div className="p-3">
            {pendingCount === 0 ? (
              <p className="text-xs text-muted-foreground">
                No queued changes. Edit a file and click "Add to batch".
              </p>
            ) : (
              <ScrollArea className="h-[40vh]">
                <ul className="space-y-1">
                  {pending.data?.changes.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-1 rounded border px-2 py-1 text-xs"
                    >
                      <FileCode2 className="h-3 w-3 text-muted-foreground" />
                      <button
                        onClick={() => setSelectedPath(c.file_path)}
                        className="flex-1 truncate text-left hover:underline"
                      >
                        {c.file_path}
                      </button>
                      <button
                        onClick={() => discard.mutate(c.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Discard"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}

            <div className="mt-3 space-y-2 border-t pt-3">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Commit message"
                className="text-sm"
              />
              <Button
                className="w-full"
                disabled={pendingCount === 0 || commit.isPending}
                onClick={() => commit.mutate()}
              >
                {commit.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <GitPullRequest className="mr-1 h-4 w-4" />
                )}
                Commit {pendingCount} file{pendingCount === 1 ? "" : "s"} as PR
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
