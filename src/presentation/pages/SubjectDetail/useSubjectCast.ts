import { useMemo } from "react";
import type { GetAnimePersonsUseCase } from "@/application/anime/GetAnimePersonsUseCase";
import type { AnimePerson } from "@/domain/anime/AnimeSchemas";
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
  persons: AnimePerson[],
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

export interface UseSubjectStaffParams {
  subjectId: number;
  enabledPersons?: boolean;
}

export interface UseSubjectStaffDeps {
  getAnimePersonsUseCase: Pick<GetAnimePersonsUseCase, "execute">;
}

export interface SubjectStaffResult {
  personsQuery: UseQueryResult<AnimePerson[]>;
  persons: AnimePerson[];
  consolidatedStaff: ConsolidatedStaffMember[];
  staffGroupedByRole: Map<string, ConsolidatedStaffMember[]>;
}

export function useSubjectStaff(
  params: UseSubjectStaffParams,
  deps: UseSubjectStaffDeps,
): SubjectStaffResult {
  const { subjectId, enabledPersons = true } = params;
  const { getAnimePersonsUseCase } = deps;

  const personsQuery = useQuery<AnimePerson[]>(
    (ctx) =>
      getAnimePersonsUseCase.execute(
        ctx,
        NonEmptyStringSchema.parse(String(subjectId)),
      ),
    [subjectId, getAnimePersonsUseCase],
    { enabled: enabledPersons },
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
    personsQuery,
    persons,
    consolidatedStaff,
    staffGroupedByRole,
  };
}
