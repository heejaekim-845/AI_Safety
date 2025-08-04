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
import { Calendar, Plus, Clock } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";

const workScheduleSchema = z.object({
  equipmentId: z.number().min(1, "설비를 선택해주세요"),
  workTypeId: z.number().min(1, "작업 유형을 선택해주세요"),
  scheduledDate: z.string().min(1, "작업 날짜를 입력해주세요"),
  briefingTime: z.string().optional(),
  workerName: z.string().min(1, "작업자명을 입력해주세요"),
  workDescription: z.string().optional(),
  workVolume: z.string().optional(),
  workScope: z.string().optional(),
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
}

export function WorkScheduleForm({ trigger, onSuccess }: WorkScheduleFormProps) {
  const [open, setOpen] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const form = useForm<WorkScheduleFormData>({
    resolver: zodResolver(workScheduleSchema),
    defaultValues: {
      equipmentId: 0,
      workTypeId: 0,
      scheduledDate: format(new Date(), 'yyyy-MM-dd'),
      briefingTime: '08:00',
      workerName: '',
      workDescription: '',
      workVolume: '',
      workScope: '',
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

  // Create work schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (data: WorkScheduleFormData) => {
      const response = await apiRequest('POST', '/api/work-schedules', {
        ...data,
        scheduledDate: new Date(data.scheduledDate).toISOString(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-schedules'] });
      setOpen(false);
      form.reset();
      setSelectedEquipmentId(null);
      onSuccess?.();
    },
  });

  const onSubmit = (data: WorkScheduleFormData) => {
    createScheduleMutation.mutate(data);
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
            작업 일정 등록
          </DialogTitle>
          <DialogDescription>
            새로운 작업 일정을 등록하고 안전 브리핑 시간을 설정합니다
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

            {/* Work Description */}
            <FormField
              control={form.control}
              name="workDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>작업 내용</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="구체적인 작업 내용을 입력하세요"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Work Volume */}
              <FormField
                control={form.control}
                name="workVolume"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>작업 물량</FormLabel>
                    <FormControl>
                      <Input placeholder="예: 5대, 10개소 등" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Work Scope */}
              <FormField
                control={form.control}
                name="workScope"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>작업 범위</FormLabel>
                    <FormControl>
                      <Input placeholder="예: 전체, 일부, 특정 구역 등" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button 
                type="submit" 
                disabled={createScheduleMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createScheduleMutation.isPending ? "등록 중..." : "작업 일정 등록"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}