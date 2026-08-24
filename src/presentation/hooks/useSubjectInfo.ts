import { useLocation, useNavigate } from "react-router-dom";
import type { GetAnimeSubjectUseCase } from "@/application/anime/GetAnimeSubjectUseCase";
import type { OpenUrlUseCase } from "@/application/opener/OpenUrlUseCase";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { UseQueryResult } from "@/presentation/hooks/useQuery";
import { useQuery } from "@/presentation/hooks/useQuery";

export interface UseSubjectInfoParams {
  subjectId: number;
  externalUrl?: (subject: AnimeSubject) => string;
}

/** useSubjectInfo 的依赖，由调用方（页面组合根）注入 */
export interface UseSubjectInfoDeps {
  getSubjectUseCase: Pick<GetAnimeSubjectUseCase, "execute">;
  openUrlUseCase: Pick<OpenUrlUseCase, "execute">;
}

export interface SubjectInfoResult {
  subjectQuery: UseQueryResult<AnimeSubject>;
  subject: AnimeSubject | undefined;
  displayName: string;
  imageUrl: string | undefined;
  handleBack: () => void;
  handleOpenUrl: () => void;
}

export function useSubjectInfo(
  params: UseSubjectInfoParams,
  deps: UseSubjectInfoDeps,
): SubjectInfoResult {
  const { subjectId, externalUrl } = params;
  const { getSubjectUseCase, openUrlUseCase } = deps;

  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { name?: string; imageUrl?: string } | null;

  const subjectQuery = useQuery(
    (ctx) =>
      getSubjectUseCase.execute(
        ctx,
        NonEmptyStringSchema.parse(String(subjectId)),
      ),
    [subjectId, getSubjectUseCase],
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
    const url = externalUrl
      ? externalUrl(subject)
      : `https://bgm.tv/subject/${subject.id}`;
    void openUrlUseCase.execute(NonEmptyStringSchema.parse(url));
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
