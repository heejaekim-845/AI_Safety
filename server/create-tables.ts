import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
  max: 1
});

async function createTables() {
  console.log('🔧 Creating database tables...');
  
  try {
    // Create equipment table
    await sql`
      CREATE TABLE IF NOT EXISTS equipment (
        id SERIAL PRIMARY KEY,
        name VARCHAR NOT NULL,
        code VARCHAR NOT NULL UNIQUE,
        location VARCHAR NOT NULL,
        manufacturer VARCHAR,
        install_year INTEGER,
        specification VARCHAR,
        image_url VARCHAR,
        model_name VARCHAR,
        risk_level VARCHAR DEFAULT 'MEDIUM',
        high_temperature BOOLEAN DEFAULT false,
        high_pressure BOOLEAN DEFAULT false,
        electrical BOOLEAN DEFAULT false,
        chemical BOOLEAN DEFAULT false,
        mechanical BOOLEAN DEFAULT false,
        noise BOOLEAN DEFAULT false,
        vibration BOOLEAN DEFAULT false,
        radiation BOOLEAN DEFAULT false,
        confined_space BOOLEAN DEFAULT false,
        fall_risk BOOLEAN DEFAULT false,
        fire_explosion BOOLEAN DEFAULT false,
        toxic_gas BOOLEAN DEFAULT false,
        other_risks TEXT[],
        required_ppe TEXT[],
        emergency_contacts JSONB,
        required_safety_equipment TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create work_types table
    await sql`
      CREATE TABLE IF NOT EXISTS work_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR NOT NULL,
        equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
        description VARCHAR,
        requires_permit BOOLEAN DEFAULT false,
        estimated_duration INTEGER,
        required_qualifications TEXT[],
        required_equipment TEXT[],
        environmental_requirements TEXT[],
        legal_requirements TEXT[],
        special_precautions TEXT[],
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create work_procedures table
    await sql`
      CREATE TABLE IF NOT EXISTS work_procedures (
        id SERIAL PRIMARY KEY,
        work_type_id INTEGER REFERENCES work_types(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        category VARCHAR NOT NULL,
        title VARCHAR NOT NULL,
        description VARCHAR NOT NULL,
        checklist_items TEXT[],
        safety_notes VARCHAR,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create work_sessions table
    await sql`
      CREATE TABLE IF NOT EXISTS work_sessions (
        id SERIAL PRIMARY KEY,
        equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
        work_type_id INTEGER REFERENCES work_types(id) ON DELETE CASCADE,
        worker_name VARCHAR NOT NULL,
        start_time TIMESTAMP DEFAULT NOW(),
        end_time TIMESTAMP,
        status VARCHAR DEFAULT 'in_progress',
        notes VARCHAR,
        safety_checklist_completed BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create incidents table
    await sql`
      CREATE TABLE IF NOT EXISTS incidents (
        id SERIAL PRIMARY KEY,
        equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
        work_type_id INTEGER REFERENCES work_types(id) ON DELETE CASCADE,
        description VARCHAR NOT NULL,
        severity VARCHAR NOT NULL,
        reporter_name VARCHAR NOT NULL,
        incident_date TIMESTAMP DEFAULT NOW(),
        actions_taken VARCHAR,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create risk_reports table
    await sql`
      CREATE TABLE IF NOT EXISTS risk_reports (
        id SERIAL PRIMARY KEY,
        equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
        risk_type VARCHAR NOT NULL,
        description VARCHAR NOT NULL,
        severity VARCHAR NOT NULL,
        likelihood VARCHAR NOT NULL,
        mitigation_actions TEXT[],
        reporter_name VARCHAR NOT NULL,
        status VARCHAR DEFAULT 'open',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    console.log('✅ All tables created successfully!');
    
    // Insert sample data
    console.log('📝 Inserting sample data...');
    
    // Insert sample equipment
    const [equipment1] = await sql`
      INSERT INTO equipment (name, code, location, manufacturer, install_year, specification, image_url, model_name, risk_level, high_temperature, high_pressure, electrical, required_ppe, emergency_contacts, required_safety_equipment, other_risks)
      VALUES (
        '압축기',
        'A-101',
        '1층 기계실',
        '현대중공업',
        2018,
        '압력: 10bar, 용량: 500L',
        '/attached_assets/air-compressor-solution_1750831656695.jpg',
        'HD-500A',
        'HIGH',
        true,
        true,
        true,
        ARRAY['안전모', '안전화', '보안경', '방진마스크'],
        '{"emergency": "119", "maintenance": "031-123-4567", "supervisor": "010-1234-5678"}'::jsonb,
        ARRAY['압력계', '안전밸브', '비상정지버튼', '소화기'],
        ARRAY['고온 증기 누출 위험', '압력용기 파열 위험']
      )
      RETURNING id
    `;

    const [equipment2] = await sql`
      INSERT INTO equipment (name, code, location, manufacturer, install_year, specification, image_url, model_name, risk_level, high_temperature, high_pressure, electrical, required_ppe, emergency_contacts, required_safety_equipment, other_risks)
      VALUES (
        '보일러',
        'B-201',
        '지하 1층 보일러실',
        '경동나비엔',
        2020,
        '용량: 1000kcal/h, 압력: 1.5MPa',
        null,
        'KDB-1000',
        'HIGH',
        true,
        true,
        true,
        ARRAY['내열복', '안전모', '안전화', '방독면'],
        '{"emergency": "119", "maintenance": "02-987-6543", "supervisor": "010-9876-5432"}'::jsonb,
        ARRAY['압력계', '온도계', '안전밸브', '가스누설감지기'],
        ARRAY['고온 화상 위험', '가스 누출 위험', '폭발 위험']
      )
      RETURNING id
    `;

    // Insert sample work types
    const [workType1] = await sql`
      INSERT INTO work_types (name, equipment_id, description, requires_permit, estimated_duration, required_qualifications, required_equipment, environmental_requirements)
      VALUES (
        '일반 점검',
        ${equipment1.id},
        '정기적인 장비 상태 점검 및 기본 유지보수',
        false,
        30,
        ARRAY['기계 정비 자격증'],
        ARRAY['점검 도구', '윤활유'],
        ARRAY['통풍이 잘 되는 환경']
      )
      RETURNING id
    `;

    const [workType2] = await sql`
      INSERT INTO work_types (name, equipment_id, description, requires_permit, estimated_duration, required_qualifications, required_equipment, environmental_requirements)
      VALUES (
        '안전 정지',
        ${equipment1.id},
        '장비의 안전한 정지 및 에너지 차단',
        true,
        45,
        ARRAY['LOTO 교육 이수증', '기계 정비 자격증'],
        ARRAY['잠금장치', '태그', '압력 측정기'],
        ARRAY['작업 구역 격리']
      )
      RETURNING id
    `;

    // Insert sample work procedures
    await sql`
      INSERT INTO work_procedures (work_type_id, step_number, category, title, description, checklist_items, safety_notes)
      VALUES 
      (${workType1.id}, 1, '안전조치', '작업 전 안전 확인', '작업 전 필수 안전 점검 사항을 확인합니다.', ARRAY['개인보호구 착용 확인', '작업 구역 안전 확인', '비상 연락망 확인'], '모든 안전 장비가 정상 작동하는지 확인하세요.'),
      (${workType1.id}, 2, '기기조작', '장비 상태 확인', '압축기의 전반적인 상태를 점검합니다.', ARRAY['압력 게이지 확인', '온도 확인', '누설 점검'], '장비가 정상 온도 범위 내에 있는지 확인하세요.'),
      (${workType1.id}, 3, '상태인지', '윤활유 점검', '윤활유 상태와 레벨을 확인합니다.', ARRAY['오일 레벨 확인', '오일 색상 점검', '누설 여부 확인'], '오일 교체가 필요한 경우 즉시 보고하세요.'),
      (${workType2.id}, 1, '안전조치', 'LOTO 절차 시작', '잠금/태그아웃 절차를 시작합니다.', ARRAY['작업 허가서 확인', '에너지원 식별', '잠금 장치 준비'], 'LOTO 절차는 반드시 승인된 인원만 수행할 수 있습니다.'),
      (${workType2.id}, 2, '기기조작', '전원 차단', '모든 전원을 안전하게 차단합니다.', ARRAY['주 전원 차단', '제어 전원 차단', '차단 확인'], '전원 차단 후 반드시 무전압 확인을 하세요.'),
      (${workType2.id}, 3, '기기조작', '압력 해제', '시스템 내 압력을 안전하게 해제합니다.', ARRAY['압력 해제 밸브 개방', '압력 게이지 확인', '완전 해제 확인'], '압력 해제 시 분사 방향에 주의하세요.')
    `;

    console.log('✅ Sample data inserted successfully!');
    console.log('🎉 Database setup completed!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run the setup
createTables().catch(console.error);