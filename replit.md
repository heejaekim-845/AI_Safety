# 지능형 안전정보 시스템(스마트 안전 파트너) - Industrial Equipment Safety Management System

## Overview
This is a comprehensive, mobile-first web application designed as an industrial equipment safety management system. Its primary purpose is to enhance workplace safety by guiding workers through safe equipment maintenance and operations. Key capabilities include QR code scanning for equipment identification, real-time AI-powered safety analysis, dynamic work procedure guidance, and comprehensive risk management. The system aims to minimize industrial accidents, streamline safety protocols, and provide contextual safety recommendations, ultimately fostering a safer working environment.

## Recent Updates (August 2025)
- **Vector Database Enhancement**: Implemented complete RAG system with OpenAI API integration for embedding 3,388+ safety documents
- **Data Protection System**: Added comprehensive checkpoint system with automatic backups every 100 documents
- **Data Recovery**: Implemented backup and restore functionality to prevent data loss during server interruptions
- **Management Interface**: Created VectorDBManagement page for checkpoint monitoring and manual recovery operations
- **Detailed Analytics**: Added VectorDBAnalysis page showing category breakdown, industry distribution, and work type analysis
- **UI Reorganization**: Separated Vector DB management into dedicated section with three access points (Status, Management, Analysis)
- **File Upload Feature**: Successfully restored file upload functionality with JSON/TXT support and automatic embedding processing
- **Data Coverage**: Stable processing of 3,390+ documents (accident cases + education materials + regulatory chunks + uploaded files)

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
- **Design Principle**: Mobile-first responsive design

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
- **AI Safety Analysis**: Real-time contextual risk assessment, dynamic procedure adjustments, and automated emergency response generation. AI voice guidance provides concise, safety-focused summaries.
- **Enhanced RAG-based Safety Analysis**: Implemented comprehensive retrieval-augmented generation system using real accident case data, safety education materials, and regulatory documents. Features checkpoint-based data protection, automatic backup creation, and detailed analytics dashboard. The system performs semantic search across 3,388 indexed documents with real-time monitoring and recovery capabilities.
- **Weather Integration**: Real-time weather data integration using OpenWeatherMap API for location-specific safety recommendations. System properly handles API failures without displaying mock data.
- **Mobile Interface**: QR scanner, mobile-optimized navigation, PWA design, and structured for future offline capability.
- **Data Flow**: Guided workflow from equipment access (QR scan) through AI-powered safety assessment, work planning, session creation, guided execution, completion tracking, and incident reporting.
- **Visuals**: Modern design system with gradient backgrounds, hover animations, safety-themed color schemes, and custom Korean fonts in headers.

## External Dependencies

### Runtime Dependencies
- **Database**: Neon Database (PostgreSQL serverless)
- **AI Service**: OpenAI API (GPT-4o) and Google Gemini (2.5 Flash model)
- **Weather Service**: OpenWeatherMap API for real-time weather data integration
- **UI Components**: Radix UI component library
- **Form Handling**: React Hook Form with Zod validation
- **Styling**: Tailwind CSS
- **QR Scanning**: ZXing library
- **RAG System**: Enhanced retrieval system with Vectra vector database, checkpoint-based data protection, comprehensive analytics dashboard, and real-time monitoring. Includes backup/restore functionality and detailed content analysis (category breakdown, industry distribution, work type analysis).

### Production Infrastructure
- **Deployment**: Replit autoscale deployment
- **Database**: PostgreSQL with connection pooling
- **Environment**: Node.js 20 runtime environment