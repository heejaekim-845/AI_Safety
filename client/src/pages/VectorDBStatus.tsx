import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Database, Search, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

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

export default function VectorDBStatus() {
  const [stats, setStats] = useState<VectorDBStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('전기');

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

          {/* 검색 테스트 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                벡터 검색 테스트
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
                  onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                />
                <Button onClick={performSearch} disabled={loading}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">검색 결과</span>
                  <Badge variant="outline">
                    {stats.searchResults.found}개 발견
                  </Badge>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2">
                  {stats.searchResults.results.length > 0 ? (
                    stats.searchResults.results.map((result, index) => (
                      <div key={index} className="p-3 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="secondary" className="text-xs">
                            {result.type}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            유사도: {(1 - result.distance).toFixed(3)}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-gray-800">
                          {result.title}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      검색 결과가 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 데이터 구성 설명 */}
      <Card>
        <CardHeader>
          <CardTitle>임베딩된 데이터 구성</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">사고사례 데이터</h3>
              <p className="text-sm text-gray-600">
                실제 산업현장 사고사례 1,793건<br/>
                (현재 임베딩: 일부)
              </p>
            </div>
            <div className="p-4 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">교육자료</h3>
              <p className="text-sm text-gray-600">
                안전교육 자료 및 가이드라인<br/>
                (education_data.json)
              </p>
            </div>
            <div className="p-4 border border-purple-200 rounded-lg">
              <h3 className="font-semibold text-purple-800 mb-2">안전법규</h3>
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