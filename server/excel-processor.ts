import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

export interface AccidentCase {
  id: string;
  equipment: string;
  workType: string;
  accidentType: string;
  description: string;
  cause: string;
  preventionMeasures: string;
  severity: string;
  date?: string;
  location?: string;
}

export class ExcelProcessor {
  private accidentCases: AccidentCase[] = [];
  private isLoaded = false;

  async loadAccidentData(): Promise<void> {
    if (this.isLoaded) return;

    try {
      const filePath = path.join(process.cwd(), 'attached_assets', '사고사례_취합_1754296259341.xlsx');
      
      if (!fs.existsSync(filePath)) {
        console.warn('Accident data file not found:', filePath);
        return;
      }

      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert sheet to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      // Skip header row and process data
      const headerRow = jsonData[0] || [];
      console.log('Excel headers:', headerRow);
      
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        
        // Map columns based on common Korean accident report formats
        const accidentCase: AccidentCase = {
          id: `case_${i}`,
          equipment: this.extractValue(row, 0) || '설비명 미상',
          workType: this.extractValue(row, 1) || '작업유형 미상',
          accidentType: this.extractValue(row, 2) || '사고유형 미상',
          description: this.extractValue(row, 3) || '사고내용 미상',
          cause: this.extractValue(row, 4) || '원인 미상',
          preventionMeasures: this.extractValue(row, 5) || '예방대책 미상',
          severity: this.extractValue(row, 6) || '중간',
          date: this.extractValue(row, 7),
          location: this.extractValue(row, 8)
        };
        
        this.accidentCases.push(accidentCase);
      }
      
      console.log(`Loaded ${this.accidentCases.length} accident cases from Excel file`);
      this.isLoaded = true;
      
    } catch (error) {
      console.error('Error loading accident data from Excel:', error);
    }
  }

  private extractValue(row: any[], index: number): string {
    const value = row[index];
    if (value === undefined || value === null || value === '') return '';
    return String(value).trim();
  }

  // RAG-like functionality to find relevant accident cases
  findRelevantAccidents(equipment: string, workType: string, limit: number = 3): AccidentCase[] {
    if (!this.isLoaded || this.accidentCases.length === 0) {
      return [];
    }

    // Calculate relevance scores for each accident case
    const scoredCases = this.accidentCases.map(accidentCase => {
      let score = 0;
      
      // Equipment matching (highest priority)
      if (this.containsKeywords(accidentCase.equipment, equipment)) {
        score += 10;
      }
      
      // Work type matching
      if (this.containsKeywords(accidentCase.workType, workType)) {
        score += 8;
      }
      
      // Cross-matching equipment and work type
      if (this.containsKeywords(accidentCase.equipment, workType) || 
          this.containsKeywords(accidentCase.workType, equipment)) {
        score += 5;
      }
      
      // Accident type relevance
      const commonKeywords = ['화재', '폭발', '감전', '낙하', '충돌', '화상', '질식', '중독'];
      commonKeywords.forEach(keyword => {
        if (accidentCase.accidentType.includes(keyword)) {
          score += 3;
        }
      });
      
      return { ...accidentCase, relevanceScore: score };
    });

    // Sort by relevance score and return top results
    return scoredCases
      .filter(item => item.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  private containsKeywords(text: string, keywords: string): boolean {
    if (!text || !keywords) return false;
    
    const textLower = text.toLowerCase();
    const keywordLower = keywords.toLowerCase();
    
    // Direct substring match
    if (textLower.includes(keywordLower)) return true;
    
    // Word-based matching
    const textWords = textLower.split(/\s+/);
    const keywordWords = keywordLower.split(/\s+/);
    
    return keywordWords.some(keyword => 
      textWords.some(word => word.includes(keyword) || keyword.includes(word))
    );
  }

  // Get all accident cases for debugging
  getAllAccidentCases(): AccidentCase[] {
    return this.accidentCases;
  }

  // Get statistics
  getStatistics() {
    return {
      totalCases: this.accidentCases.length,
      equipmentTypes: [...new Set(this.accidentCases.map(c => c.equipment))].length,
      workTypes: [...new Set(this.accidentCases.map(c => c.workType))].length,
      accidentTypes: [...new Set(this.accidentCases.map(c => c.accidentType))].length
    };
  }
}

// Singleton instance
export const excelProcessor = new ExcelProcessor();