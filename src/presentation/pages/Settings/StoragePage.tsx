import { zodResolver } from "@hookform/resolvers/zod";
import { Folder, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import {
  type StorageForm,
  StorageFormSchema,
} from "@/domain/settings/SettingsSchemas";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/presentation/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/presentation/components/ui/input-group";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";

export default function StoragePage() {
  const {
    getDownloadDirUseCase,
    setDownloadDirUseCase,
    getSpeedLimitsUseCase,
    setSpeedLimitsUseCase,
    selectDirectoryUseCase,
  } = useDI();

  const isMobile = ["android", "ios"].includes(
    import.meta.env.TAURI_ENV_PLATFORM,
  );

  const form = useForm<StorageForm>({
    resolver: zodResolver(StorageFormSchema),
    defaultValues: { downloadDir: "", maxDownloadSpeed: 0, maxUploadSpeed: 0 },
  });

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = form;

  const { loading } = useQuery(
    async () => {
      const [dirResult, speedResult] = await Promise.all([
        getDownloadDirUseCase.execute(),
        getSpeedLimitsUseCase.execute(),
      ]);
      return { dirResult, speedResult };
    },
    [getDownloadDirUseCase, getSpeedLimitsUseCase],
    {
      onSuccess: ({ dirResult, speedResult }) => {
        reset({
          downloadDir: dirResult.downloadDir,
          maxDownloadSpeed: speedResult.maxDownloadSpeed,
          maxUploadSpeed: speedResult.maxUploadSpeed,
        });
      },
    },
  );

  const { execute: save, loading: saving } = useMutation(
    async (_ctx, data: StorageForm) => {
      await Promise.all([
        setDownloadDirUseCase.execute(data.downloadDir),
        setSpeedLimitsUseCase.execute(
          data.maxDownloadSpeed,
          data.maxUploadSpeed,
        ),
      ]);
    },
    {
      onSuccess: () => {
        toast.success("存储设置已保存");
      },
      onError: (err) => toast.error(`保存失败: ${err.message}`),
    },
  );

  const handleSelectDir = async () => {
    const result = await selectDirectoryUseCase.execute();
    if (result) {
      setValue("downloadDir", result);
    }
  };

  if (loading) {
    return (
      <Card className="ani-card">
        <CardContent className="p-6 text-muted-foreground">
          加载中...
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit((data) => save(data))}>
      <Card className="ani-card">
        <CardHeader className="p-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Save className="h-4 w-4 text-primary" />
            存储设置
          </CardTitle>
          <CardAction>
            <Button type="submit" disabled={saving}>
              保存
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-5 pb-6 text-xs">
          <FieldGroup>
            {!isMobile && (
              <>
                <Field data-invalid={!!errors.downloadDir}>
                  <FieldLabel htmlFor="download-dir-input">
                    默认下载及播放缓存目录
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="download-dir-input"
                      {...register("downloadDir")}
                      aria-invalid={!!errors.downloadDir}
                      placeholder={
                        "选择或输入下载路径，例如 D:\\AnimeshDownloads"
                      }
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        variant="secondary"
                        onClick={handleSelectDir}
                      >
                        <Folder />
                        选择目录
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  {errors.downloadDir && (
                    <FieldError>{errors.downloadDir.message}</FieldError>
                  )}
                  <FieldDescription>
                    边下边播的缓存与下载的完整文件均保存在该路径下。建议选择剩余空间较大的磁盘分区
                  </FieldDescription>
                </Field>

                <FieldSeparator />
              </>
            )}

            <Field data-invalid={!!errors.maxDownloadSpeed}>
              <FieldLabel htmlFor="max-download-speed-input">
                后台下载速度限制
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="max-download-speed-input"
                  type="number"
                  min={0}
                  {...register("maxDownloadSpeed", { valueAsNumber: true })}
                  aria-invalid={!!errors.maxDownloadSpeed}
                  placeholder="0"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>KB/s</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              {/* v8 ignore start -- 与 downloadDir 错误显示模式相同，jsdom 无法对 number input 设置负值触发验证 */}
              {errors.maxDownloadSpeed && (
                <FieldError>{errors.maxDownloadSpeed.message}</FieldError>
              )}
              <FieldDescription>
                限制 BT 后台下载的速率。设为 0 表示不限速
              </FieldDescription>
            </Field>

            <FieldSeparator />

            <Field data-invalid={!!errors.maxUploadSpeed}>
              <FieldLabel htmlFor="max-upload-speed-input">
                后台上传速度限制
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="max-upload-speed-input"
                  type="number"
                  min={0}
                  {...register("maxUploadSpeed", { valueAsNumber: true })}
                  aria-invalid={!!errors.maxUploadSpeed}
                  placeholder="0"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>KB/s</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              {errors.maxUploadSpeed && (
                <FieldError>{errors.maxUploadSpeed.message}</FieldError>
              )}
              {/* v8 ignore stop */}
              <FieldDescription>
                限制 BT 后台做种上传的速率。设为 0 表示不限速
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    </form>
  );
}
