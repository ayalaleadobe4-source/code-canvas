import { createFileRoute, Link } from "@tanstack/react-router";
import { Github, Code2, GitPullRequest, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { user } = useAuth();
  return (
    <div style={{ transform: "none" , fontSize: "48px" }} className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Code2 className="h-6 w-6 text-primary" />
            <span src="/placeholder.svg" className="font-semibold">Visual Editor for Lovable</span>
          </div>
          <nav className="flex items-center gap-3">
            {user ? (
              <Link to="/projects">
                <Button>My Projects</Button>
              </Link>
            ) : (
              <Link to="/login">
                <Button>Sign in</Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <section className="text-center">
          <h1 style={{ color: "#ffffff" }} className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Edit your Lovable projects
            <br />
            <span style={{ color: "#2563eb" }} className="text-primary">visually</span>, push to GitHub.
          </h1>
          <p style={{ color: "#db2777" }} className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Connect a GitHub repo, point-and-click to change text, colors, spacing — every edit becomes a
            real commit on a branch and a pull request.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Link to={user ? "/projects" : "/login"}>
              <Button size="lg" className="gap-2">
                <Github className="h-4 w-4" /> Get started
              </Button>
            </Link>
          </div>
        </section>

        <section className="mt-24 grid gap-6 sm:grid-cols-3">
          {[
            { icon: Github, title: "Connect GitHub", body: "OAuth with your account, browse all your repos." },
            { icon: MousePointerClick, title: "Click to edit", body: "Visual overlay maps clicks back to source JSX." },
            { icon: GitPullRequest, title: "Push as PR", body: "Every save becomes a branch + pull request." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
