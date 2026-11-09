import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api";
import { login, useSession } from "@/lib/auth";

function safeNext(n: string | null): string {
  // Only same-site paths: blocks open redirects like ?next=https://evil or //evil.
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/orders";
}

export default function Login() {
  const [search] = useSearchParams();
  const next = safeNext(search.get("next"));
  const nav = useNavigate();
  const s = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (s.data) return <Navigate to={next} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      nav(next, { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Couldn't log in."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 holo-scanlines pointer-events-none" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[520px] rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
      <div className="relative mx-auto max-w-md px-5 py-20 md:py-28">
        <span className="grid place-items-center size-12 rounded-full border border-sky-500/40 bg-sky-500/10 holo-glow mx-auto">
          <LockKeyhole className="size-5 text-sky-300" />
        </span>
        <p className="mono-label mt-6 text-center">Staff only</p>
        <h1 className="mt-3 text-4xl text-slate-100 tracking-tight text-center" data-testid="login-title">Studio login</h1>
        <p className="mt-3 text-center text-slate-400">The order desk, memorial studio and AI advisor are for the Afterlight team.</p>
        <form onSubmit={submit} className="mt-10 rounded-xl backdrop-blur-xl bg-slate-900/80 border border-slate-700/50 p-6 space-y-5" data-testid="login-form">
          <div className="space-y-1.5">
            <Label htmlFor="l-email">Email</Label>
            <Input id="l-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email-input" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-pw">Password</Label>
            <Input id="l-pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password-input" />
          </div>
          {error && <p className="text-sm text-red-400" role="alert" data-testid="login-error">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full bg-sky-500 hover:bg-sky-400 text-white" data-testid="login-submit-button">
            {busy && <Loader2 className="size-4 animate-spin" />} Log in
          </Button>
        </form>
      </div>
    </section>
  );
}
