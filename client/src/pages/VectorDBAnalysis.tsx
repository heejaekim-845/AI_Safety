import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, BarChart3, PieChart, Database, FileText, Book, Scale, Building2, Wrench, Clock } from 'lucide-react';

interface VectorDBAnalysis {
  totalDocuments: number;
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

export default function VectorDBAnalysis() {
  const [analysis, setAnalysis] = useState<VectorDBAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/vector-db-analysis');
      const data = await response.json();
      
      if (response.ok) {
        setAnalysis(data);
      } else {
        setError(data.error || '분석 실패');
      }
    } catch (err) {
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
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600">
                  {analysis.totalDocuments.toLocaleString()}
                </div>
                <div className="text-lg text-muted-foreground">총 문서 수</div>
              </div>
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
                        <Badge variant="secondary">{percentage}%</Badge>
                      </div>
                    </div>
                    <Progress value={percentage} className="w-full" />
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