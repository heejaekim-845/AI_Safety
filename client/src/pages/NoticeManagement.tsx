import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertNoticeSchema, type InsertNotice, type Notice } from "@shared/schema";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Edit, 
  Trash2,
  ArrowLeft,
  Search,
  AlertCircle,
  FileText
} from "lucide-react";

export default function NoticeManagement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);

  const { data: notices, isLoading } = useQuery({
    queryKey: ["/api/notices"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/notices");
      return response.json();
    },
  });

  const form = useForm<InsertNotice>({
    resolver: zodResolver(insertNoticeSchema),
    defaultValues: {
      title: "",
      content: "",
      isImportant: false,
      isActive: true,
    }
  });

  const editForm = useForm<InsertNotice>({
    resolver: zodResolver(insertNoticeSchema),
    defaultValues: {
      title: "",
      content: "",
      isImportant: false,
      isActive: true,
    }
  });

  const createNoticeMutation = useMutation({
    mutationFn: async (data: InsertNotice) => {
      const response = await apiRequest("POST", "/api/notices", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notices"] });
      setShowAddDialog(false);
      form.reset();
      toast({
        title: "안내사항 추가 완료",
        description: "새로운 안내사항이 성공적으로 추가되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "안내사항 추가 실패",
        description: "안내사항 추가 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const updateNoticeMutation = useMutation({
    mutationFn: async (data: InsertNotice) => {
      if (!editingNotice) throw new Error("No notice selected for editing");
      const response = await apiRequest("PATCH", `/api/notices/${editingNotice.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notices"] });
      setShowEditDialog(false);
      setEditingNotice(null);
      editForm.reset();
      toast({
        title: "안내사항 수정 완료",
        description: "안내사항이 성공적으로 수정되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "안내사항 수정 실패",
        description: "안내사항 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const deleteNoticeMutation = useMutation({
    mutationFn: async (noticeId: number) => {
      const response = await apiRequest("DELETE", `/api/notices/${noticeId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notices"] });
      toast({
        title: "안내사항 삭제 완료",
        description: "안내사항이 성공적으로 삭제되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "안내사항 삭제 실패",
        description: "안내사항 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteNotice = (notice: Notice) => {
    if (window.confirm(`"${notice.title}" 안내사항을 정말 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      deleteNoticeMutation.mutate(notice.id);
    }
  };

  const onSubmit = (data: InsertNotice) => {
    createNoticeMutation.mutate(data);
  };

  const onEditSubmit = (data: InsertNotice) => {
    updateNoticeMutation.mutate(data);
  };

  const handleEditNotice = (notice: Notice) => {
    setEditingNotice(notice);
    editForm.reset({
      title: notice.title,
      content: notice.content,
      isImportant: notice.isImportant,
      isActive: notice.isActive,
    });
    setShowEditDialog(true);
  };

  const filteredNotices = notices && Array.isArray(notices) ? notices.filter((notice) => {
    const matchesSearch = notice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notice.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }) : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-lg text-gray-700">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => setLocation('/admin')}
              className="text-white hover:bg-white/10 p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-heading-1 text-white mb-2">안내사항 관리</h1>
              <p className="text-body text-blue-50">안내사항을 등록, 수정, 삭제할 수 있습니다</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="bg-white text-primary hover:bg-blue-50 border-0">
                  <Plus className="mr-2 h-4 w-4" />
                  안내사항 추가
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="grid grid-cols-3 gap-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">전체 안내사항</p>
                <p className="text-2xl font-bold text-gray-900">{filteredNotices.length}개</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">중요 안내사항</p>
                <p className="text-2xl font-bold text-gray-900">
                  {filteredNotices.filter(n => n.isImportant).length}개
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">활성 안내사항</p>
                <p className="text-2xl font-bold text-gray-900">
                  {filteredNotices.filter(n => n.isActive).length}개
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
        <Input
          placeholder="제목, 내용으로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-12 pr-4 py-3 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-300"
        />
      </div>

      {/* Notices List */}
      <div className="space-y-4">
        {filteredNotices.map((notice) => (
          <Card key={notice.id} className="card-minimal card-hover">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{notice.title}</h3>
                    <div className="flex space-x-2">
                      {notice.isImportant && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          중요
                        </Badge>
                      )}
                      <Badge variant={notice.isActive ? "default" : "secondary"} className="text-xs">
                        {notice.isActive ? "활성" : "비활성"}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-3 line-clamp-2">{notice.content}</p>
                  <div className="text-sm text-gray-500">
                    생성일: {new Date(notice.createdAt).toLocaleDateString('ko-KR')}
                    {notice.updatedAt && (
                      <span className="ml-4">
                        수정일: {new Date(notice.updatedAt).toLocaleDateString('ko-KR')}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex space-x-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditNotice(notice)}
                    className="hover:bg-blue-50"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteNotice(notice)}
                    className="hover:bg-red-50 text-red-600 border-red-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredNotices.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="mb-4">
                <FileText className="h-12 w-12 text-gray-400 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">안내사항이 없습니다</h3>
              <p className="text-gray-500">새로운 안내사항을 추가해보세요.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Notice Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>새 안내사항 추가</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>제목</FormLabel>
                    <FormControl>
                      <Input placeholder="안내사항 제목을 입력하세요" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>내용</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="안내사항 내용을 입력하세요"
                        rows={6}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex space-x-6">
                <FormField
                  control={form.control}
                  name="isImportant"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-medium">
                        중요 안내사항
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-medium">
                        활성 상태
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddDialog(false)}
                >
                  취소
                </Button>
                <Button 
                  type="submit" 
                  disabled={createNoticeMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {createNoticeMutation.isPending ? "추가 중..." : "추가"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Notice Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>안내사항 수정</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>제목</FormLabel>
                    <FormControl>
                      <Input placeholder="안내사항 제목을 입력하세요" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>내용</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="안내사항 내용을 입력하세요"
                        rows={6}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex space-x-6">
                <FormField
                  control={editForm.control}
                  name="isImportant"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-medium">
                        중요 안내사항
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-medium">
                        활성 상태
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowEditDialog(false)}
                >
                  취소
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateNoticeMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {updateNoticeMutation.isPending ? "수정 중..." : "수정"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}