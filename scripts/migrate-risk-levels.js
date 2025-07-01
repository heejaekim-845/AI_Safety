import { db } from '../server/db.js';
import { equipment } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// 기존 riskLevel 값을 새로운 형태로 변환
const riskLevelMapping = {
  'RED': 'HIGH',
  'YELLOW': 'MEDIUM', 
  'GREEN': 'LOW'
};

async function migrateRiskLevels() {
  try {
    console.log('위험도 레벨 마이그레이션 시작...');
    
    // 모든 설비 조회
    const allEquipment = await db.select().from(equipment);
    
    for (const equipmentItem of allEquipment) {
      const currentRiskLevel = equipmentItem.riskLevel;
      const newRiskLevel = riskLevelMapping[currentRiskLevel] || currentRiskLevel;
      
      if (newRiskLevel !== currentRiskLevel) {
        console.log(`${equipmentItem.name} (${equipmentItem.code}): ${currentRiskLevel} -> ${newRiskLevel}`);
        
        await db
          .update(equipment)
          .set({ riskLevel: newRiskLevel })
          .where(eq(equipment.id, equipmentItem.id));
      }
    }
    
    console.log('위험도 레벨 마이그레이션 완료!');
  } catch (error) {
    console.error('마이그레이션 오류:', error);
  }
}

migrateRiskLevels();