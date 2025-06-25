import { useQuery } from "@tanstack/react-query";
import type { WorkProcedure } from "@shared/schema";

export function useProcedures(workTypeId: number, enabled: boolean = true) {
  return useQuery<WorkProcedure[]>({
    queryKey: [`/api/work-types/${workTypeId}/procedures`],
    enabled: enabled && !!workTypeId
  });
}
