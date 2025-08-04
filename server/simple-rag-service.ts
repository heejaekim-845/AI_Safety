import * as XLSX from 'xlsx';
import path from 'path';

export interface AccidentCase {
  id: string;
  title: string;
  date: string;
  location: string;
  industry: string;
  workType: string;
  accidentType: string;
  severity: string;
  summary: string;
  directCause: string;
  rootCause: string;
  keywords: string;
  prevention: string;
  regulations?: string;
  notes?: string;
}

class SimpleRAGService {
  private accidentCases: AccidentCase[] = [];
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('Initializing Simple RAG Service...');
      const excelPath = path.join(process.cwd(), 'attached_assets', '사고사례_취합_1754296628317.xlsx');
      const workbook = XLSX.readFile(excelPath);
      
      let allAccidents: AccidentCase[] = [];
      
      // Process all sheets (제조업, 서비스업, 건설업)
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { range: 1 }); // Skip header row
        
        const accidents = data.map((row: any, index: number) => {
          const accident: AccidentCase = {
            id: `${sheetName}_${index}`,
            title: row['제목'] || '',
            date: row['발생일자'] || '',
            location: row['발생장소'] || '',
            industry: row['업종'] || sheetName,
            workType: row['작업유형'] || '',
            accidentType: row['재해형태'] || '',
            severity: row['피해정도'] || '',
            summary: row['사고개요'] || '',
            directCause: row['직접원인'] || '',
            rootCause: row['근본원인'] || '',
            keywords: row['위험요인 키워드'] || '',
            prevention: row['예방대책'] || '',
            regulations: row['관련법규'] || '',
            notes: row['비고'] || ''
          };
          return accident;
        }).filter(acc => acc.title && acc.summary); // Filter out empty entries
        
        allAccidents = allAccidents.concat(accidents);
      }

      this.accidentCases = allAccidents;
      console.log(`Loaded ${this.accidentCases.length} accident cases from Excel`);
      this.isInitialized = true;

    } catch (error) {
      console.error('Error loading accident cases:', error);
      this.accidentCases = [];
      this.isInitialized = true;
    }
  }

  async searchRelevantAccidents(workType: string, equipmentName: string, riskFactors: string[], limit: number = 5): Promise<AccidentCase[]> {
    await this.initialize();

    if (this.accidentCases.length === 0) return [];

    try {
      // Simple keyword-based search
      const searchTerms = [
        workType.toLowerCase(),
        equipmentName.toLowerCase(),
        ...riskFactors.map(f => f.toLowerCase())
      ].filter(term => term.length > 1);

      const results = this.accidentCases
        .map(accident => {
          let score = 0;
          const searchText = `${accident.title} ${accident.workType} ${accident.summary} ${accident.keywords}`.toLowerCase();
          
          // Calculate relevance score
          searchTerms.forEach(term => {
            if (searchText.includes(term)) {
              score += 1;
            }
          });

          // Boost score for exact work type match
          if (accident.workType.toLowerCase().includes(workType.toLowerCase())) {
            score += 3;
          }

          // Boost score for exact equipment match
          if (searchText.includes(equipmentName.toLowerCase())) {
            score += 2;
          }

          return { accident, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.accident);

      return results;

    } catch (error) {
      console.error('Error searching accident cases:', error);
      return [];
    }
  }

  async getAccidentsByWorkType(workType: string, limit: number = 3): Promise<AccidentCase[]> {
    await this.initialize();

    if (this.accidentCases.length === 0) return [];

    try {
      const results = this.accidentCases
        .filter(accident => 
          accident.workType.toLowerCase().includes(workType.toLowerCase()) ||
          accident.title.toLowerCase().includes(workType.toLowerCase())
        )
        .slice(0, limit);

      return results;

    } catch (error) {
      console.error('Error getting accidents by work type:', error);
      return [];
    }
  }
}

export const simpleRagService = new SimpleRAGService();