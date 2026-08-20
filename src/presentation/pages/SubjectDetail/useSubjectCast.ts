import { useMemo } from "react";
import type { GetBangumiCharactersUseCase } from "@/application/bangumi/GetBangumiCharactersUseCase";
import type { GetBangumiPersonsUseCase } from "@/application/bangumi/GetBangumiPersonsUseCase";
import type {
  BangumiCharacter,
  BangumiPerson,
} from "@/domain/bangumi/BangumiSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { UseQueryResult } from "@/presentation/hooks/useQuery";
import { useQuery } from "@/presentation/hooks/useQuery";

export interface ConsolidatedStaffMember {
  id: number;
  name: string;
  image: string;
  relations: string[];
  eps: string;
}

/** Deduplicate staff by (id, relation), then group by person ID to collect all roles. */
export function consolidateStaff(
  persons: BangumiPerson[],
): ConsolidatedStaffMember[] {
  const seen = new Set<string>();
  const personMap = new Map<number, ConsolidatedStaffMember>();

  for (const p of persons) {
    const key = `${p.id}|${p.relation}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const entry = personMap.get(p.id);
    if (entry) {
      entry.relations.push(p.relation);
    } else {
      personMap.set(p.id, {
        id: p.id,
        name: p.name,
        image: p.image,
        relations: [p.relation],
        eps: p.eps,
      });
    }
  }
  return Array.from(personMap.values());
}

export interface UseSubjectCastParams {
  subjectId: number;
}

/** useSubjectCast 的依赖，由调用方（页面组合根）注入 */
export interface UseSubjectCastDeps {
  getBangumiPersonsUseCase: Pick<GetBangumiPersonsUseCase, "execute">;
  getBangumiCharactersUseCase: Pick<GetBangumiCharactersUseCase, "execute">;
}

export interface SubjectCastResult {
  charactersQuery: UseQueryResult<BangumiCharacter[]>;
  characters: BangumiCharacter[];
  personsQuery: UseQueryResult<BangumiPerson[]>;
  persons: BangumiPerson[];
  consolidatedStaff: ConsolidatedStaffMember[];
  staffGroupedByRole: Map<string, ConsolidatedStaffMember[]>;
}

export function useSubjectCast(
  params: UseSubjectCastParams,
  deps: UseSubjectCastDeps,
): SubjectCastResult {
  const { subjectId } = params;
  const { getBangumiPersonsUseCase, getBangumiCharactersUseCase } = deps;

  const charactersQuery = useQuery<BangumiCharacter[]>(
    (ctx) =>
      getBangumiCharactersUseCase.execute(
        ctx,
        NonEmptyStringSchema.parse(String(subjectId)),
      ),
    [subjectId, getBangumiCharactersUseCase],
  );
  const characters = charactersQuery.data ?? [];

  const personsQuery = useQuery<BangumiPerson[]>(
    (ctx) =>
      getBangumiPersonsUseCase.execute(
        ctx,
        NonEmptyStringSchema.parse(String(subjectId)),
      ),
    [subjectId, getBangumiPersonsUseCase],
  );
  const persons = personsQuery.data ?? [];

  const consolidatedStaff = useMemo(
    () => (persons.length > 0 ? consolidateStaff(persons) : []),
    [persons],
  );

  const staffGroupedByRole = useMemo(() => {
    const groups = new Map<string, ConsolidatedStaffMember[]>();
    for (const person of consolidatedStaff) {
      for (const relation of person.relations) {
        const list = groups.get(relation) || [];
        list.push(person);
        groups.set(relation, list);
      }
    }
    return groups;
  }, [consolidatedStaff]);

  return {
    charactersQuery,
    characters,
    personsQuery,
    persons,
    consolidatedStaff,
    staffGroupedByRole,
  };
}
