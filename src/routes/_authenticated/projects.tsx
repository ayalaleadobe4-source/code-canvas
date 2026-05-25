import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Github, Plus, FolderGit2, Loader2, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import {
  getGithubAuthUrl,
  getGithubStatus,
  listMyRepos,
  listMyProjects,
  addProject,
} from "@/lib/github.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const router = useRouter();
  const statusFn = useServerFn(getGithubStatus);
  const projectsFn = useServerFn(listMyProjects);
  const authUrlFn = useServerFn(getGithubAuthUrl);

  const status = useQuery({ queryKey: ["gh-status"], queryFn: () => statusFn() });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => projectsFn() });

  const onConnect = async () => {
    const { url } = await authUrlFn();
    window.location.href = url;
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            {status.data?.connected
              ? `GitHub connected as @${status.data.username}`
              : "Connect GitHub to start editing your repos."}
          </p>
        </div>
        <div className="flex gap-2">
          {status.data?.connected ? (
            <AddProjectDialog onAdded={() => projects.refetch()} />
          ) : (
            <Button onClick={onConnect}>
              <Github className="mr-2 h-4 w-4" /> Connect GitHub
            </Button>
          )}
        </div>
      </div>

      {projects.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : projects.data && projects.data.projects.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.data.projects.map((p) => (
            <li key={p.id}>
              <Link
                to="/projects/$projectId"
                params={{ projectId: p.id }}
                className="block rounded-lg border bg-card p-5 transition hover:border-primary"
              >
                <div className="flex items-center gap-2">
                  <FolderGit2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{p.repo_owner}/{p.repo_name}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">branch: {p.default_branch}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed bg-card/50 py-16 text-center">
          <FolderGit2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No projects yet.</p>
          {status.data?.connected && (
            <div className="mt-4">
              <AddProjectDialog onAdded={() => projects.refetch()} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function AddProjectDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const reposFn = useServerFn(listMyRepos);
  const addFn = useServerFn(addProject);
  const repos = useQuery({
    queryKey: ["repos"],
    queryFn: () => reposFn(),
    enabled: open,
  });
  const addMut = useMutation({
    mutationFn: async (r: { owner: string; name: string; default_branch: string }) =>
      addFn({ data: r }),
    onSuccess: () => {
      toast.success("Project added");
      setOpen(false);
      onAdded();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Add project</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Pick a repository</DialogTitle></DialogHeader>
        {repos.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <ScrollArea className="h-[420px] pr-4">
            <ul className="space-y-2">
              {repos.data?.repos.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-md border p-3 hover:bg-accent"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{r.full_name}</span>
                      {r.private && <span className="rounded bg-muted px-1.5 py-0.5 text-xs">private</span>}
                    </div>
                    {r.description && <p className="truncate text-xs text-muted-foreground">{r.description}</p>}
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      addMut.mutate({ owner: r.owner, name: r.name, default_branch: r.default_branch })
                    }
                    disabled={addMut.isPending}
                  >
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
