import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, BarChart3, PieChart, Database, FileText, Book, Scale, Building2, Wrench, Clock, Search } from 'lucide-react';

interface VectorDBAnalysis {
  totalDocuments: number;              // 원본 파일의 전체 문서수 (목표치)
  currentIndexedDocuments: number;     // 현재 인덱싱된 문서수 (실제값)
  originalDataCounts: Record<string, number>; // 각 카테고리별 원본 데이터 개수
  categoryBreakdown: Record<string, number>;
  industryBreakdown: Record<string, number>;
  workTypeBreakdown: Record<string, number>;
  sampleDocuments: Array<{
    type: string;
    title: string;
    industry: string;
    workType: string;
    date: string;
    content: string;
  }>;
  lastAnalyzed: string;
  message: string;
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

export default function VectorDBAnalysis() {
  const [analysis, setAnalysis] = useState<VectorDBAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('전기');
  const [searchResults, setSearchResults] = useState<CategorySearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('education');

  const loadAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/vector-db-analysis');
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setAnalysis(data);
        } else {
          setError('API 응답 형식이 올바르지 않습니다.');
        }
      } else {
        const text = await response.text();
        console.error('분석 API 오류:', response.status, text);
        setError(`분석 실패: ${response.status}`);
      }
    } catch (err) {
      console.error('분석 로드 오류:', err);
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalysis();
  }, []);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case '사고사례': return <FileText className="h-4 w-4" />;
      case '교육자료': return <Book className="h-4 w-4" />;
      case '안전법규': return <Scale className="h-4 w-4" />;
      default: return <Database className="h-4 w-4" />;
    }
  };

  const getPercentage = (count: number, total: number) => {
    return total > 0 ? Math.round((count / total) * 100) : 0;
  };

  const getTopItems = (breakdown: Record<string, number>, limit: number = 5) => {
    return Object.entries(breakdown)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit);
  };

  const performCategorySearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearchLoading(true);
    try {
      const response = await fetch('/api/search-by-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setSearchResults(data);
        } else {
          console.error('검색 API 응답 형식이 올바르지 않습니다.');
        }
      } else {
        console.error('카테고리별 검색 실패:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('카테고리별 검색 실패:', error);
    }
    setSearchLoading(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">벡터DB 상세 분석</h1>
          <p className="text-muted-foreground">인덱싱된 안전 데이터 현황 및 분포</p>
        </div>
        <Button onClick={loadAnalysis} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* 검색 기능 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            카테고리별 벡터 검색
          </CardTitle>
          <CardDescription>
            안전 관련 키워드를 검색하여 관련 문서를 카테고리별로 확인할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="검색어 입력 (예: 전기, GIS, 감전)"
              onKeyDown={(e) => e.key === 'Enter' && performCategorySearch()}
            />
            <Button onClick={performCategorySearch} disabled={searchLoading}>
              <Search className="h-4 w-4 mr-2" />
              {searchLoading ? '검색 중...' : '검색'}
            </Button>
          </div>

          {searchResults && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="education" className="flex items-center gap-2">
                  <Book className="h-4 w-4" />
                  교육자료 ({searchResults.results.totalFound.education})
                </TabsTrigger>
                <TabsTrigger value="incident" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  사고사례 ({searchResults.results.totalFound.incident})
                </TabsTrigger>
                <TabsTrigger value="regulation" className="flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  관련규정 ({searchResults.results.totalFound.regulation})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="education" className="space-y-3">
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {searchResults.results.education.length > 0 ? (
                    searchResults.results.education.map((result, index) => (
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
                  {searchResults.results.incident.length > 0 ? (
                    searchResults.results.incident.map((result, index) => (
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
                  {searchResults.results.regulation.length > 0 ? (
                    searchResults.results.regulation.map((result, index) => (
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

          {!searchResults && (
            <div className="text-center text-gray-500 py-8">
              검색어를 입력하고 검색 버튼을 클릭하세요.
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {analysis && (
        <>
          {/* 전체 통계 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                전체 데이터 현황
              </CardTitle>
              <CardDescription>
                마지막 분석: {new Date(analysis.lastAnalyzed).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 원본 데이터 (목표치) */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {analysis.totalDocuments.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">원본 파일 총 문서수</div>
                  <div className="text-xs text-muted-foreground">(목표치)</div>
                </div>
                
                {/* 현재 인덱싱된 데이터 */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {analysis.currentIndexedDocuments.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">현재 인덱싱 완료</div>
                  <div className="text-xs text-muted-foreground">(실제 벡터DB)</div>
                </div>
                
                {/* 진행률 */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {getPercentage(analysis.currentIndexedDocuments, analysis.totalDocuments)}%
                  </div>
                  <div className="text-sm text-muted-foreground">임베딩 진행률</div>
                  <Progress 
                    value={getPercentage(analysis.currentIndexedDocuments, analysis.totalDocuments)} 
                    className="w-full mt-2" 
                  />
                </div>
              </div>
              
              {/* 카테고리별 원본 vs 현재 비교 */}
              {analysis.originalDataCounts && (
                <div className="mt-6 pt-4 border-t">
                  <h4 className="font-medium mb-3">카테고리별 진행 현황</h4>
                  <div className="space-y-2">
                    {Object.entries(analysis.originalDataCounts).map(([category, originalCount]) => {
                      const currentCount = analysis.categoryBreakdown[category] || 0;
                      const progress = getPercentage(currentCount, originalCount);
                      return (
                        <div key={category} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(category)}
                            <span>{category}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {currentCount.toLocaleString()}/{originalCount.toLocaleString()}
                            </span>
                            <Badge variant={progress === 100 ? "default" : "secondary"}>
                              {progress}%
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 카테고리별 분포 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                카테고리별 분포
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(analysis.categoryBreakdown).map(([category, count]) => {
                const percentage = getPercentage(count, analysis.totalDocuments);
                return (
                  <div key={category} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(category)}
                        <span className="font-medium">{category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {count.toLocaleString()}개
                        </span>
                        <Badge variant="secondary">
                          {getPercentage(count, analysis.currentIndexedDocuments)}%
                        </Badge>
                      </div>
                    </div>
                    <Progress value={getPercentage(count, analysis.currentIndexedDocuments)} className="w-full" />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* 산업별 분포 (상위 10개) */}
          {Object.keys(analysis.industryBreakdown).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  산업별 사고사례 분포 (상위 10개)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {getTopItems(analysis.industryBreakdown, 10).map(([industry, count]) => {
                  const totalIndustry = Object.values(analysis.industryBreakdown).reduce((a, b) => a + b, 0);
                  const percentage = getPercentage(count, totalIndustry);
                  return (
                    <div key={industry} className="flex justify-between items-center">
                      <span className="font-medium">{industry}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {count}건
                        </span>
                        <Badge variant="outline">{percentage}%</Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* 작업유형별 분포 (상위 15개) */}
          {Object.keys(analysis.workTypeBreakdown).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  작업유형별 분포 (상위 15개)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {getTopItems(analysis.workTypeBreakdown, 15).map(([workType, count]) => {
                  const totalWorkType = Object.values(analysis.workTypeBreakdown).reduce((a, b) => a + b, 0);
                  const percentage = getPercentage(count, totalWorkType);
                  return (
                    <div key={workType} className="flex justify-between items-center">
                      <span className="font-medium">{workType}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {count}건
                        </span>
                        <Badge variant="outline">{percentage}%</Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* 샘플 문서 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                샘플 문서 미리보기
              </CardTitle>
              <CardDescription>
                각 카테고리별 대표 문서 예시
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.sampleDocuments.map((doc, index) => (
                <Card key={index} className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(doc.type)}
                        <Badge variant="secondary">{doc.type}</Badge>
                      </div>
                      {doc.date && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {doc.date}
                        </div>
                      )}
                    </div>
                    <h4 className="font-medium mb-2">{doc.title}</h4>
                    {doc.industry && (
                      <div className="text-sm text-muted-foreground mb-1">
                        <strong>산업:</strong> {doc.industry}
                      </div>
                    )}
                    {doc.workType && (
                      <div className="text-sm text-muted-foreground mb-2">
                        <strong>작업유형:</strong> {doc.workType}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {doc.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {loading && (
        <div className="flex justify-center items-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">분석 중...</span>
        </div>
      )}
    </div>
  );
}