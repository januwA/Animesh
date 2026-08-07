import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { z } from "zod";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";

interface InvalidParamsViewProps {
  error: z.ZodError;
  title?: string;
}

export function InvalidParamsView({
  error,
  title = "无效的路由参数",
}: InvalidParamsViewProps) {
  const navigate = useNavigate();

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
          <Button
            variant="outline"
            size="sm"
            className="mt-1 w-fit"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
