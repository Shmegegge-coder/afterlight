import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSession } from "@/lib/auth";

// Route guard for staff-only pages. The API enforces the same rule; this just avoids
// showing an empty page and sends the user to /login?next=<where they were going>.
export default function RequireStaff() {
  const s = useSession();
  const loc = useLocation();
  if (s.isPending) {
    return (
      <div className="min-h-[50vh] grid place-items-center" data-testid="auth-checking">
        <Loader2 className="size-5 animate-spin text-sky-300" />
      </div>
    );
  }
  if (!s.data) {
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}
