import { useQuery } from "@tanstack/react-query";
import type { Equipment } from "@shared/schema";

export function useEquipment(equipmentId?: number) {
  if (equipmentId) {
    return useQuery<Equipment>({
      queryKey: [`/api/equipment/${equipmentId}`],
      enabled: !!equipmentId
    });
  }

  return useQuery<Equipment[]>({
    queryKey: ["/api/equipment"]
  });
}
