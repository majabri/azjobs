// Job board definitions
export interface BoardDefinition {
  id: string;
  name: string;
  baseUrls: string[];
  selectors: {
    title: string;
    company: string;
    location: string;
    salary: string;
    jobDescription: string;
    qualifications: string;
    responsibilities: string;
  };
  payloadType: 'html' | 'json' | 'hybrid';
  isRequiresAuth: boolean;
  fallbackStrategies: string[];
}

export interface FetchOptions {
  url: string;
  timeout?: number;
  followRedirects?: boolean;
  userAgent?: string;
  headers?: Record<string, string>;
}

export interface FetchResult {
  url: string;
  html: string;
  statusCode: number;
  detectedFormat?: string;
  fetchMethod: 'firecrawl' | 'axios' | 'cached';
  timestamp: Date;
}

export interface ClassifiedContent {
  jobSection: string;
  benefitsSection: string;
  companySection: string;
  otherSection: string;
  confidence: number;
}

export interface ExtractedSkills {
  hardSkills: Array<{ skill: string; context: string; confidence: number }>;
  softSkills: Array<{ skill: string; context: string; confidence: number }>;
  qualifications: Array<{ qual: string; level: string }>;
  yearsOfExperience: number | null;
  educationRequired: string | null;
  allSkillsRaw: string[];
}

export interface LearningRecord {
  jobId: string;
  url: string;
  boardId: string;
  extractedSkills: string[];
  userFeedback: {
    correctSkills: string[];
    missingSkills: string[];
    falsePositives: string[];
    timestamp: Date;
  } | null;
  parsingAccuracy: number;
}

export interface ExtractionRule {
  id: string;
  boardId: string;
  ruleType: 'selector' | 'pattern' | 'semantic';
  rule: string;
  accuracy: number;
  appliedCount: number;
  lastUpdated: Date;
}
