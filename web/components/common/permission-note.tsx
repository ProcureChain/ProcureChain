import { Lock } from "lucide-react";

export function PermissionNote({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1 text-xs text-amber-700">
      <Lock className="h-3.5 w-3.5" />
      {message}
    </p>
  );
}
