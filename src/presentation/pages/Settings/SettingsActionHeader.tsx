import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardAction,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";

export interface SettingsActionHeaderProps {
  saving: boolean;
  isDirty: boolean;
}

export function SettingsActionHeader({
  saving,
  isDirty,
}: SettingsActionHeaderProps) {
  return (
    <Card className="ani-card">
      <CardHeader>
        <CardTitle>软件设置</CardTitle>
        <CardAction>
          <Button type="submit" disabled={saving || !isDirty}>
            保存设置
          </Button>
        </CardAction>
      </CardHeader>
    </Card>
  );
}
