import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Send, 
  Bot, 
  User, 
  Wrench, 
  FileText, 
  AlertCircle,
  Settings,
  Loader2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface ManualChunk {
  id: string;
  text: string;
  metadata: {
    doc_id: string;
    family: string;
    equipment: string[];
    page_start: number;
    page_end: number;
    section_path?: string;
    title?: string;
    collection: string;
    task_type?: string[];
    component?: string[];
  };
  score: number;
}

interface ManualChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  equipment?: string[];
  sourceChunks?: ManualChunk[];
}

interface ChatContext {
  sessionId: string;
  messages: ManualChatMessage[];
  selectedEquipment?: string[];
  selectedFamily?: string;
}

interface EquipmentGroup {
  family: string;
  equipment: string[];
}

export default function ManualChatbot() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 상태 관리
  const [chatContext, setChatContext] = useState<ChatContext>({
    sessionId: `session_${Date.now()}`,
    messages: [],
    selectedEquipment: [],
    selectedFamily: undefined
  });
  
  const [inputMessage, setInputMessage] = useState('');

  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());

  // 설비 목록 조회
  const { data: equipmentData, isLoading: equipmentLoading } = useQuery({
    queryKey: ['/api/manual-chatbot/equipment'],
    queryFn: async () => {
      const response = await fetch('/api/manual-chatbot/equipment');
      if (!response.ok) throw new Error('설비 목록 조회 실패');
      return response.json();
    }
  });

  // 채팅 메시지 전송 뮤테이션
  const chatMutation = useMutation({
    mutationFn: async ({ query, context }: { query: string; context: ChatContext }) => {
      const response = await fetch('/api/manual-chatbot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, context })
      });
      if (!response.ok) throw new Error('채팅 응답 실패');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.response) {
        // 응답 메시지 추가
        setChatContext(prev => ({
          ...prev,
          messages: [...prev.messages, data.response]
        }));
      }
    },
    onError: (error: any) => {
      toast({
        title: "오류 발생",
        description: error.message || "채팅 응답을 받을 수 없습니다.",
        variant: "destructive"
      });
    }
  });

  // 메시지 전송 핸들러
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    const userMessage: ManualChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
      equipment: chatContext.selectedEquipment
    };

    // 사용자 메시지 추가
    const updatedContext = {
      ...chatContext,
      messages: [...chatContext.messages, userMessage]
    };
    
    setChatContext(updatedContext);
    setInputMessage('');

    // AI 응답 요청
    chatMutation.mutate({
      query: inputMessage.trim(),
      context: updatedContext
    });
  };

  // 엔터키 핸들러
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 메시지 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatContext.messages]);



  // 패밀리 필터 변경
  const handleFamilyChange = (family: string) => {
    setChatContext(prev => ({
      ...prev,
      selectedFamily: family === 'all' ? undefined : family,
      selectedEquipment: [] // 패밀리 변경시 설비 필터 초기화
    }));
  };

  // 청크 확장/축소
  const toggleChunk = (chunkId: string) => {
    setExpandedChunks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chunkId)) {
        newSet.delete(chunkId);
      } else {
        newSet.add(chunkId);
      }
      return newSet;
    });
  };

  // 선택된 패밀리의 설비 목록
  const availableEquipment = chatContext.selectedFamily 
    ? equipmentData?.equipment?.find((group: EquipmentGroup) => group.family === chatContext.selectedFamily)?.equipment || []
    : equipmentData?.equipment?.flatMap((group: EquipmentGroup) => group.equipment) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-green-600 rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">설비 매뉴얼 챗봇</h1>
                <p className="text-gray-600">AI가 매뉴얼 내용을 바탕으로 설비 관련 질문에 답변해드립니다</p>
              </div>
            </div>

          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 필터 패널 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5" />
                검색 필터
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 패밀리 선택 */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">설비 패밀리</label>
                <Select value={chatContext.selectedFamily || 'all'} onValueChange={handleFamilyChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="패밀리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {equipmentData?.equipment?.map((group: EquipmentGroup) => (
                      <SelectItem key={group.family} value={group.family}>
                        {group.family}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 설비 선택 */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">설비 종류</label>
                <Select 
                  value={chatContext.selectedEquipment?.[0] || 'all'} 
                  onValueChange={(value) => setChatContext(prev => ({
                    ...prev,
                    selectedEquipment: value === 'all' ? [] : [value]
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="설비 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {availableEquipment.map((equipment: string, index: number) => (
                      <SelectItem key={`${equipment}-${index}`} value={equipment}>
                        {equipment}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 선택된 필터 요약 */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">선택된 필터</div>
                <div className="space-y-1">
                  {chatContext.selectedFamily && chatContext.selectedFamily !== 'all' && (
                    <Badge variant="secondary" className="text-xs">
                      패밀리: {chatContext.selectedFamily}
                    </Badge>
                  )}
                  {chatContext.selectedEquipment && chatContext.selectedEquipment.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      설비: {chatContext.selectedEquipment[0]}
                    </Badge>
                  )}
                  {(!chatContext.selectedFamily || chatContext.selectedFamily === 'all') && 
                   (!chatContext.selectedEquipment || chatContext.selectedEquipment.length === 0) && (
                    <Badge variant="outline" className="text-xs">
                      전체 매뉴얼 검색
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 채팅 영역 */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                매뉴얼 상담
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* 메시지 영역 */}
              <ScrollArea className="h-96 w-full border rounded-lg p-4 mb-4">
                <div className="space-y-4">
                  {chatContext.messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <Bot className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p>안녕하세요! 설비 매뉴얼에 대해 궁금한 것이 있으시면 언제든 물어보세요.</p>
                      <p className="text-sm mt-2">예: "GIS 절연작업 절차를 알려주세요", "수차발전기 점검 방법은?"</p>
                    </div>
                  ) : (
                    chatContext.messages.map((message) => (
                      <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <div className="flex items-start gap-2">
                            {message.role === 'assistant' && <Bot className="w-5 h-5 mt-1 flex-shrink-0" />}
                            {message.role === 'user' && <User className="w-5 h-5 mt-1 flex-shrink-0" />}
                            <div className="flex-1">
                              <p className="whitespace-pre-wrap">{message.content}</p>
                              <p className="text-xs mt-2 opacity-75">
                                {new Date(message.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          
                          {/* 소스 청크 표시 (AI 응답만) */}
                          {message.role === 'assistant' && message.sourceChunks && message.sourceChunks.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-300">
                              <p className="text-sm font-medium mb-2">참고 매뉴얼 ({message.sourceChunks.length}개)</p>
                              <div className="space-y-2">
                                {message.sourceChunks.map((chunk) => (
                                  <div key={chunk.id} className="border border-gray-300 rounded-md">
                                    <button
                                      onClick={() => toggleChunk(chunk.id)}
                                      className="w-full text-left p-2 text-sm hover:bg-gray-50 rounded-md flex items-center justify-between"
                                    >
                                      <span>
                                        <strong>{chunk.metadata.title || '제목 없음'}</strong>
                                        <span className="ml-2 text-gray-600">
                                          (페이지 {chunk.metadata.page_start}-{chunk.metadata.page_end})
                                        </span>
                                      </span>
                                      {expandedChunks.has(chunk.id) ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                    </button>
                                    {expandedChunks.has(chunk.id) && (
                                      <div className="p-3 border-t border-gray-200 bg-gray-50">
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                          {chunk.text.substring(0, 500)}
                                          {chunk.text.length > 500 && '...'}
                                        </p>
                                        <div className="flex gap-2 mt-2">
                                          <Badge variant="outline" className="text-xs">
                                            {chunk.metadata.family}
                                          </Badge>
                                          {chunk.metadata.equipment.map(eq => (
                                            <Badge key={eq} variant="secondary" className="text-xs">
                                              {eq}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  
                  {/* 로딩 표시 */}
                  {chatMutation.isPending && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-lg p-3 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-gray-600">답변을 생성하고 있습니다...</span>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* 입력 영역 */}
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="설비 매뉴얼에 대해 질문하세요..."
                  disabled={chatMutation.isPending}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || chatMutation.isPending}
                  size="icon"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>

              {/* 상태 표시 */}
              <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  <span>
                    {equipmentLoading ? '설비 정보 로딩 중...' : 
                     `${equipmentData?.equipment?.length || 0}개 설비 패밀리 사용 가능`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>666개 매뉴얼 청크 검색 가능 (5개 매뉴얼)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}