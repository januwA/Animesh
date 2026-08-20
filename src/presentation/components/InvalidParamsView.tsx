import type { z } from "zod";
import { BackButton } from "@/presentation/components/BackButton";
import { Card, CardContent } from "@/presentation/components/ui/card";

interface InvalidParamsViewProps {
  error: z.ZodError;
  title?: string;
}

export function InvalidParamsView({
  error,
  title = "无效的路由参数",
}: InvalidParamsViewProps) {
  return (
    <div className="w-full flex items-center justify-center py-16">
      <Card className="w-full max-w-md bg-muted/50 border-border">
        <CardContent className="flex flex-col gap-3 p-6">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            {error.issues.map((issue) => (
              <li key={`${issue.path.join(".")}-${issue.code}`}>
                {issue.message}
              </li>
            ))}
          </ul>
          <BackButton variant="outline" className="mt-1 w-fit" />
        </CardContent>
      </Card>
    </div>
  );
}
