import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar, Plus, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";

const workScheduleSchema = z.object({
  equipmentId: z.number().min(1, "설비를 선택해주세요"),
  workTypeId: z.number().min(1, "작업 유형을 선택해주세요"),
  scheduledDate: z.string().min(1, "작업 날짜를 입력해주세요"),
  briefingTime: z.string().optional(),
  workerName: z.string().min(1, "작업자명을 입력해주세요"),
  workLocation: z.string().min(1, "작업 위치를 입력해주세요"),
  specialNotes: z.string().optional(),
});

type WorkScheduleFormData = z.infer<typeof workScheduleSchema>;

interface Equipment {
  id: number;
  name: string;
  code: string;
  location: string;
}

interface WorkType {
  id: number;
  name: string;
  description: string;
  equipmentId: number;
}

interface WorkScheduleFormProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  editData?: any; // Work schedule data for editing
}

export function WorkScheduleForm({ trigger, onSuccess, editData }: WorkScheduleFormProps) {
  const [open, setOpen] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(
    editData?.equipmentId || null
  );
  const queryClient = useQueryClient();
  const isEditing = !!editData;

  const form = useForm<WorkScheduleFormData>({
    resolver: zodResolver(workScheduleSchema),
    defaultValues: {
      equipmentId: editData?.equipmentId || 0,
      workTypeId: editData?.workTypeId || 0,
      scheduledDate: editData?.scheduledDate 
        ? format(new Date(editData.scheduledDate), 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd'),
      briefingTime: editData?.briefingTime || '08:00',
      workerName: editData?.workerName || '',
      workLocation: editData?.workLocation || '',
      specialNotes: editData?.specialNotes || '',
    },
  });

  // Fetch equipment list
  const { data: equipmentList = [] } = useQuery({
    queryKey: ['/api/equipment'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/equipment');
      return response.json();
    },
  });

  // Fetch work types for selected equipment
  const { data: workTypes = [] } = useQuery({
    queryKey: ['/api/equipment', selectedEquipmentId, 'work-types'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/equipment/${selectedEquipmentId}/work-types`);
      return response.json();
    },
    enabled: !!selectedEquipmentId,
  });

  // Create or update work schedule mutation
  const saveScheduleMutation = useMutation({
    mutationFn: async (data: WorkScheduleFormData) => {
      const payload = {
        ...data,
        scheduledDate: new Date(data.scheduledDate).toISOString(),
      };
      
      const response = isEditing
        ? await apiRequest('PUT', `/api/work-schedules/${editData.id}`, payload)
        : await apiRequest('POST', '/api/work-schedules', payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-schedules'] });
      setOpen(false);
      if (!isEditing) {
        form.reset();
        setSelectedEquipmentId(null);
      }
      onSuccess?.();
    },
  });

  const onSubmit = (data: WorkScheduleFormData) => {
    saveScheduleMutation.mutate(data);
  };

  const handleEquipmentChange = (equipmentId: string) => {
    const id = parseInt(equipmentId);
    setSelectedEquipmentId(id);
    form.setValue('equipmentId', id);
    form.setValue('workTypeId', 0); // Reset work type when equipment changes
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            작업 일정 등록
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {isEditing ? "작업 일정 수정" : "작업 일정 등록"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "작업 일정 정보를 수정하고 안전 브리핑 시간을 조정합니다"
              : "새로운 작업 일정을 등록하고 안전 브리핑 시간을 설정합니다"
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Equipment Selection */}
              <FormField
                control={form.control}
                name="equipmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>대상 설비</FormLabel>
                    <Select onValueChange={handleEquipmentChange} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="설비를 선택하세요" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {equipmentList.map((equipment: Equipment) => (
                          <SelectItem key={equipment.id} value={equipment.id.toString()}>
                            {equipment.name} ({equipment.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Work Type Selection */}
              <FormField
                control={form.control}
                name="workTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>작업 유형</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      value={field.value?.toString()}
                      disabled={!selectedEquipmentId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="작업 유형을 선택하세요" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {workTypes.map((workType: WorkType) => (
                          <SelectItem key={workType.id} value={workType.id.toString()}>
                            {workType.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Scheduled Date */}
              <FormField
                control={form.control}
                name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>작업 날짜</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Briefing Time */}
              <FormField
                control={form.control}
                name="briefingTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      브리핑 시간
                    </FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormDescription>
                      안전 브리핑이 자동으로 표출될 시간
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Worker Name */}
            <FormField
              control={form.control}
              name="workerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>작업자명</FormLabel>
                  <FormControl>
                    <Input placeholder="작업자 이름을 입력하세요" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Work Location */}
            <FormField
              control={form.control}
              name="workLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    작업 위치
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="작업이 수행될 지역명을 입력하세요 (예: 서울, 부산, 대구)" {...field} />
                  </FormControl>
                  <FormDescription>
                    날씨 기반 안전 브리핑을 위한 지역명
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Special Notes */}
            <FormField
              control={form.control}
              name="specialNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>특이사항</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="안전상 주의사항이나 특별히 고려할 사항을 입력하세요"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    작업 시 특별히 주의해야 할 사항이나 안전 고려사항
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button 
                type="submit" 
                disabled={saveScheduleMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {saveScheduleMutation.isPending 
                  ? (isEditing ? "수정 중..." : "등록 중...") 
                  : (isEditing ? "작업 일정 수정" : "작업 일정 등록")
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}