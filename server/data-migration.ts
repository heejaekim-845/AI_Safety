import { MemStorage } from "./storage";
import { DatabaseStorage } from "./database-storage-simple";

/**
 * 메모리 스토리지에서 데이터베이스로 데이터 마이그레이션
 * 데이터베이스 연결이 복구되면 실행할 수 있는 스크립트
 */
export async function migrateFromMemoryToDatabase() {
  console.log('🔄 Starting data migration from memory to database...');
  
  const memStorage = new MemStorage();
  const dbStorage = new DatabaseStorage();
  
  try {
    // Equipment 데이터 마이그레이션
    console.log('📦 Migrating equipment data...');
    const equipment = await memStorage.getAllEquipment();
    for (const eq of equipment) {
      const { id, ...equipmentData } = eq; // ID 제외하고 생성
      await dbStorage.createEquipment(equipmentData);
    }
    
    // Work types 마이그레이션
    console.log('⚙️ Migrating work types...');
    const workTypes = await memStorage.getAllWorkTypes();
    for (const wt of workTypes) {
      const { id, ...workTypeData } = wt;
      await dbStorage.createWorkType(workTypeData);
    }
    
    // Work procedures 마이그레이션
    console.log('📋 Migrating work procedures...');
    for (const wt of workTypes) {
      const procedures = await memStorage.getProceduresByWorkTypeId(wt.id);
      for (const proc of procedures) {
        const { id, ...procedureData } = proc;
        await dbStorage.createWorkProcedure(procedureData);
      }
    }
    
    console.log('✅ Data migration completed successfully!');
    console.log('💡 You can now switch to DatabaseStorage in storage.ts');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// 스크립트로 실행할 경우
if (require.main === module) {
  migrateFromMemoryToDatabase().catch(console.error);
}