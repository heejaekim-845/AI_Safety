import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { type Notice } from "@shared/schema";
import { 
  ArrowLeft,
  Search,
  AlertCircle,
  FileText,
  Calendar,
  Clock
} from "lucide-react";

export default function NoticeList() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  const { data: notices, isLoading } = useQuery({
    queryKey: ["/api/notices"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/notices");
      return response.json();
    },
  });

  const filteredNotices = notices && Array.isArray(notices) ? notices.filter((notice: Notice) => {
    const matchesSearch = notice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notice.content.toLowerCase().includes(searchTerm.toLowerCase());
    return notice.isActive && matchesSearch;
  }) : [];

  const importantNotices = filteredNotices.filter((notice: Notice) => notice.isImportant);
  const regularNotices = filteredNotices.filter((notice: Notice) => !notice.isImportant);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => setLocation('/')}
            className="text-white hover:bg-white/10 p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-heading-1 text-white mb-2">안내사항</h1>
            <p className="text-body text-blue-50">최신 안내사항을 확인하세요</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">중요 안내사항</p>
                <p className="text-2xl font-bold text-gray-900">{importantNotices.length}개</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">전체 안내사항</p>
                <p className="text-2xl font-bold text-gray-900">{filteredNotices.length}개</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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

      {/* Important Notices */}
      {importantNotices.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            중요 안내사항
          </h2>
          <div className="space-y-4">
            {importantNotices.map((notice: Notice) => (
              <Card key={notice.id} className="border-red-200 bg-red-50/30">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">{notice.title}</h3>
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          중요
                        </Badge>
                      </div>
                      <p className="text-gray-700 mb-4 whitespace-pre-wrap">{notice.content}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(notice.createdAt)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>{formatTime(notice.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Regular Notices */}
      {regularNotices.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <FileText className="h-5 w-5 text-blue-600 mr-2" />
            일반 안내사항
          </h2>
          <div className="space-y-4">
            {regularNotices.map((notice: Notice) => (
              <Card key={notice.id} className="card-minimal card-hover">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">{notice.title}</h3>
                      <p className="text-gray-700 mb-4 whitespace-pre-wrap">{notice.content}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(notice.createdAt)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>{formatTime(notice.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredNotices.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="mb-4">
              <FileText className="h-12 w-12 text-gray-400 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? "검색 결과가 없습니다" : "안내사항이 없습니다"}
            </h3>
            <p className="text-gray-500">
              {searchTerm ? "다른 검색어로 다시 시도해보세요." : "새로운 안내사항이 등록되면 여기에 표시됩니다."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}