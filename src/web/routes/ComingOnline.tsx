import { Construction } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { LinkButton } from "../components/ui/Button";

/** Shared placeholder for role views that are still being built. */
export function ComingOnline({ role, description }: { role: string; description: string }) {
  return (
    <div className="grid flex-1 place-items-center px-4 py-16">
      <EmptyState
        icon={<Construction />}
        title={`${role} view is coming online`}
        description={description}
        action={
          <LinkButton to="/command" variant="secondary" size="sm">
            Open command meanwhile
          </LinkButton>
        }
      />
    </div>
  );
}
