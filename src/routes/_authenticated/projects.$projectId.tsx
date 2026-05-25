import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, FileCode2, Folder, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getProject, getRepoTree, getFileContent } from "@/lib/github.functions";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectView,
});

function ProjectView() {
  const { projectId } = Route.useParams();
  const getProjectFn = useServerFn(getProject);
  const getTreeFn = useServerFn(getRepoTree);
  const getFileFn = useServerFn(getFileContent);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const proj = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProjectFn({ data: { id: projectId } }),
  });
  const tree = useQuery({
    queryKey: ["tree", projectId],
    queryFn: () => getTreeFn({ data: { projectId } }),
    enabled: !!proj.data?.project,
  });
  const file = useQuery({
    queryKey: ["file", projectId, selectedPath],
    queryFn: () => getFileFn({ data: { projectId, path: selectedPath! } }),
    enabled: !!selectedPath,
  });

  const project = proj.data?.project;

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/projects"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button></Link>
        {project && (
          <h1 className="font-semibold">{project.repo_owner}/{project.repo_name}</h1>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <aside className="col-span-4 rounded-lg border bg-card">
          <div className="border-b px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Files</div>
          {tree.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : tree.error ? (
            <p className="p-4 text-sm text-destructive">{(tree.error as Error).message}</p>
          ) : (
            <ScrollArea className="h-[70vh]">
              <ul className="p-2">
                {tree.data?.tree
                  .filter((f) => /\.(tsx?|jsx?|css|md|json|html)$/i.test(f.path))
                  .map((f) => (
                    <li key={f.sha}>
                      <button
                        onClick={() => setSelectedPath(f.path)}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent ${
                          selectedPath === f.path ? "bg-accent font-medium" : ""
                        }`}
                      >
                        <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate">{f.path}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </ScrollArea>
          )}
        </aside>

        <section className="col-span-8 rounded-lg border bg-card">
          <div className="border-b px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
            {selectedPath ?? "Select a file"}
          </div>
          {!selectedPath ? (
            <div className="flex h-[70vh] items-center justify-center text-sm text-muted-foreground">
              Pick a file from the left to preview its source.
            </div>
          ) : file.isLoading ? (
            <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : file.error ? (
            <p className="p-4 text-sm text-destructive">{(file.error as Error).message}</p>
          ) : (
            <ScrollArea className="h-[70vh]">
              <pre className="p-4 text-xs leading-relaxed">
                <code>{file.data?.content}</code>
              </pre>
            </ScrollArea>
          )}
        </section>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        ✨ Next steps (coming soon): visual editor overlay, AST-based edits, branch + PR creation.
      </p>
    </main>
  );
}
