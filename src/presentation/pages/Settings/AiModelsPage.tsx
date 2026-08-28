import { Bot } from "lucide-react";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
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
import { AiConfigForm } from "./AiConfigForm";
import { useAiConfigsForm } from "./useAiConfigsForm";

export default function AiModelsPage() {
  const form = useAiConfigsForm();

  if (form.loading) {
    return (
      <Card className="ani-card">
        <CardContent className="p-6 text-muted-foreground">
          加载中...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="ani-card">
      <CardHeader className="p-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <Bot className="h-4 w-4 text-primary" />
          AI 模型设置
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-6 flex flex-col gap-4 text-xs">
        <ItemGroup>
          {form.aiConfigs.map((config, index) => (
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
                  onClick={() => form.handleTestConfig(config)}
                  disabled={form.testingAi}
                >
                  测试
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => form.handleStartEdit(index)}
                >
                  编辑
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => form.handleDeleteConfig(index)}
                >
                  删除
                </Button>
              </ItemActions>
            </Item>
          ))}

          {form.aiConfigs.length === 0 && (
            <Empty className="py-6 border-dashed">
              <EmptyContent>
                <EmptyTitle>暂无 AI 配置</EmptyTitle>
              </EmptyContent>
            </Empty>
          )}

          {form.editingIndex === null && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={form.handleStartAdd}
              className="w-full h-8.5 font-medium border-border bg-secondary/50 text-foreground hover:bg-secondary text-xs flex items-center justify-center gap-1.5 mt-2"
            >
              + 添加 AI 配置
            </Button>
          )}
        </ItemGroup>

        {form.editingIndex !== null && (
          <AiConfigForm
            form={form.form}
            editingIndex={form.editingIndex}
            aiConfigs={form.aiConfigs}
            testingAi={form.testingAi}
            onTestConnection={form.handleTestCurrentConnection}
            onCancel={form.handleCancelEdit}
            onSave={form.handleSaveConfig}
          />
        )}
      </CardContent>
    </Card>
  );
}
