import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, Search, RefreshCw, AlertCircle, CheckCircle, Plus, Upload, BookOpen, AlertTriangle, FileText } from 'lucide-react';

interface VectorDBStats {
  message: string;
  stats: {
    totalDocuments: number;
    collections: string[];
  };
  searchResults: {
    found: number;
    results: Array<{
      type: string;
      title: string;
      distance: number;
    }>;
  };
}

interface CategorySearchResult {
  message: string;
  results: {
    education: Array<{
      type: string;
      title: string;
      content: string;
      distance: number;
      metadata: any;
    }>;
    incident: Array<{
      type: string;
      title: string;
      content: string;
      distance: number;
      metadata: any;
    }>;
    regulation: Array<{
      type: string;
      title: string;
      content: string;
      distance: number;
      metadata: any;
    }>;
    totalFound: {
      education: number;
      incident: number;
      regulation: number;
    };
  };
}

export default function VectorDBStatus() {
  const [stats, setStats] = useState<VectorDBStats | null>(null);
  const [categoryResults, setCategoryResults] = useState<CategorySearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [addingDocs, setAddingDocs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('전기');
  const [newFilePaths, setNewFilePaths] = useState(['']);
  const [activeTab, setActiveTab] = useState('education');

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-vector-db');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('벡터 DB 상태 확인 실패:', error);
    }
    setLoading(false);
  };

  const regenerateVectorDB = async () => {
    setRegenerating(true);
    try {
      const response = await fetch('/api/regenerate-vector-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      alert(result.message);
      
      // 재생성 후 상태 새로고침
      setTimeout(() => {
        fetchStats();
      }, 2000);
    } catch (error) {
      console.error('벡터 DB 재생성 실패:', error);
      alert('벡터 DB 재생성에 실패했습니다.');
    }
    setRegenerating(false);
  };

  const addNewDocuments = async () => {
    const validPaths = newFilePaths.filter(path => path.trim() !== '');
    if (validPaths.length === 0) {
      alert('추가할 파일 경로를 입력해주세요.');
      return;
    }

    setAddingDocs(true);
    try {
      const response = await fetch('/api/add-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePaths: validPaths })
      });
      const result = await response.json();
      
      if (result.success) {
        alert(`성공: ${result.message}`);
        setNewFilePaths(['']); // 입력 필드 초기화
        fetchStats(); // 상태 새로고침
      } else {
        alert(`실패: ${result.message}`);
      }
    } catch (error) {
      console.error('문서 추가 실패:', error);
      alert('문서 추가에 실패했습니다.');
    }
    setAddingDocs(false);
  };

  const addFilePathField = () => {
    setNewFilePaths([...newFilePaths, '']);
  };

  const updateFilePath = (index: number, value: string) => {
    const updated = [...newFilePaths];
    updated[index] = value;
    setNewFilePaths(updated);
  };

  const removeFilePath = (index: number) => {
    if (newFilePaths.length > 1) {
      const updated = newFilePaths.filter((_, i) => i !== index);
      setNewFilePaths(updated);
    }
  };

  const performSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/test-vector-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('벡터 검색 실패:', error);
    }
    setLoading(false);
  };

  const performCategorySearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/search-by-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      const data = await response.json();
      setCategoryResults(data);
    } catch (error) {
      console.error('카테고리별 검색 실패:', error);
    }
    setLoading(false);
  };

  const partialReconstruct = async (category: 'education' | 'incident' | 'regulation') => {
    setRegenerating(true);
    try {
      const response = await fetch('/api/partial-reconstruct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category })
      });
      const result = await response.json();
      alert(result.message);
      
      // 재구성 후 상태 새로고침
      setTimeout(() => {
        fetchStats();
      }, 2000);
    } catch (error) {
      console.error(`${category} 부분 재구성 실패:`, error);
      alert(`${category} 부분 재구성에 실패했습니다.`);
    }
    setRegenerating(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Database className="h-8 w-8 text-blue-600" />
          벡터 DB 상태 확인
        </h1>
        <div className="flex gap-2">
          <Button onClick={fetchStats} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <Button onClick={regenerateVectorDB} disabled={regenerating} variant="destructive">
            <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? '재생성 중...' : '벡터 DB 재생성'}
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 기본 통계 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                벡터 DB 통계
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">상태</span>
                <Badge variant={stats.stats.totalDocuments > 0 ? "default" : "destructive"} className="flex items-center gap-1">
                  {stats.stats.totalDocuments > 0 ? (
                    <><CheckCircle className="h-3 w-3" /> 정상</>
                  ) : (
                    <><AlertCircle className="h-3 w-3" /> 데이터 없음</>
                  )}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">총 문서 수</span>
                <span className="text-lg font-bold text-blue-600">
                  {stats.stats.totalDocuments.toLocaleString()}개
                </span>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium">컬렉션</span>
                <div className="flex flex-wrap gap-1">
                  {stats.stats.collections.map((collection, index) => (
                    <Badge key={index} variant="secondary">
                      {collection}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />
              
              <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
                <strong>메시지:</strong> {stats.message}
              </div>
            </CardContent>
          </Card>

          {/* 카테고리별 검색 테스트 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                카테고리별 벡터 검색
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="검색어 입력 (예: 전기, GIS, 감전)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  onKeyPress={(e) => e.key === 'Enter' && performCategorySearch()}
                />
                <Button onClick={performCategorySearch} disabled={loading}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {categoryResults && (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="education" className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      교육자료 ({categoryResults.results.totalFound.education})
                    </TabsTrigger>
                    <TabsTrigger value="incident" className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      사고사례 ({categoryResults.results.totalFound.incident})
                    </TabsTrigger>
                    <TabsTrigger value="regulation" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      관련규정 ({categoryResults.results.totalFound.regulation})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="education" className="space-y-3">
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {categoryResults.results.education.length > 0 ? (
                        categoryResults.results.education.map((result, index) => (
                          <div key={index} className="p-3 border border-green-200 bg-green-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                교육자료
                              </Badge>
                              <span className="text-xs text-gray-500">
                                유사도: {result.distance.toFixed(3)}
                              </span>
                            </div>
                            <div className="text-sm font-medium text-gray-800 mb-1">
                              {result.title}
                            </div>
                            <div className="text-xs text-gray-600 line-clamp-2">
                              {result.content?.substring(0, 150)}...
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-500 py-8">
                          교육자료 검색 결과가 없습니다.
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="incident" className="space-y-3">
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {categoryResults.results.incident.length > 0 ? (
                        categoryResults.results.incident.map((result, index) => (
                          <div key={index} className="p-3 border border-red-200 bg-red-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="destructive" className="bg-red-100 text-red-800">
                                사고사례
                              </Badge>
                              <span className="text-xs text-gray-500">
                                유사도: {result.distance.toFixed(3)}
                              </span>
                            </div>
                            <div className="text-sm font-medium text-gray-800 mb-1">
                              {result.title}
                            </div>
                            <div className="text-xs text-gray-600 line-clamp-2">
                              {result.content?.substring(0, 150)}...
                            </div>
                            {result.metadata?.risk_keywords && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {result.metadata.risk_keywords.split(', ').slice(0, 3).map((keyword: string, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs bg-red-100 text-red-700">
                                    {keyword}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-500 py-8">
                          사고사례 검색 결과가 없습니다.
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="regulation" className="space-y-3">
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {categoryResults.results.regulation.length > 0 ? (
                        categoryResults.results.regulation.map((result, index) => (
                          <div key={index} className="p-3 border border-blue-200 bg-blue-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="default" className="bg-blue-100 text-blue-800">
                                관련규정
                              </Badge>
                              <span className="text-xs text-gray-500">
                                유사도: {result.distance.toFixed(3)}
                              </span>
                            </div>
                            <div className="text-sm font-medium text-gray-800 mb-1">
                              {result.title}
                            </div>
                            <div className="text-xs text-gray-600 line-clamp-2">
                              {result.content?.substring(0, 150)}...
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-500 py-8">
                          관련규정 검색 결과가 없습니다.
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              {!categoryResults && (
                <div className="text-center text-gray-500 py-8">
                  검색어를 입력하고 검색 버튼을 클릭하세요.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 새 문서 추가 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-green-600" />
            새 문서 추가 (전체 재생성 없이)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            embed_data 폴더에 있는 새로운 파일만 추가로 임베딩합니다. 기존 데이터는 유지됩니다.
          </div>
          
          <div className="space-y-3">
            {newFilePaths.map((filePath, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="예: new_accidents.json, additional_education.json"
                  value={filePath}
                  onChange={(e) => updateFilePath(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {newFilePaths.length > 1 && (
                  <Button 
                    onClick={() => removeFilePath(index)}
                    variant="outline" 
                    size="sm"
                    className="px-2"
                  >
                    ×
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={addFilePathField} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              파일 경로 추가
            </Button>
            <Button 
              onClick={addNewDocuments} 
              disabled={addingDocs || newFilePaths.every(path => path.trim() === '')}
              className="bg-green-600 hover:bg-green-700"
            >
              <Upload className={`h-4 w-4 mr-2 ${addingDocs ? 'animate-spin' : ''}`} />
              {addingDocs ? '임베딩 중...' : '문서 추가'}
            </Button>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <div className="text-sm font-medium text-blue-800 mb-2">사용 예시:</div>
            <div className="text-sm text-blue-700 space-y-1">
              <div>• JSON 파일: <code>new_accidents_2025.json</code></div>
              <div>• 텍스트 파일: <code>safety_manual.txt</code></div>
              <div>• 여러 파일: 위의 "+" 버튼으로 추가 입력창 생성</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 데이터 구성 설명 */}
      <Card>
        <CardHeader>
          <CardTitle>임베딩된 데이터 구성</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-blue-800">사고사례 데이터</h3>
                <Button 
                  onClick={() => partialReconstruct('incident')}
                  disabled={regenerating}
                  size="sm"
                  className="bg-blue-600/10 text-blue-800 hover:bg-blue-600/20 border border-blue-600/20"
                >
                  <RefreshCw className={`mr-1 h-3 w-3 ${regenerating ? 'animate-spin' : ''}`} />
                  재구성
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                실제 산업현장 사고사례 1,793건<br/>
                (accident_cases_for_rag.json)
              </p>
            </div>
            <div className="p-4 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-green-800">교육자료</h3>
                <Button 
                  onClick={async () => {
                    setRegenerating(true);
                    try {
                      const response = await fetch('/api/rebuild-partial-vector-db', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ dataTypes: ['education'] }),
                      });
                      
                      if (response.ok) {
                        const result = await response.json();
                        alert(`교육자료 재구성 완료: ${result.message}. 총 문서: ${result.stats?.totalDocuments || 0}개`);
                        
                        // 재구성 후 상태 새로고침
                        setTimeout(() => {
                          fetchStats();
                        }, 2000);
                      } else {
                        throw new Error('재구성 실패');
                      }
                    } catch (error) {
                      console.error('교육자료 재구성 실패:', error);
                      alert('교육자료 재구성 중 오류가 발생했습니다.');
                    }
                    setRegenerating(false);
                  }}
                  disabled={regenerating}
                  size="sm"
                  className="bg-green-600/10 text-green-800 hover:bg-green-600/20 border border-green-600/20"
                >
                  <RefreshCw className={`mr-1 h-3 w-3 ${regenerating ? 'animate-spin' : ''}`} />
                  재구성
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                안전교육 자료 및 가이드라인<br/>
                (education_data.json)
              </p>
            </div>
            <div className="p-4 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-purple-800">안전법규</h3>
                <Button 
                  onClick={() => partialReconstruct('regulation')}
                  disabled={regenerating}
                  size="sm"
                  className="bg-purple-600/10 text-purple-800 hover:bg-purple-600/20 border border-purple-600/20"
                >
                  <RefreshCw className={`mr-1 h-3 w-3 ${regenerating ? 'animate-spin' : ''}`} />
                  재구성
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                산업안전보건 관련 법규 PDF<br/>
                청크 단위로 분할 (367개)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && !stats && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mr-3" />
          <span className="text-lg">벡터 DB 상태 확인 중...</span>
        </div>
      )}
    </div>
  );
}