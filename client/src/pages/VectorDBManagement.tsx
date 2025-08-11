import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Database, Shield, AlertTriangle, CheckCircle2, PlayCircle, Upload, Loader2 } from 'lucide-react';

interface EmbeddingStatus {
  hasCheckpoint: boolean;
  checkpoint: {
    timestamp: string;
    phase: 'incidents' | 'education' | 'regulations';
    lastCompletedIndex: number;
    totalCount: number;
    totalItemsProcessed: number;
  } | null;
  currentItems: number;
  indexPath: string;
  backupExists: boolean;
  error?: string;
}

interface VectorDBStats {
  totalDocuments: number;
  collections: string[];
}

export default function VectorDBManagement() {
  const [status, setStatus] = useState<EmbeddingStatus | null>(null);
  const [stats, setStats] = useState<VectorDBStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      setLoading(true);
      
      // 임베딩 상태 조회
      const statusResponse = await fetch('/api/embedding-status');
      if (statusResponse.ok && statusResponse.headers.get('content-type')?.includes('application/json')) {
        try {
          const statusData = await statusResponse.json();
          setStatus(statusData);
        } catch (parseError) {
          console.error('상태 JSON 파싱 실패:', parseError);
          setStatus(null);
        }
      } else {
        console.error('상태 조회 실패:', statusResponse.status, statusResponse.statusText);
        setStatus(null);
      }

      // 벡터DB 통계 조회
      const statsResponse = await fetch('/api/test-vector-db');
      if (statsResponse.ok && statsResponse.headers.get('content-type')?.includes('application/json')) {
        try {
          const statsData = await statsResponse.json();
          setStats(statsData.stats);
        } catch (parseError) {
          console.error('통계 JSON 파싱 실패:', parseError);
          setStats(null);
        }
      } else {
        console.error('통계 조회 실패:', statsResponse.status, statsResponse.statusText);
        setStats(null);
      }

    } catch (error) {
      console.error('상태 조회 실패:', error);
      setStatus(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleOperation = async (operationType: string, apiEndpoint: string, body?: any) => {
    try {
      setOperation(operationType);
      setLoading(true);

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(`성공: ${result.message}`);
        await loadStatus(); // 상태 새로고침
      } else {
        alert(`실패: ${result.error || result.message}`);
      }
    } catch (error) {
      alert(`오류: ${error.message}`);
    } finally {
      setOperation(null);
      setLoading(false);
    }
  };

  const getPhaseProgress = () => {
    if (!status?.checkpoint) return 0;
    const { lastCompletedIndex, totalCount } = status.checkpoint;
    return Math.round((lastCompletedIndex / totalCount) * 100);
  };

  const getPhaseName = (phase: string) => {
    const names = {
      incidents: '사고사례',
      education: '교육자료', 
      regulations: '안전법규'
    };
    return names[phase as keyof typeof names] || phase;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadProgress('파일 업로드 중...');
      setLoading(true);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-and-embed', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        setUploadProgress('임베딩 완료!');
        alert(`성공: ${result.message}`);
        await loadStatus(); // 상태 새로고침
      } else {
        alert(`업로드 실패: ${result.error || result.message}`);
      }
    } catch (error) {
      alert(`업로드 오류: ${error.message}`);
    } finally {
      setUploadProgress(null);
      setLoading(false);
      // 파일 입력 초기화
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">벡터DB 관리</h1>
          <p className="text-muted-foreground">임베딩 데이터 보호 및 복구 시스템</p>
        </div>
        <Button onClick={loadStatus} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* 현재 상태 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            현재 벡터DB 상태
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats?.totalDocuments || 0}</div>
              <div className="text-sm text-muted-foreground">총 문서 수</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{status?.currentItems || 0}</div>
              <div className="text-sm text-muted-foreground">인덱스 아이템</div>
            </div>
            <div className="text-center">
              <Badge variant={status?.backupExists ? "default" : "secondary"}>
                {status?.backupExists ? "백업 있음" : "백업 없음"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 체크포인트 상태 */}
      {status?.hasCheckpoint && status.checkpoint && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              체크포인트 발견
            </CardTitle>
            <CardDescription>
              중단된 임베딩 작업을 이어서 진행할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{getPhaseName(status.checkpoint.phase)}</strong> 단계에서 
                {status.checkpoint.lastCompletedIndex + 1}/{status.checkpoint.totalCount} 
                진행 중 중단됨 ({new Date(status.checkpoint.timestamp).toLocaleString()})
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>진행률</span>
                <span>{getPhaseProgress()}%</span>
              </div>
              <Progress value={getPhaseProgress()} className="w-full" />
            </div>

            <Button 
              onClick={() => handleOperation('체크포인트 재개', '/api/resume-embedding')}
              disabled={loading || operation === '체크포인트 재개'}
              className="w-full"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              {operation === '체크포인트 재개' ? '재개 중...' : '체크포인트에서 재개'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 복구 옵션 */}
      {status?.backupExists && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              데이터 보호 및 복구
            </CardTitle>
            <CardDescription>
              백업 파일을 사용하여 손상된 데이터를 복구할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                백업이 감지되었습니다. 데이터 손실 시 복구가 가능합니다.
              </AlertDescription>
            </Alert>
            
            <Button 
              onClick={() => handleOperation('백업 복구', '/api/restore-from-backup')}
              disabled={loading || operation === '백업 복구'}
              variant="outline"
              className="w-full"
            >
              <Shield className="h-4 w-4 mr-2" />
              {operation === '백업 복구' ? '복구 중...' : '백업에서 복구'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 파일 업로드 및 추가 인덱싱 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            파일 업로드 추가 인덱싱
          </CardTitle>
          <CardDescription>
            새로운 안전 문서 파일을 업로드하여 벡터DB에 추가합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <input
                type="file"
                id="fileUpload"
                className="hidden"
                accept=".json,.txt,.pdf"
                onChange={handleFileUpload}
                disabled={loading || uploadProgress !== null}
              />
              <label
                htmlFor="fileUpload"
                className="cursor-pointer flex flex-col items-center space-y-2"
              >
                <Upload className="h-8 w-8 text-gray-400" />
                <span className="text-sm text-gray-600">
                  클릭하여 파일 선택 (.json, .txt, .pdf)
                </span>
                <span className="text-xs text-gray-400">
                  안전 문서, 교육자료, 사고사례 등을 업로드하세요
                </span>
              </label>
            </div>
            
            {uploadProgress && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  {uploadProgress}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* 수동 작업 */}
      <Card>
        <CardHeader>
          <CardTitle>수동 벡터DB 관리</CardTitle>
          <CardDescription>
            필요시 수동으로 벡터DB를 재구축하거나 관리할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>주의:</strong> 재구축 시 기존 데이터가 삭제되고 처음부터 다시 임베딩됩니다. 
              체크포인트와 백업 시스템으로 안전하게 보호됩니다.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button 
              onClick={() => handleOperation('누락된 데이터 임베딩', '/api/resume-incomplete-embedding')}
              disabled={loading || operation === '누락된 데이터 임베딩'}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              {operation === '누락된 데이터 임베딩' ? '임베딩 중...' : '누락된 데이터 이어서'}
            </Button>
            <Button 
              onClick={() => handleOperation('안전한 재구축', '/api/rebuild-vector-db', { forceRebuild: true })}
              disabled={loading || operation === '안전한 재구축'}
              variant="default"
            >
              <Database className="h-4 w-4 mr-2" />
              {operation === '안전한 재구축' ? '재구축 중...' : '안전한 재구축'}
            </Button>
            
            <Button 
              onClick={() => handleOperation('강제 재생성', '/api/regenerate-vector-db')}
              disabled={loading || operation === '강제 재생성'}
              variant="destructive"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {operation === '강제 재생성' ? '재생성 중...' : '강제 재생성'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 오류 표시 */}
      {status?.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            오류: {status.error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}