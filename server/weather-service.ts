import axios from 'axios';

interface WeatherData {
  location: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  rainfall: number;
  condition: string;
  description: string;
  safetyWarnings: string[];
  weatherDate: string;
  weatherTime?: string;
  weatherType: 'historical' | 'current' | 'forecast';
  hourlyForecast?: HourlyForecast[];
}

interface HourlyForecast {
  time: string; // HH:mm 형식
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  rainfall: number;
}

export class WeatherService {
  private readonly API_KEY = process.env.OPENWEATHER_API_KEY;
  private readonly CURRENT_WEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather';
  private readonly ONE_CALL_URL = 'https://api.openweathermap.org/data/3.0/onecall';
  private readonly HISTORY_URL = 'https://api.openweathermap.org/data/3.0/onecall/timemachine';

  // Korean city coordinates mapping for reliable weather data
  private readonly KOREAN_CITIES: { [key: string]: { lat: number; lon: number } } = {
    '서울': { lat: 37.5665, lon: 126.9780 },
    '부산': { lat: 35.1796, lon: 129.0756 },
    '대구': { lat: 35.8714, lon: 128.6014 },
    '인천': { lat: 37.4563, lon: 126.7052 },
    '광주': { lat: 35.1595, lon: 126.8526 },
    '대전': { lat: 36.3504, lon: 127.3845 },
    '울산': { lat: 35.5384, lon: 129.3114 },
    '세종': { lat: 36.4800, lon: 127.2890 },
    '경기': { lat: 37.4138, lon: 127.5183 },
    '강원': { lat: 37.8228, lon: 128.1555 },
    '충북': { lat: 36.6357, lon: 127.4917 },
    '충남': { lat: 36.5184, lon: 126.8000 },
    '전북': { lat: 35.7175, lon: 127.1530 },
    '전남': { lat: 34.8161, lon: 126.4629 },
    '경북': { lat: 36.4919, lon: 128.8889 },
    '경남': { lat: 35.4606, lon: 128.2132 },
    '제주': { lat: 33.4996, lon: 126.5312 }
  };

  // 작업 일정에 따른 날씨 정보 수집 (시간 포함)
  async getWeatherForWorkDate(location: string, workDate?: string | Date, workTime?: string): Promise<WeatherData> {
    console.log(`📅 [getWeatherForWorkDate] 시작: location=${location}, workDate=${workDate}, workTime=${workTime}`);
    
    if (!workDate) {
      console.log(`📅 [getWeatherForWorkDate] workDate 없음 → getCurrentWeather 호출`);
      return this.getCurrentWeather(location);
    }

    let targetDate = new Date(workDate);
    
    // 시간 정보가 있으면 정확한 작업 시간 설정
    if (workTime) {
      const [hours, minutes] = workTime.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        targetDate.setHours(hours, minutes, 0, 0);
        console.log(`📅 작업 시간 반영: ${workTime} → ${targetDate.toLocaleString('ko-KR')}`);
      }
    }

    const now = new Date();
    const daysDiff = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
    const hoursDiff = (targetDate.getTime() - now.getTime()) / (1000 * 3600);
    
    console.log(`📅 시간 차이: daysDiff=${daysDiff}, hoursDiff=${hoursDiff.toFixed(1)}`);

    if (daysDiff < -1) {
      // 과거 날씨 (1일 전 이상)
      console.log(`📅 [getWeatherForWorkDate] → getHistoricalWeather 호출`);
      return this.getHistoricalWeather(location, targetDate, workTime);
    } else if (Math.abs(hoursDiff) <= 48) {
      // 48시간 이내 (현재 또는 가까운 미래/과거)
      console.log(`📅 [getWeatherForWorkDate] 48시간 이내 → getForecastWeather 호출`);
      return this.getForecastWeather(location, targetDate, workTime);
    } else if (daysDiff <= 7) {
      // 7일 이내 예보
      console.log(`📅 [getWeatherForWorkDate] 7일 이내 → getForecastWeather 호출`);
      return this.getForecastWeather(location, targetDate, workTime);
    } else {
      // 7일 초과 미래 (현재 날씨로 대체)
      console.warn(`📅 작업일정이 7일을 초과하여 현재 날씨를 제공합니다: ${workDate} ${workTime || ''}`);
      return this.getCurrentWeather(location);
    }
  }

  // 현재 날씨 정보 (시간대별 예보 포함)
  async getCurrentWeather(location: string): Promise<WeatherData> {
    try {
      if (!this.API_KEY) {
        throw new Error('OpenWeather API key not configured');
      }

      const coords = this.getCoordinatesForLocation(location);
      if (!coords) {
        throw new Error(`좌표를 찾을 수 없습니다: ${location}`);
      }

      console.log(`🌡️ [getCurrentWeather] 현재 날씨 조회 시작: "${location}"`);

      // One Call API로 현재 날씨와 시간대별 예보를 함께 가져오기
      const response = await axios.get(this.ONE_CALL_URL, {
        params: {
          lat: coords.lat,
          lon: coords.lon,
          appid: this.API_KEY,
          units: 'metric',
          lang: 'ko',
          exclude: 'minutely,alerts,daily'
        }
      });

      const weatherData = response.data;
      const result = this.parseOneCallCurrentResponse(weatherData.current, location);
      
      // 시간대별 예보 데이터 추가
      console.log(`🌡️ [getCurrentWeather] hourly 데이터 존재: ${!!weatherData.hourly}, 길이: ${weatherData.hourly?.length || 0}`);
      if (weatherData.hourly) {
        result.hourlyForecast = await this.parseHourlyForecast(weatherData.hourly, location);
      }
      
      result.weatherType = 'current';
      result.weatherDate = new Date().toISOString().split('T')[0];
      result.weatherTime = new Date().toTimeString().slice(0, 5);
      
      console.log(`🌡️ [getCurrentWeather] 현재 날씨 조회 완료: ${location}`, result);
      return result;
      
    } catch (error: any) {
      console.error('현재 날씨 조회 오류:', error.response?.data || error.message);
      
      // 폴백: 기존 current weather API 사용
      try {
        const fallbackResponse = await axios.get(this.CURRENT_WEATHER_URL, {
          params: {
            q: `${location},KR`,
            appid: this.API_KEY,
            units: 'metric',
            lang: 'ko'
          }
        });
        
        const fallbackResult = this.parseOpenWeatherResponse(fallbackResponse.data);
        fallbackResult.weatherType = 'current';
        fallbackResult.weatherDate = new Date().toISOString().split('T')[0];
        fallbackResult.weatherTime = new Date().toTimeString().slice(0, 5);
        
        return fallbackResult;
      } catch (fallbackError: any) {
        throw new Error(`현재 날씨 정보를 가져올 수 없습니다: ${fallbackError.response?.data?.message || fallbackError.message}`);
      }
    }
  }

  // 과거 날씨 정보
  async getHistoricalWeather(location: string, targetDate: Date, workTime?: string): Promise<WeatherData> {
    try {
      if (!this.API_KEY) {
        throw new Error('OpenWeather API key not configured');
      }

      const coords = this.getCoordinatesForLocation(location);
      if (!coords) {
        throw new Error(`좌표를 찾을 수 없습니다: ${location}`);
      }

      const timestamp = Math.floor(targetDate.getTime() / 1000);
      console.log(`과거 날씨 조회: ${location}, 날짜: ${targetDate.toDateString()}`);

      const response = await axios.get(this.HISTORY_URL, {
        params: {
          lat: coords.lat,
          lon: coords.lon,
          dt: timestamp,
          appid: this.API_KEY,
          units: 'metric',
          lang: 'ko'
        }
      });

      const weatherData = response.data.data[0] || response.data.current;
      const result = this.parseHistoricalResponse(weatherData, location);
      result.weatherType = 'historical';
      result.weatherDate = targetDate.toISOString().split('T')[0];
      result.weatherTime = workTime || targetDate.toTimeString().slice(0, 5);
      
      console.log(`과거 날씨 조회 완료: ${location}`, result);
      return result;
      
    } catch (error: any) {
      console.error('과거 날씨 조회 오류:', error.response?.data || error.message);
      throw new Error(`과거 날씨 정보를 가져올 수 없습니다: ${error.response?.data?.message || error.message}`);
    }
  }

  // 예보 날씨 정보  
  async getForecastWeather(location: string, targetDate: Date, workTime?: string): Promise<WeatherData> {
    try {
      if (!this.API_KEY) {
        throw new Error('OpenWeather API key not configured');
      }

      const coords = this.getCoordinatesForLocation(location);
      if (!coords) {
        throw new Error(`좌표를 찾을 수 없습니다: ${location}`);
      }

      console.log(`예보 날씨 조회: ${location}, 날짜: ${targetDate.toDateString()}`);

      const response = await axios.get(this.ONE_CALL_URL, {
        params: {
          lat: coords.lat,
          lon: coords.lon,
          appid: this.API_KEY,
          units: 'metric',
          lang: 'ko',
          exclude: 'minutely,alerts'
        }
      });

      const forecastData = response.data;
      const targetTimestamp = Math.floor(targetDate.getTime() / 1000);
      
      // 일별 예보에서 해당 날짜 찾기
      const dailyForecast = forecastData.daily.find((day: any) => {
        const dayStart = new Date(day.dt * 1000);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        
        return targetDate >= dayStart && targetDate <= dayEnd;
      });

      let weatherToUse;
      if (dailyForecast) {
        weatherToUse = dailyForecast;
      } else if (Math.abs(targetDate.getTime() - new Date().getTime()) < 24 * 60 * 60 * 1000) {
        // 오늘이면 현재 날씨 사용
        weatherToUse = forecastData.current;
      } else {
        // 가장 가까운 예보 사용
        weatherToUse = forecastData.daily[0];
      }

      const result = this.parseForecastResponse(weatherToUse, location);
      
      // 시간대별 예보 데이터 추가
      if (forecastData.hourly) {
        result.hourlyForecast = await this.parseHourlyForecast(forecastData.hourly, location, workTime);
      }
      
      result.weatherType = 'forecast';
      result.weatherDate = targetDate.toISOString().split('T')[0];
      result.weatherTime = workTime || targetDate.toTimeString().slice(0, 5);
      
      console.log(`예보 날씨 조회 완료: ${location}`, result);
      return result;
      
    } catch (error: any) {
      console.error('예보 날씨 조회 오류:', error.response?.data || error.message);
      throw new Error(`예보 날씨 정보를 가져올 수 없습니다: ${error.response?.data?.message || error.message}`);
    }
  }

  // 좌표 기반 현재 날씨 조회
  async getCurrentWeatherByCoords(lat: number, lon: number): Promise<WeatherData> {
    try {
      console.log(`좌표 기반 현재 날씨 조회: lat=${lat}, lon=${lon}`);
      
      if (!this.API_KEY) {
        console.warn('OpenWeather API 키가 없습니다.');
        throw new Error('OpenWeather API key not configured');
      }

      // Reverse geocoding to get location name
      const geoResponse = await axios.get(
        `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${this.API_KEY}`
      );
      
      let locationName = "현재 위치";
      if (geoResponse.data && geoResponse.data.length > 0) {
        const locationData = geoResponse.data[0];
        locationName = locationData.local_names?.ko || locationData.name || "현재 위치";
      }

      // Get weather by coordinates
      const weatherResponse = await axios.get(
        `${this.CURRENT_WEATHER_URL}?lat=${lat}&lon=${lon}&appid=${this.API_KEY}&units=metric&lang=kr`
      );

      const data = weatherResponse.data;
      const temperature = Math.round(data.main.temp);
      const condition = this.translateWeatherCondition(data.weather[0].main);
      
      const weatherData: WeatherData = {
        location: locationName,
        temperature,
        humidity: data.main.humidity,
        windSpeed: Math.round(data.wind?.speed || 0),
        rainfall: data.rain?.['1h'] || data.rain?.['3h'] || 0,
        condition,
        description: this.getWeatherDescription(condition, temperature),
        safetyWarnings: this.generateSafetyWarnings(condition, temperature, data.main.humidity, Math.round(data.wind?.speed || 0)),
        weatherDate: new Date().toISOString().split('T')[0],
        weatherTime: new Date().toTimeString().slice(0, 5),
        weatherType: 'current'
      };

      console.log(`좌표 기반 현재 날씨 조회 완료: ${locationName}`, weatherData);
      return weatherData;
    } catch (error) {
      console.error("좌표 기반 날씨 조회 실패:", error);
      throw new Error(`좌표 기반 날씨 정보를 가져올 수 없습니다: ${error}`);
    }
  }

  // 기존 메서드 (하위 호환성)
  async getWeatherForLocation(location: string): Promise<WeatherData> {
    try {
      if (!this.API_KEY) {
        throw new Error('OpenWeather API key not configured');
      }

      // Try to get coordinates for Korean cities first
      const coords = this.getCoordinatesForLocation(location);
      let response;

      console.log(`Attempting to get weather for location: "${location}"`);
      console.log('Coordinates found:', coords);

      if (coords) {
        // Use coordinate-based API call for reliability
        console.log(`Using coordinates for ${location}: lat=${coords.lat}, lon=${coords.lon}`);
        response = await axios.get(this.CURRENT_WEATHER_URL, {
          params: {
            lat: coords.lat,
            lon: coords.lon,
            appid: this.API_KEY,
            units: 'metric', // Celsius
            lang: 'ko' // Korean language for descriptions
          }
        });
      } else {
        // Fallback to city name search
        console.log(`No coordinates found for "${location}", trying city name search`);
        response = await axios.get(this.CURRENT_WEATHER_URL, {
          params: {
            q: `${location},KR`, // Assuming Korean locations
            appid: this.API_KEY,
            units: 'metric', // Celsius
            lang: 'ko' // Korean language for descriptions
          }
        });
      }

      const weatherData = response.data;
      const realWeatherData = this.parseOpenWeatherResponse(weatherData);
      realWeatherData.weatherType = 'current';
      realWeatherData.weatherDate = new Date().toISOString().split('T')[0];
      
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
      
      // Throw error instead of returning fallback data
      throw new Error(`날씨 정보를 가져올 수 없습니다: ${error.response?.data?.message || error.message}`);
    }
  }

  private getCoordinatesForLocation(location: string): { lat: number; lon: number } | null {
    // Check for exact match first
    if (this.KOREAN_CITIES[location]) {
      return this.KOREAN_CITIES[location];
    }

    // Check for partial matches (e.g., if location contains city name)
    for (const [city, coords] of Object.entries(this.KOREAN_CITIES)) {
      if (location.includes(city) || city.includes(location)) {
        return coords;
      }
    }

    return null;
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
      rainfall: data.rain?.['1h'] || data.rain?.['3h'] || 0,
      condition,
      description: this.getWeatherDescription(condition, temperature),
      safetyWarnings,
      weatherDate: new Date().toISOString().split('T')[0],
      weatherTime: new Date().toTimeString().slice(0, 5),
      weatherType: 'current'
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
      rainfall: condition === '비' ? Math.floor(Math.random() * 10) + 1 : 0, // Mock rainfall data
      condition,
      description: this.getWeatherDescription(condition, temperature),
      safetyWarnings,
      weatherDate: new Date().toISOString().split('T')[0],
      weatherTime: new Date().toTimeString().slice(0, 5),
      weatherType: 'current'
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

    if (temperature > 28) {
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

  private getWeatherDescription(condition: string, temperature: number, weatherType: string = 'current'): string {
    let prefix = '';
    switch (weatherType) {
      case 'historical':
        prefix = '해당 일자의 날씨는 ';
        break;
      case 'forecast':
        prefix = '예상 날씨는 ';
        break;
      default:
        prefix = '현재 날씨는 ';
    }

    let desc = `${prefix}${condition}입니다.`;
    
    if (temperature < 5) {
      desc += ' 추운 날씨로 방한 대책이 필요합니다.';
    } else if (temperature > 25) {
      desc += ' 더운 날씨로 열중증 예방이 필요합니다.';
    } else {
      desc += ' 작업하기 적당한 기온입니다.';
    }

    return desc;
  }

  // 과거 날씨 응답 파싱
  private parseHistoricalResponse(data: any, location: string): WeatherData {
    const temperature = Math.round(data.temp || data.main?.temp || 15);
    const humidity = data.humidity || data.main?.humidity || 60;
    const windSpeed = Math.round(data.wind_speed || data.wind?.speed || 3);
    const condition = this.translateWeatherCondition(data.weather?.[0]?.main || 'Clear');

    const safetyWarnings = this.generateSafetyWarnings(condition, temperature, humidity, windSpeed);

    return {
      location,
      temperature,
      humidity,
      windSpeed,
      rainfall: data.rain || 0,
      condition,
      description: this.getWeatherDescription(condition, temperature, 'historical'),
      safetyWarnings,
      weatherDate: '',
      weatherTime: '',
      weatherType: 'historical'
    };
  }

  // 예보 날씨 응답 파싱
  private parseForecastResponse(data: any, location: string): WeatherData {
    let temperature: number;
    let humidity: number;
    let windSpeed: number;
    let condition: string;

    if (data.temp) {
      // 일별 예보 데이터
      temperature = Math.round((data.temp.max + data.temp.min) / 2);
      humidity = data.humidity || 60;
      windSpeed = Math.round(data.wind_speed || 3);
      condition = this.translateWeatherCondition(data.weather?.[0]?.main || 'Clear');
    } else {
      // 현재 날씨 데이터
      temperature = Math.round(data.temp || data.main?.temp || 15);
      humidity = data.humidity || data.main?.humidity || 60;
      windSpeed = Math.round(data.wind_speed || data.wind?.speed || 3);
      condition = this.translateWeatherCondition(data.weather?.[0]?.main || 'Clear');
    }

    const safetyWarnings = this.generateSafetyWarnings(condition, temperature, humidity, windSpeed);

    return {
      location,
      temperature,
      humidity,
      windSpeed,
      rainfall: data.rain?.['1h'] || data.rain || 0,
      condition,
      description: this.getWeatherDescription(condition, temperature, 'forecast'),
      safetyWarnings,
      weatherDate: '',
      weatherTime: '',
      weatherType: 'forecast'
    };
  }



  // One Call API 현재 날씨 응답 파싱
  private parseOneCallCurrentResponse(data: any, location: string): WeatherData {
    const temperature = Math.round(data.temp || 15);
    const humidity = data.humidity || 60;
    const windSpeed = Math.round(data.wind_speed || 3);
    const condition = this.translateWeatherCondition(data.weather?.[0]?.main || 'Clear');

    const safetyWarnings = this.generateSafetyWarnings(condition, temperature, humidity, windSpeed);

    return {
      location,
      temperature,
      humidity,
      windSpeed,
      rainfall: data.rain?.['1h'] || 0,
      condition,
      description: this.getWeatherDescription(condition, temperature, 'current'),
      safetyWarnings,
      weatherDate: '',
      weatherTime: '',
      weatherType: 'current'
    };
  }

  // 시간대별 예보 데이터 파싱 (향후 12시간 + Historical API 보완)
  private async parseHourlyForecast(hourlyData: any[], location: string, workTime?: string): Promise<HourlyForecast[]> {
    console.log('=== 시간대별 예보 원본 데이터 디버깅 ===');
    console.log('hourlyData 길이:', hourlyData.length);
    
    // 처음 5개 데이터 확인
    hourlyData.slice(0, 5).forEach((hour, index) => {
      const date = new Date(hour.dt * 1000);
      const localTime = date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      console.log(`${index}: UTC시간=${new Date(hour.dt * 1000).toISOString()}, 한국시간=${localTime}, 온도=${hour.temp}°C`);
    });
    
    // 기본 예보 데이터 파싱
    const forecastData = hourlyData.slice(0, 12).map((hour: any) => {
      const date = new Date(hour.dt * 1000);
      const koreaHour = date.toLocaleString('en-US', { 
        timeZone: 'Asia/Seoul',
        hour12: false,
        hour: '2-digit'
      });
      
      console.log(`시간 변환: UTC ${date.toISOString()} → 한국 ${koreaHour}시, 온도=${Math.round(hour.temp)}°C`);
      
      return {
        time: koreaHour + ':00',
        temperature: Math.round(hour.temp),
        condition: this.translateWeatherCondition(hour.weather?.[0]?.main || 'Clear'),
        humidity: hour.humidity || 50,
        windSpeed: Math.round(hour.wind_speed || 0),
        rainfall: hour.rain?.['1h'] || 0
      };
    });
    
    // 작업시간이 있으면 누락된 과거 시간대를 Historical API로 보완
    if (workTime) {
      const workHour = parseInt(workTime.split(':')[0]);
      const neededHours = [workHour-2, workHour-1, workHour, workHour+1, workHour+2];
      const availableHours = forecastData.map(f => parseInt(f.time.split(':')[0]));
      
      console.log(`🔄 작업시간 ${workTime} 기준 필요한 시간대:`, neededHours.map(h => `${h}:00`));
      console.log(`🔄 현재 사용가능한 시간대:`, availableHours.map(h => `${h}:00`));
      
      const missingPastHours = neededHours.filter(h => h >= 0 && h < Math.min(...availableHours));
      
      if (missingPastHours.length > 0) {
        console.log(`🔄 누락된 과거 시간대 발견: ${missingPastHours.map(h => `${h}:00`).join(', ')}`);
        
        try {
          // Historical API로 과거 시간대 데이터 보완
          const today = new Date();
          const historicalData = await this.getHistoricalWeatherForHours(location, today, missingPastHours);
          
          // 누락된 시간대를 앞에 추가하고 시간순으로 정렬
          const allData = [...historicalData, ...forecastData];
          const sortedData = allData.sort((a, b) => {
            const hourA = parseInt(a.time.split(':')[0]);
            const hourB = parseInt(b.time.split(':')[0]);
            return hourA - hourB;
          });
          
          console.log(`✅ Historical API로 보완 완료: 총 ${sortedData.length}개 시간대`);
          console.log(`✅ 보완된 시간대:`, sortedData.map(h => h.time).join(', '));
          
          return sortedData;
        } catch (error) {
          console.warn(`⚠️ Historical API 보완 실패:`, error);
          return forecastData; // 실패 시 기존 데이터 유지
        }
      }
    }
    
    return forecastData;
  }

  // Historical API로 특정 시간대들의 날씨 데이터 가져오기
  private async getHistoricalWeatherForHours(location: string, date: Date, hours: number[]): Promise<HourlyForecast[]> {
    try {
      const coords = this.getCoordinatesForLocation(location);
      if (!coords) {
        throw new Error(`좌표를 찾을 수 없습니다: ${location}`);
      }

      console.log(`📜 [Historical API] 과거 시간대 요청: ${location}, 시간대: ${hours.map(h => `${h}:00`).join(', ')}`);

      // 오늘 00:00 기준으로 Unix timestamp 생성
      const todayMidnight = new Date(date);
      todayMidnight.setHours(0, 0, 0, 0);
      const unixTimestamp = Math.floor(todayMidnight.getTime() / 1000);

      const response = await axios.get(this.HISTORY_URL, {
        params: {
          lat: coords.lat,
          lon: coords.lon,
          dt: unixTimestamp,
          appid: this.API_KEY,
          units: 'metric',
          lang: 'ko'
        }
      });

      const historicalData = response.data;
      const resultHours: HourlyForecast[] = [];

      // 요청된 시간대들만 필터링
      for (const targetHour of hours.sort()) {
        const targetTimestamp = Math.floor(todayMidnight.getTime() / 1000) + (targetHour * 3600);
        
        // hourly 데이터에서 해당 시간대 찾기
        const hourData = historicalData.hourly?.find((h: any) => h.dt === targetTimestamp);
        
        if (hourData) {
          const hourForecast: HourlyForecast = {
            time: targetHour.toString().padStart(2, '0') + ':00',
            temperature: Math.round(hourData.temp),
            condition: this.translateWeatherCondition(hourData.weather?.[0]?.main || 'Clear'),
            humidity: hourData.humidity || 50,
            windSpeed: Math.round(hourData.wind_speed || 0),
            rainfall: hourData.rain?.['1h'] || 0
          };
          
          resultHours.push(hourForecast);
          console.log(`📜 Historical 데이터 추가: ${hourForecast.time} = ${hourForecast.temperature}°C`);
        }
      }

      return resultHours;
    } catch (error: any) {
      console.error(`📜 Historical API 오류:`, error.response?.data || error.message);
      return [];
    }
  }

  // Remove fallback weather method - no mock data when API fails
}

export const weatherService = new WeatherService();
export { WeatherData, HourlyForecast };