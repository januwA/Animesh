import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/presentation/components/ui/item";

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
    <ItemGroup>
      {aiConfigs.map((config, index) => (
        <Item key={config.alias} variant="outline">
          <ItemContent>
            <ItemTitle>
              {config.alias}
              <Badge>{config.ai_model}</Badge>
            </ItemTitle>
            <ItemDescription>{config.api_endpoint}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              type="button"
              size="sm"
              onClick={() => onTest(config)}
              disabled={testingAi}
            >
              测试
            </Button>
            <Button type="button" size="sm" onClick={() => onEdit(index)}>
              编辑
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onDelete(index)}
            >
              删除
            </Button>
          </ItemActions>
        </Item>
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
    </ItemGroup>
  );
}
