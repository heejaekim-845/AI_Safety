import axios from 'axios';

interface WeatherData {
  location: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  description: string;
  safetyWarnings: string[];
}

export class WeatherService {
  private readonly API_KEY = process.env.OPENWEATHER_API_KEY;
  private readonly BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

  async getWeatherForLocation(location: string): Promise<WeatherData> {
    try {
      if (!this.API_KEY) {
        console.warn('OpenWeather API key not found, using fallback data');
        return this.getFallbackWeather(location);
      }

      // Get real weather data from OpenWeatherMap API
      const response = await axios.get(this.BASE_URL, {
        params: {
          q: `${location},KR`, // Assuming Korean locations
          appid: this.API_KEY,
          units: 'metric', // Celsius
          lang: 'kr' // Korean language for descriptions
        }
      });

      const weatherData = response.data;
      const realWeatherData = this.parseOpenWeatherResponse(weatherData);
      
      console.log(`Real weather data fetched for ${location}:`, realWeatherData);
      return realWeatherData;
      
    } catch (error: any) {
      console.error('Weather API error for location:', location);
      console.error('Error details:', error.response?.data || error.message);
      
      if (error.response?.data?.cod === 401) {
        console.warn('OpenWeather API key is invalid or inactive. New keys can take up to 10 minutes to activate.');
      } else if (error.response?.data?.cod === 404) {
        console.warn(`Location "${location}" not found in OpenWeather API`);
      }
      
      // Return fallback weather data if API fails
      return this.getFallbackWeather(location);
    }
  }

  private parseOpenWeatherResponse(data: any): WeatherData {
    const temperature = Math.round(data.main.temp);
    const humidity = data.main.humidity;
    const windSpeed = Math.round(data.wind.speed);
    const condition = this.translateWeatherCondition(data.weather[0].main);
    const location = data.name;

    const safetyWarnings = this.generateSafetyWarnings(condition, temperature, humidity, windSpeed);

    return {
      location,
      temperature,
      humidity,
      windSpeed,
      condition,
      description: this.getWeatherDescription(condition, temperature),
      safetyWarnings
    };
  }

  private translateWeatherCondition(englishCondition: string): string {
    const translations: { [key: string]: string } = {
      'Clear': '맑음',
      'Clouds': '흐림',
      'Rain': '비',
      'Drizzle': '이슬비',
      'Snow': '눈',
      'Mist': '안개',
      'Fog': '안개',
      'Haze': '흐림',
      'Thunderstorm': '뇌우'
    };
    
    return translations[englishCondition] || '흐림';
  }

  private generateMockWeather(location: string): WeatherData {
    // Generate realistic weather data for Korean industrial locations
    const conditions = ['맑음', '흐림', '비', '눈', '안개'];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    
    const temperature = Math.floor(Math.random() * 30) - 5; // -5 to 25°C
    const humidity = Math.floor(Math.random() * 60) + 30; // 30-90%
    const windSpeed = Math.floor(Math.random() * 15) + 1; // 1-15 m/s

    const safetyWarnings = this.generateSafetyWarnings(condition, temperature, humidity, windSpeed);

    return {
      location,
      temperature,
      humidity,
      windSpeed,
      condition,
      description: this.getWeatherDescription(condition, temperature),
      safetyWarnings
    };
  }

  private generateSafetyWarnings(condition: string, temperature: number, humidity: number, windSpeed: number): string[] {
    const warnings: string[] = [];

    if (condition === '비') {
      warnings.push('미끄럼 위험 - 논슬립 안전화 착용 필수');
      warnings.push('전기 작업 시 특별 주의 - 절연 보호구 사용');
    }

    if (condition === '눈') {
      warnings.push('빙판길 위험 - 체인 부착 및 보행 주의');
      warnings.push('저온 노출 위험 - 방한복 착용');
    }

    if (temperature < 0) {
      warnings.push('동상 위험 - 방한장갑 및 방한복 착용');
      warnings.push('파이프 동결 위험 - 보온 조치 확인');
    }

    if (temperature > 30) {
      warnings.push('열사병 위험 - 충분한 수분 섭취 및 휴식');
      warnings.push('고온 작업 시 냉각복 착용 권장');
    }

    if (windSpeed > 10) {
      warnings.push('강풍 주의 - 고소 작업 금지');
      warnings.push('비산물 위험 - 보호안경 및 마스크 착용');
    }

    if (humidity > 80) {
      warnings.push('고습도 환경 - 통풍 확보 및 탈수 주의');
    }

    if (condition === '안개') {
      warnings.push('시야 불량 - 작업조명 추가 설치');
      warnings.push('차량 운행 시 서행 및 안전거리 유지');
    }

    return warnings;
  }

  private getWeatherDescription(condition: string, temperature: number): string {
    let desc = `현재 날씨는 ${condition}입니다.`;
    
    if (temperature < 5) {
      desc += ' 추운 날씨로 방한 대책이 필요합니다.';
    } else if (temperature > 25) {
      desc += ' 더운 날씨로 열중증 예방이 필요합니다.';
    } else {
      desc += ' 작업하기 적당한 기온입니다.';
    }

    return desc;
  }

  private getFallbackWeather(location: string): WeatherData {
    console.log(`Using fallback weather data for location: ${location}`);
    return {
      location: location, // Use the actual location name provided
      temperature: 18,
      humidity: 60,
      windSpeed: 5,
      condition: '맑음',
      description: '실시간 날씨 정보를 불러올 수 없어 기본값을 사용합니다. API 키 활성화를 확인해주세요.',
      safetyWarnings: ['날씨 정보 확인 불가 - 현장 상황을 직접 확인하세요', 'API 연결 실패 - 수동으로 날씨 상황을 점검하세요']
    };
  }
}

export const weatherService = new WeatherService();