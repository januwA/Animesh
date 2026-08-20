import { useLocation, useNavigate } from "react-router-dom";
import type { GetBangumiSubjectUseCase } from "@/application/bangumi/GetBangumiSubjectUseCase";
import type { OpenUrlUseCase } from "@/application/opener/OpenUrlUseCase";
import type { BangumiSubject } from "@/domain/bangumi/BangumiSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { UseQueryResult } from "@/presentation/hooks/useQuery";
import { useQuery } from "@/presentation/hooks/useQuery";

export interface UseSubjectInfoParams {
  subjectId: number;
}

/** useSubjectInfo 的依赖，由调用方（页面组合根）注入 */
export interface UseSubjectInfoDeps {
  getBangumiSubjectUseCase: Pick<GetBangumiSubjectUseCase, "execute">;
  openUrlUseCase: Pick<OpenUrlUseCase, "execute">;
}

export interface SubjectInfoResult {
  subjectQuery: UseQueryResult<BangumiSubject>;
  subject: BangumiSubject | undefined;
  displayName: string;
  imageUrl: string | undefined;
  handleBack: () => void;
  handleOpenUrl: () => void;
}

export function useSubjectInfo(
  params: UseSubjectInfoParams,
  deps: UseSubjectInfoDeps,
): SubjectInfoResult {
  const { subjectId } = params;
  const { getBangumiSubjectUseCase, openUrlUseCase } = deps;

  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { name?: string; imageUrl?: string } | null;

  const subjectQuery = useQuery(
    (ctx) =>
      getBangumiSubjectUseCase.execute(
        ctx,
        NonEmptyStringSchema.parse(String(subjectId)),
      ),
    [subjectId, getBangumiSubjectUseCase],
  );
  const subject = subjectQuery.data ?? undefined;

  // v8 ignore start
  const handleBack = () => {
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        navigate(-1);
      });
    } else {
      navigate(-1);
    }
  };
  // v8 ignore stop

  const displayName = subject?.name || state?.name || "加载中...";
  const imageUrl = subject?.image || state?.imageUrl;

  const handleOpenUrl = () => {
    // v8 ignore next
    if (!subject) return;
    void openUrlUseCase.execute(
      NonEmptyStringSchema.parse(`https://bgm.tv/subject/${subject.id}`),
    );
  };

  return {
    subjectQuery,
    subject,
    displayName,
    imageUrl,
    handleBack,
    handleOpenUrl,
  };
}
