import { useQuery } from "@tanstack/react-query";
import type { WorkType } from "@shared/schema";

export function useWorkTypes(equipmentId: number) {
  return useQuery<WorkType[]>({
    queryKey: [`/api/equipment/${equipmentId}/work-types`],
    enabled: !!equipmentId
  });
}
