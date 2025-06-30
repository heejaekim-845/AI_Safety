# 지능형 안전정보 시스템(스마트 안전 파트너) - Industrial Equipment Safety Management System

## Overview

This is a comprehensive industrial equipment safety management system built as a mobile-first web application. The system helps workers perform safe equipment maintenance and operations through QR code scanning, real-time safety analysis, and guided work procedures. It features a React frontend with a Node.js/Express backend, utilizing AI-powered safety recommendations and comprehensive risk management.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom safety-themed color system
- **Build Tool**: Vite for fast development and optimized builds
- **Mobile-First Design**: Responsive design optimized for mobile devices

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript for type safety
- **Database ORM**: Drizzle ORM with PostgreSQL
- **AI Integration**: OpenAI GPT-4o for safety analysis and recommendations
- **Session Management**: Express sessions with PostgreSQL storage
- **API Design**: RESTful API with structured error handling

### Database Design
- **Primary Database**: PostgreSQL (configured for Neon/Serverless)
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Tables**: Equipment, Work Types, Work Procedures, Work Sessions, Risk Reports, Incidents
- **Data Types**: JSONB for complex structured data (safety equipment lists, LOTO points, etc.)

## Key Components

### Equipment Management
- **Equipment Registry**: Complete equipment database with codes, locations, and specifications
- **Risk Classification**: Three-tier risk system (RED/YELLOW/GREEN) with specific hazard flags
- **Safety Requirements**: Detailed safety equipment and procedure requirements per equipment
- **QR Code Integration**: Equipment identification through QR code scanning

### Work Management
- **Work Types**: Categorized work procedures with specific requirements
- **Dynamic Procedures**: Step-by-step work instructions with completion tracking
- **Work Sessions**: Real-time work session management with progress tracking
- **Safety Checklists**: Pre-work safety verification requirements

### AI Safety Analysis
- **Real-time Risk Assessment**: AI-powered analysis of current safety conditions
- **Contextual Recommendations**: Equipment and work-specific safety guidance
- **Procedure Adjustments**: Dynamic safety procedure modifications based on conditions
- **Emergency Response**: Automated emergency procedure generation

### Mobile Interface
- **QR Scanner**: Camera-based QR code scanning for equipment identification
- **Bottom Navigation**: Mobile-optimized navigation between key functions
- **Progressive Web App**: Responsive design that works across all devices
- **Offline Capability**: Structured for future offline functionality

## Data Flow

1. **Equipment Access**: Workers scan QR codes or search to select equipment
2. **Safety Assessment**: System performs AI-powered risk analysis based on equipment and work type
3. **Work Planning**: System presents available work types and safety requirements
4. **Session Creation**: Work session initiated with safety checklist completion
5. **Guided Execution**: Step-by-step procedure guidance with safety monitoring
6. **Completion Tracking**: Progress monitoring and completion verification
7. **Incident Reporting**: Real-time incident and risk reporting capabilities

## External Dependencies

### Development Dependencies
- **Vite Plugins**: React plugin, runtime error overlay, Replit integration
- **Build Tools**: ESBuild for server bundling, TypeScript compiler
- **Development Tools**: TSX for TypeScript execution, Drizzle Kit for database management

### Runtime Dependencies
- **Database**: Neon Database (PostgreSQL serverless)
- **AI Service**: OpenAI API for GPT-4o integration
- **UI Components**: Extensive Radix UI component library
- **Form Handling**: React Hook Form with Zod validation
- **Styling**: Tailwind CSS with PostCSS processing

### Production Infrastructure
- **Deployment**: Replit autoscale deployment
- **Database**: PostgreSQL with connection pooling
- **Static Assets**: Served through Express with Vite integration
- **Environment**: Node.js 20 runtime environment

## Deployment Strategy

### Development Environment
- **Live Reload**: Vite HMR for instant development feedback
- **Database**: Local PostgreSQL development database
- **AI Integration**: Development API keys for OpenAI
- **Error Handling**: Runtime error overlay for development debugging

### Production Environment
- **Build Process**: Vite production build with optimization
- **Server Bundling**: ESBuild bundling for Node.js deployment
- **Database**: Production PostgreSQL with SSL connections
- **Environment Variables**: Secure credential management
- **Port Configuration**: Configurable port binding (default 5000)

### Monitoring and Maintenance
- **Request Logging**: Comprehensive API request/response logging
- **Error Handling**: Structured error responses with appropriate HTTP status codes
- **Database Migrations**: Version-controlled schema changes through Drizzle
- **Session Management**: Persistent sessions with PostgreSQL storage

## Changelog

```
Changelog:
- June 25, 2025. Initial setup
- June 25, 2025. Enhanced AI analysis feature with equipment-specific and work-type-specific contextual recommendations
- June 25, 2025. Added color coding for work procedure categories: 기기조작(GREEN), 상태인지(YELLOW), 안전조치(RED)
- June 25, 2025. Added comprehensive equipment information fields: manufacturer, model name, installation year, specifications
- June 25, 2025. Added Hazardous Chemicals section to equipment dashboard with not applicable status
- June 25, 2025. Enhanced AI voice guidance to provide comprehensive coverage of all dashboard content including equipment details, hazardous chemicals, risk assessments, safety procedures, and emergency contacts
- June 25, 2025. Added "Major Risk Factors" section title to organize high temperature, high pressure, electrical, and other equipment risk information
- June 25, 2025. Added equipment image support with air compressor photo for sample equipment (압축기 A-101)
- June 25, 2025. Implemented MSDS popup dialog for nitrogen gas with safety data sheet image display
- June 25, 2025. Enhanced QR code scanner with real camera access using ZXing library for actual QR code detection
- June 25, 2025. Implemented working QR scanner with manual input and quick test options due to browser video rendering limitations
- June 25, 2025. Added "Check Safety Device Location" section to equipment dashboard with safety valve image popup showing device locations and inspection checklist
- June 25, 2025. Added "View Safety Facilities Location" section with combined fire extinguisher & emergency escape route button (green) and separate AED button (red)
- June 25, 2025. Modified AI voice guidance to exclude basic equipment information (manufacturer, model, specifications) and focus only on safety-critical content
- June 25, 2025. Added AI risk assessment feature for work types with Korean Industrial Safety and Health Act compliance, including risk scoring (probability × severity, max 20 points) and mitigation measures popup
- June 25, 2025. Modified risk assessment popup to show count of risk factors instead of overall risk level
- June 26, 2025. Changed app name from '스마트안전파트너' to '지능형 안전정보 시스템(스마트 안전 파트너)'
- June 26, 2025. Fixed bottom navigation bar overlay issue by adding proper padding to all pages
- June 26, 2025. Added emergency contact management feature to equipment edit screen with equipment-specific contact storage
- June 26, 2025. Added required safety equipment management feature to equipment edit screen with equipment-specific safety equipment lists
- June 26, 2025. Reorganized equipment dashboard section order: 설비상세정보 → 위험도분석 → 주요위험요소 → 필수안전장비 → 유해화학물질정보 → 안전장치위치확인 → 안전시설위치보기 → 비상연락처
- June 26, 2025. Implemented complete work procedure editing functionality for all equipment with proper cache invalidation, enabling real-time updates when editing work steps
- June 26, 2025. Added comprehensive sample work procedures for boiler equipment (연료 공급 차단, 압력 및 온도 확인, 연소실 점검, 연소 정지, 냉각 대기) to match compressor procedures
- June 26, 2025. Simplified equipment header blue box to show only 4 essential items: thumbnail image, equipment name, code, and location
- June 26, 2025. Added equipment photo thumbnails to main equipment selection screen with 64x64 pixel display, fallback initials for equipment without images, and error handling for failed image loads
- June 30, 2025. Successfully migrated to Supabase PostgreSQL database with complete data persistence - all equipment, work procedures, and safety data now stored in cloud database with stable operation
- June 30, 2025. Completed comprehensive visual transformation with modern design system featuring gradient backgrounds, hover animations, and safety-themed color schemes across all UI components
- June 30, 2025. Fixed duplicate major risk factors section that was displaying twice in equipment dashboard
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```