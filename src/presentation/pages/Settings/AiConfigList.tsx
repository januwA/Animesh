import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import { Button } from "@/presentation/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyTitle,
} from "@/presentation/components/ui/empty";

export interface AiConfigListProps {
  aiConfigs: AiConfig[];
  testingAi: boolean;
  showAddButton: boolean;
  onTest: (config: AiConfig) => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onAdd: () => void;
}

export function AiConfigList({
  aiConfigs,
  testingAi,
  showAddButton,
  onTest,
  onEdit,
  onDelete,
  onAdd,
}: AiConfigListProps) {
  return (
    <div className="flex flex-col gap-3">
      {aiConfigs.map((config, index) => (
        <div
          key={index.toString()}
          className="flex items-center justify-between border border-border bg-secondary/30 rounded-lg p-3"
        >
          <div className="flex flex-col gap-1 min-w-0 flex-1 mr-4">
            <div className="font-semibold text-foreground flex items-center gap-2 flex-wrap">
              <span>{config.alias}</span>
              {config.ai_model && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                  {config.ai_model}
                </span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono truncate max-w-50 sm:max-w-xs md:max-w-md">
              {config.api_endpoint}
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onTest(config)}
              disabled={testingAi}
              className="h-7 px-2.5 text-[10px] font-medium border-border bg-secondary/50 text-foreground hover:bg-secondary"
            >
              测试
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onEdit(index)}
              className="h-7 px-2.5 text-[10px] font-medium"
            >
              编辑
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDelete(index)}
              className="h-7 px-2.5 text-[10px] font-medium text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              删除
            </Button>
          </div>
        </div>
      ))}

      {aiConfigs.length === 0 && (
        <Empty className="py-6 border-dashed">
          <EmptyContent>
            <EmptyTitle>暂无 AI 配置</EmptyTitle>
          </EmptyContent>
        </Empty>
      )}

      {showAddButton && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="w-full h-8.5 font-medium border-border bg-secondary/50 text-foreground hover:bg-secondary text-xs flex items-center justify-center gap-1.5 mt-2"
        >
          + 添加 AI 配置
        </Button>
      )}
    </div>
  );
}
