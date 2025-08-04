import { ChromaApi, OpenAIEmbeddingFunction } from 'chromadb';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
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

class RAGService {
  private chroma: ChromaApi;
  private embeddingFunction: OpenAIEmbeddingFunction;
  private collectionName = 'accident_cases';
  private isInitialized = false;

  constructor() {
    this.chroma = new ChromaApi({
      path: "http://localhost:8000" // ChromaDB default URL
    });
    
    this.embeddingFunction = new OpenAIEmbeddingFunction({
      openai_api_key: process.env.OPENAI_API_KEY || '',
      openai_model: 'text-embedding-3-small'
    });
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Try to get existing collection
      await this.chroma.getCollection({
        name: this.collectionName,
        embeddingFunction: this.embeddingFunction
      });
      console.log('Found existing accident cases collection');
      this.isInitialized = true;
    } catch (error) {
      console.log('Creating new accident cases collection...');
      await this.loadAccidentCases();
    }
  }

  private async loadAccidentCases() {
    try {
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

      console.log(`Loaded ${allAccidents.length} accident cases from Excel`);

      // Create ChromaDB collection
      const collection = await this.chroma.createCollection({
        name: this.collectionName,
        embeddingFunction: this.embeddingFunction
      });

      // Prepare documents for embedding
      const documents = allAccidents.map(acc => 
        `제목: ${acc.title}\n작업유형: ${acc.workType}\n재해형태: ${acc.accidentType}\n사고개요: ${acc.summary}\n직접원인: ${acc.directCause}\n근본원인: ${acc.rootCause}\n위험요인: ${acc.keywords}\n예방대책: ${acc.prevention}`
      );

      const metadatas = allAccidents.map(acc => ({
        title: acc.title,
        workType: acc.workType,
        accidentType: acc.accidentType,
        industry: acc.industry,
        keywords: acc.keywords,
        severity: acc.severity
      }));

      const ids = allAccidents.map(acc => acc.id);

      // Add documents to collection in batches
      const batchSize = 50;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = {
          ids: ids.slice(i, i + batchSize),
          documents: documents.slice(i, i + batchSize),
          metadatas: metadatas.slice(i, i + batchSize)
        };
        
        await collection.add(batch);
        console.log(`Added batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(documents.length/batchSize)}`);
      }

      console.log('Successfully loaded all accident cases into ChromaDB');
      this.isInitialized = true;

    } catch (error) {
      console.error('Error loading accident cases:', error);
      throw error;
    }
  }

  async searchRelevantAccidents(workType: string, equipmentName: string, riskFactors: string[], limit: number = 5): Promise<AccidentCase[]> {
    await this.initialize();

    try {
      const collection = await this.chroma.getCollection({
        name: this.collectionName,
        embeddingFunction: this.embeddingFunction
      });

      // Create search query combining work type, equipment, and risk factors
      const searchQuery = `작업유형: ${workType} 설비: ${equipmentName} 위험요인: ${riskFactors.join(', ')}`;
      
      const results = await collection.query({
        queryTexts: [searchQuery],
        nResults: limit,
        include: ['documents', 'metadatas', 'distances']
      });

      if (!results.documents?.[0] || !results.metadatas?.[0]) {
        return [];
      }

      return results.documents[0].map((doc: string, index: number) => {
        const metadata = results.metadatas![0][index] as any;
        const lines = doc.split('\n');
        
        return {
          id: `search_result_${index}`,
          title: metadata.title || '',
          date: '',
          location: '',
          industry: metadata.industry || '',
          workType: metadata.workType || '',
          accidentType: metadata.accidentType || '',
          severity: metadata.severity || '',
          summary: lines.find(l => l.startsWith('사고개요:'))?.replace('사고개요: ', '') || '',
          directCause: lines.find(l => l.startsWith('직접원인:'))?.replace('직접원인: ', '') || '',
          rootCause: lines.find(l => l.startsWith('근본원인:'))?.replace('근본원인: ', '') || '',
          keywords: metadata.keywords || '',
          prevention: lines.find(l => l.startsWith('예방대책:'))?.replace('예방대책: ', '') || ''
        };
      });

    } catch (error) {
      console.error('Error searching accident cases:', error);
      return [];
    }
  }

  async getAccidentsByWorkType(workType: string, limit: number = 3): Promise<AccidentCase[]> {
    await this.initialize();

    try {
      const collection = await this.chroma.getCollection({
        name: this.collectionName,
        embeddingFunction: this.embeddingFunction
      });

      const results = await collection.query({
        queryTexts: [`작업유형: ${workType}`],
        nResults: limit,
        include: ['documents', 'metadatas']
      });

      if (!results.documents?.[0] || !results.metadatas?.[0]) {
        return [];
      }

      return results.documents[0].map((doc: string, index: number) => {
        const metadata = results.metadatas![0][index] as any;
        const lines = doc.split('\n');
        
        return {
          id: `worktype_result_${index}`,
          title: metadata.title || '',
          date: '',
          location: '',
          industry: metadata.industry || '',
          workType: metadata.workType || '',
          accidentType: metadata.accidentType || '',
          severity: metadata.severity || '',
          summary: lines.find(l => l.startsWith('사고개요:'))?.replace('사고개요: ', '') || '',
          directCause: lines.find(l => l.startsWith('직접원인:'))?.replace('직접원인: ', '') || '',
          rootCause: lines.find(l => l.startsWith('근본원인:'))?.replace('근본원인: ', '') || '',
          keywords: metadata.keywords || '',
          prevention: lines.find(l => l.startsWith('예방대책:'))?.replace('예방대책: ', '') || ''
        };
      });

    } catch (error) {
      console.error('Error getting accidents by work type:', error);
      return [];
    }
  }
}

export const ragService = new RAGService();