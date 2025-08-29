import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';

export class GoogleTTSService {
  private client: TextToSpeechClient;

  constructor() {
    // Google Cloud 인증 설정 (환경변수 사용)
    this.client = new TextToSpeechClient({
      // API 키 파일 경로나 JSON 키를 환경변수로 설정
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      // 또는 JSON 키를 직접 사용하는 경우
      credentials: process.env.GOOGLE_CLOUD_CREDENTIALS ? 
        JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS) : undefined
    });
  }

  /**
   * 한국어 텍스트를 고품질 음성으로 변환
   */
  async generateKoreanSpeech(text: string): Promise<Buffer> {
    try {
      // 텍스트 길이 검증 (Google TTS 제한: 5000자)
      if (text.length > 5000) {
        throw new Error('텍스트가 너무 깁니다. 5000자 이하로 줄여주세요.');
      }

      const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
        input: { text },
        voice: {
          languageCode: 'ko-KR',
          name: 'ko-KR-Neural2-A', // 고품질 Neural2 음성
          ssmlGender: protos.google.cloud.texttospeech.v1.SsmlVoiceGender.FEMALE
        },
        audioConfig: {
          audioEncoding: protos.google.cloud.texttospeech.v1.AudioEncoding.MP3,
          speakingRate: 1.1,     // 20% 빠른 재생 속도 (현재 설정과 동일)
          pitch: 0.0,            // 기본 음조
          volumeGainDb: 0.0,     // 기본 볼륨
          effectsProfileId: ['telephony-class-application'] // 통화 품질 최적화
        }
      };

      console.log('[GoogleTTS] 음성 합성 시작:', {
        textLength: text.length,
        voice: request.voice?.name,
        speakingRate: request.audioConfig?.speakingRate
      });

      const [response] = await this.client.synthesizeSpeech(request);
      
      if (!response.audioContent) {
        throw new Error('오디오 콘텐츠 생성에 실패했습니다.');
      }

      console.log('[GoogleTTS] 음성 합성 완료:', {
        audioSize: response.audioContent.length,
        format: 'MP3'
      });

      return response.audioContent as Buffer;

    } catch (error: any) {
      console.error('[GoogleTTS] 음성 합성 오류:', error);
      
      // Google Cloud 인증 오류 처리
      if (error.code === 'UNAUTHENTICATED' || error.code === 'PERMISSION_DENIED') {
        throw new Error('Google Cloud TTS 인증에 실패했습니다. API 키를 확인해주세요.');
      }
      
      // 할당량 초과 오류 처리
      if (error.code === 'RESOURCE_EXHAUSTED') {
        throw new Error('Google Cloud TTS 할당량이 초과되었습니다.');
      }
      
      // 일반적인 오류 처리
      throw new Error(`음성 합성 실패: ${error.message}`);
    }
  }

  /**
   * 사용 가능한 한국어 음성 목록 조회
   */
  async listKoreanVoices(): Promise<any[]> {
    try {
      const [result] = await this.client.listVoices({ languageCode: 'ko-KR' });
      return result.voices || [];
    } catch (error) {
      console.error('[GoogleTTS] 음성 목록 조회 오류:', error);
      return [];
    }
  }

  /**
   * 서비스 상태 확인
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 간단한 텍스트로 서비스 상태 확인
      await this.generateKoreanSpeech('테스트');
      return true;
    } catch (error) {
      console.error('[GoogleTTS] 헬스체크 실패:', error);
      return false;
    }
  }
}

// 싱글톤 인스턴스 생성
export const googleTTSService = new GoogleTTSService();