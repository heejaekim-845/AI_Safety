# 지능형 안전정보 시스템(스마트 안전 파트너) - Industrial Equipment Safety Management System

## Overview
This is a comprehensive, mobile-first web application designed as an industrial equipment safety management system. Its primary purpose is to enhance workplace safety by guiding workers through safe equipment maintenance and operations. Key capabilities include QR code scanning for equipment identification, real-time AI-powered safety analysis, dynamic work procedure guidance, and comprehensive risk management. The system aims to minimize industrial accidents, streamline safety protocols, and provide contextual safety recommendations, ultimately fostering a safer working environment.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **UI Framework**: shadcn/ui built on Radix UI primitives
- **Styling**: Tailwind CSS with custom safety-themed color system
- **Build Tool**: Vite
- **Design Principle**: Mobile-first responsive design, modern design system with gradient backgrounds, hover animations, safety-themed color schemes, and custom Korean fonts in headers.

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Database ORM**: Drizzle ORM
- **AI Integration**: OpenAI GPT-4o and Google Gemini for safety analysis and recommendations
- **Session Management**: Express sessions with PostgreSQL storage
- **API Design**: RESTful API

### Database Design
- **Primary Database**: PostgreSQL (configured for Neon/Serverless)
- **Schema Management**: Drizzle Kit
- **Core Tables**: Equipment, Work Types, Work Procedures, Work Sessions, Risk Reports, Incidents
- **Data Types**: JSONB for complex structured data

### Key Components & Features
- **Equipment Management**: Comprehensive database with risk classification (HIGH/MEDIUM/LOW), safety requirements, and QR code integration.
- **Work Management**: Categorized work types, dynamic step-by-step procedures, real-time session tracking, and safety checklists with location-based work scheduling.
- **AI Safety Analysis**: Real-time contextual risk assessment, dynamic procedure adjustments, and automated emergency response generation. AI voice guidance provides concise, safety-focused summaries. Utilizes a comprehensive Retrieval-Augmented Generation (RAG) system with real accident cases, safety education materials, and regulatory documents. The RAG system includes checkpoint-based data protection, automatic backup creation, and a detailed analytics dashboard.
- **Weather Integration**: Real-time weather data integration for location-specific safety recommendations.
- **Mobile Interface**: QR scanner, mobile-optimized navigation, PWA design.
- **Data Flow**: Guided workflow from equipment access (QR scan) through AI-powered safety assessment, work planning, session creation, guided execution, completion tracking, and incident reporting.
- **Profile-Based Architecture**: Configurable system using search profiles for equipment tags, risk categories, keyword groups, and search strategies, enabling multi-industry support.
- **Code Optimization**: Simplified AI service architecture, unified search functions, and removed redundant logic for improved maintainability.

## External Dependencies

### Runtime Dependencies
- **Database**: Neon Database (PostgreSQL serverless)
- **AI Service**: OpenAI API (GPT-4o) and Google Gemini (2.5 Flash model)
- **Weather Service**: OpenWeatherMap API
- **UI Components**: Radix UI component library
- **Form Handling**: React Hook Form with Zod validation
- **Styling**: Tailwind CSS
- **QR Scanning**: ZXing library
- **RAG System**: Vectra vector database (LocalIndex)

### Production Infrastructure
- **Deployment**: Replit autoscale deployment
- **Database**: PostgreSQL with connection pooling
- **Environment**: Node.js 20 runtime environment

## Recent Development History

- **Profile-Based Keyword Weighting System Implementation (August 20, 2025)**: Successfully implemented profile-based relevance scoring system that utilizes equipment-specific keywords defined in profiles.ts instead of hardcoded keyword lists. The system now properly applies weighted scoring to prioritize electrical equipment content (170kV GIS specific keywords like "감전", "절연장갑", "충전부", "개폐기") over generic safety materials. Results show electrical accident cases and insulation protection education materials now rank higher with boost scores (+0.15 for include keywords, +0.10 for profile keywords, -0.25 for exclude keywords). Performance optimization implemented by removing duplicate tokenization between resolveProfile and buildTargetedSearchQuery functions, using cached tokens for improved efficiency.

- **Application Startup Fix (August 26, 2025)**: Fixed critical syntax error in `server/profiles.ts` that was preventing the application from starting. The error was in the `buildTargetedSearchQuery` function parameter list where an unused `targetqueries` parameter was incorrectly formatted with a missing comma. Removed the unnecessary parameter and corrected the function signature to match actual usage patterns throughout the codebase. The Express server now starts successfully on port 5000.