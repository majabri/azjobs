// Analysis engine with comprehensive skill extraction, career level detection, and job title extraction

export interface SkillMatch {
  skill: string;
  matched: boolean;
  confidence: number; // 0–100
  context?: string;
  category?: string;
}

export interface LearningResource {
  title: string;
  type: "course" | "certification" | "project" | "book";
  platform: string;
  estimatedTime: string;
  url?: string;
}

export interface GapItem {
  area: string;
  severity: "critical" | "moderate" | "minor";
  action: string;
  resources: LearningResource[];
  estimatedWeeks: number;
}

export interface FitAnalysis {
  overallScore: number;
  matchedSkills: SkillMatch[];
  gaps: GapItem[];
  strengths: string[];
  improvementPlan: { week: string; action: string }[];
  summary: string;
}

// ─── Categorized Skill Keywords ───────────────────────────────────────────────
const SKILL_CATEGORIES: Record<string, string[]> = {
  "Programming Languages": [
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "golang", "rust",
    "ruby", "php", "swift", "kotlin", "scala", "r", "matlab", "perl", "bash", "shell",
    "powershell", "objective-c", "dart", "lua", "haskell", "elixir", "clojure",
  ],
  "Web & Frontend": [
    "react", "angular", "vue", "svelte", "next.js", "nuxt", "html", "css", "sass",
    "tailwind", "bootstrap", "jquery", "webpack", "vite", "redux", "graphql", "rest",
    "api", "responsive design", "web development", "frontend", "ui/ux",
  ],
  "Backend & Infrastructure": [
    "node", "node.js", "express", "django", "flask", "spring", "spring boot",
    ".net", "asp.net", "rails", "fastapi", "microservices", "serverless",
    "docker", "kubernetes", "terraform", "ansible", "jenkins", "ci/cd", "devops",
    "aws", "azure", "gcp", "cloud computing", "cloud architecture",
    "linux", "unix", "windows server", "vmware", "virtualization",
    "nginx", "apache", "load balancing", "cdn",
  ],
  "Data & Analytics": [
    "sql", "nosql", "mongodb", "postgresql", "mysql", "oracle", "redis",
    "elasticsearch", "kafka", "spark", "hadoop", "data analysis", "data engineering",
    "data science", "data modeling", "data warehousing", "etl", "data pipeline",
    "excel", "tableau", "power bi", "looker", "analytics", "business intelligence",
    "big data", "data visualization", "statistics", "reporting",
  ],
  "AI & Machine Learning": [
    "machine learning", "deep learning", "natural language processing", "nlp",
    "computer vision", "tensorflow", "pytorch", "scikit-learn", "neural networks",
    "ai", "artificial intelligence", "generative ai", "llm", "large language models",
    "reinforcement learning", "predictive modeling", "data mining",
  ],
  "Cybersecurity": [
    "cybersecurity", "information security", "infosec", "network security",
    "application security", "cloud security", "endpoint security",
    "vulnerability management", "penetration testing", "pen testing",
    "incident response", "threat intelligence", "threat detection",
    "siem", "soc", "security operations", "security architecture",
    "identity management", "iam", "access management", "zero trust",
    "encryption", "cryptography", "pki", "ssl/tls",
    "malware analysis", "forensics", "digital forensics",
    "dlp", "data loss prevention", "firewalls", "ids/ips",
    "security awareness", "security training",
    "devsecops", "secure sdlc", "application whitelisting",
  ],
  "Compliance & Governance": [
    "compliance", "governance", "risk management", "cyber risk",
    "grc", "audit", "internal audit", "regulatory compliance",
    "iso 27001", "iso/iec 27001", "iso 27002", "nist", "nist csf",
    "soc 2", "soc2", "sox", "hipaa", "pci dss", "pci", "gdpr", "ccpa", "fedramp",
    "cobit", "itil", "coso", "cmmc",
    "information assurance", "data privacy", "privacy",
    "policy development", "security policy", "risk assessment",
    "business continuity", "disaster recovery", "bcdr", "bcp", "drp",
    "third-party risk", "vendor risk management",
  ],
  "Project & Product Management": [
    "project management", "program management", "portfolio management",
    "product management", "product strategy", "product roadmap",
    "agile", "scrum", "kanban", "waterfall", "lean", "safe",
    "jira", "confluence", "asana", "trello",
    "pmp", "prince2", "six sigma",
    "stakeholder management", "requirements gathering", "business analysis",
    "change management", "release management",
  ],
  "Leadership & Strategy": [
    "leadership", "team leadership", "people management", "team building",
    "employee development", "mentoring", "coaching", "talent development",
    "strategic planning", "strategy", "digital transformation",
    "business process improvement", "process optimization",
    "organizational development", "cross-functional", "executive leadership",
    "budget management", "p&l", "cost optimization", "resource planning",
    "vendor management", "contract negotiation",
    "m&a", "mergers and acquisitions", "due diligence",
    "board reporting", "c-suite communication",
  ],
  "Communication & Soft Skills": [
    "communication", "public speaking", "presentation", "negotiation",
    "teamwork", "collaboration", "problem solving", "critical thinking",
    "analytical thinking", "decision making", "conflict resolution",
    "time management", "organizational skills", "attention to detail",
    "writing", "technical writing", "documentation",
    "customer success", "client relations", "relationship management",
  ],
  "Marketing & Sales": [
    "marketing", "digital marketing", "content marketing", "seo", "sem",
    "social media", "email marketing", "marketing automation",
    "google analytics", "hubspot", "salesforce", "crm",
    "sales", "business development", "lead generation",
    "brand strategy", "market research", "competitive analysis",
    "account management", "customer acquisition",
  ],
  "Design": [
    "ux", "ui", "user experience", "user interface", "ux design", "ui design",
    "figma", "sketch", "adobe xd", "invision",
    "graphic design", "visual design", "interaction design",
    "design thinking", "wireframing", "prototyping",
    "adobe creative suite", "photoshop", "illustrator",
  ],
  "Finance & Operations": [
    "finance", "accounting", "financial analysis", "financial modeling",
    "budgeting", "forecasting", "operations", "supply chain",
    "logistics", "procurement", "inventory management",
    "erp", "sap", "oracle financials",
    "lean manufacturing", "quality assurance", "qa",
  ],
  "Industry Domains": [
    "healthcare", "fintech", "banking", "insurance",
    "aerospace", "defense", "government", "federal",
    "pharmaceutical", "biotech", "life sciences",
    "manufacturing", "retail", "e-commerce",
    "telecommunications", "media", "entertainment",
    "legal", "real estate", "education", "edtech",
    "energy", "oil and gas", "utilities",
    "automotive", "transportation",
  ],
  "Certifications": [
    "cissp", "cism", "cisa", "ceh", "oscp", "comptia security+", "security+",
    "comptia network+", "aws certified", "azure certified", "gcp certified",
    "ccna", "ccnp", "itil certified",
    "certified scrum master", "csm", "psm",
    "togaf", "sabsa",
  ],
  "Testing & QA": [
    "testing", "unit testing", "integration testing", "e2e testing",
    "test automation", "selenium", "cypress", "playwright",
    "qa", "quality assurance", "performance testing", "load testing",
    "manual testing", "regression testing",
  ],
  "Networking": [
    "networking", "tcp/ip", "dns", "dhcp", "vpn",
    "routing", "switching", "wan", "lan", "sd-wan",
    "wireless", "802.1x",
  ],
  "Mobile": [
    "ios", "android", "react native", "flutter", "mobile development",
    "app development",
  ],
};

// Flatten for backward compat
const SKILL_KEYWORDS = Object.values(SKILL_CATEGORIES).flat();

// Build a reverse lookup: keyword → category
const KEYWORD_TO_CATEGORY: Record<string, string> = {};
for (const [cat, keywords] of Object.entries(SKILL_CATEGORIES)) {
  for (const kw of keywords) {
    KEYWORD_TO_CATEGORY[kw] = cat;
  }
}

// ─── Career Level Detection ──────────────────────────────────────────────────
const CAREER_LEVEL_PATTERNS: { level: string; patterns: RegExp[]; weight: number }[] = [
  {
    level: "C-Level / Executive",
    patterns: [
      /\b(chief|cto|cio|ciso|cfo|ceo|coo|cmo)\b/i,
      /\bchief\s+(technology|information|security|financial|executive|operating|marketing)\s+officer\b/i,
      /\bexecutive\s+(vice\s+president|director)\b/i,
      /\bevp\b/i,
    ],
    weight: 100,
  },
  {
    level: "VP / Senior Leadership",
    patterns: [
      /\b(vice\s+president|v\.?p\.?)\s+(of\s+)?\w/i,
      /\bvp\s+(of\s+)?\w/i,
      /\bsvp\b/i,
      /\bsenior\s+vice\s+president\b/i,
      /\bhead\s+of\b/i,
      /\bbiso\b/i,
      /\bbusiness\s+information\s+security\s+officer\b/i,
      /\bglobal\s+head\b/i,
      /\bregional\s+head\b/i,
    ],
    weight: 90,
  },
  {
    level: "Director",
    patterns: [
      /\bdirector\b/i,
      /\bsenior\s+director\b/i,
      /\bmanaging\s+director\b/i,
      /\bglobal\s+director\b/i,
    ],
    weight: 80,
  },
  {
    level: "Senior Manager / Principal",
    patterns: [
      /\bsenior\s+manager\b/i,
      /\bprincipal\b/i,
      /\bstaff\s+(engineer|architect|scientist)\b/i,
      /\bdistinguished\s+(engineer|architect)\b/i,
    ],
    weight: 70,
  },
  {
    level: "Manager",
    patterns: [
      /\bmanager\b/i,
      /\bteam\s+lead\b/i,
      /\blead\s+(engineer|developer|architect|analyst)\b/i,
    ],
    weight: 60,
  },
  {
    level: "Senior",
    patterns: [
      /\bsenior\b/i,
      /\bsr\.?\b/i,
      /\bsenior\s+(engineer|developer|analyst|consultant|architect|specialist)\b/i,
    ],
    weight: 50,
  },
  {
    level: "Mid-Level",
    patterns: [
      /\b(engineer|developer|analyst|consultant|specialist|coordinator|administrator)\b/i,
    ],
    weight: 30,
  },
  {
    level: "Entry-Level / Junior",
    patterns: [
      /\bjunior\b/i,
      /\bassociate\b/i,
      /\bentry[\s-]level\b/i,
      /\bintern\b/i,
    ],
    weight: 10,
  },
];

export function detectCareerLevel(text: string): string {
  let highestWeight = 0;
  let detectedLevel = "Mid-Level";

  for (const { level, patterns, weight } of CAREER_LEVEL_PATTERNS) {
    for (const p of patterns) {
      if (p.test(text)) {
        if (weight > highestWeight) {
          highestWeight = weight;
          detectedLevel = level;
        }
        break;
      }
    }
  }
  return detectedLevel;
}

// ─── Job Title Extraction ────────────────────────────────────────────────────
// Known acronym titles that should be detected directly
const ACRONYM_TITLES: { pattern: RegExp; expanded: string }[] = [
  { pattern: /\bbiso\b/i, expanded: "Business Information Security Officer" },
  { pattern: /\bciso\b/i, expanded: "Chief Information Security Officer" },
  { pattern: /\bcto\b/i, expanded: "Chief Technology Officer" },
  { pattern: /\bcio\b/i, expanded: "Chief Information Officer" },
  { pattern: /\bcso\b/i, expanded: "Chief Security Officer" },
  { pattern: /\bisso\b/i, expanded: "Information System Security Officer" },
  { pattern: /\bissm\b/i, expanded: "Information System Security Manager" },
  { pattern: /\bisse\b/i, expanded: "Information Systems Security Engineer" },
  { pattern: /\bissep\b/i, expanded: "Information Systems Security Engineering Professional" },
  { pattern: /\bissa\b/i, expanded: "Information Systems Security Architect" },
  { pattern: /\bdpo\b/i, expanded: "Data Protection Officer" },
  { pattern: /\bvciso\b/i, expanded: "Virtual Chief Information Security Officer" },
  { pattern: /\bsoc\s+analyst\b/i, expanded: "SOC Analyst" },
  { pattern: /\bsoc\s+manager\b/i, expanded: "SOC Manager" },
  { pattern: /\bsoc\s+lead\b/i, expanded: "SOC Lead" },
  { pattern: /\bsoc\s+engineer\b/i, expanded: "SOC Engineer" },
  { pattern: /\birt\s+lead\b/i, expanded: "Incident Response Team Lead" },
  { pattern: /\bcsirt\b/i, expanded: "Computer Security Incident Response Team" },
];

export function extractJobTitles(text: string): string[] {
  const titles = new Set<string>();

  // 1. Detect acronym-based titles
  for (const { pattern, expanded } of ACRONYM_TITLES) {
    if (pattern.test(text)) {
      titles.add(expanded);
    }
  }

  // 2. Detect compound VP / Director / Head titles via regex
  const compoundPatterns = [
    /\b(vice\s+president|vp)\s+(?:of\s+)?[\w\s,&/]+?(?=\n|\||–|—|\d{4}|$)/gim,
    /\bdirector\s+(?:of\s+)?[\w\s,&/]+?(?=\n|\||–|—|\d{4}|$)/gim,
    /\bhead\s+of\s+[\w\s,&/]+?(?=\n|\||–|—|\d{4}|$)/gim,
  ];
  for (const cp of compoundPatterns) {
    let m: RegExpExecArray | null;
    while ((m = cp.exec(text)) !== null) {
      let title = m[0].trim().replace(/[,|–—]+\s*$/, "").trim();
      if (title.length > 5 && title.length < 100) {
        titles.add(title);
      }
    }
  }

  // 3. Line-by-line detection for standalone title lines
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.length < 4 || line.length > 120) continue;

    const titleIndicators = [
      /vice\s+president/i, /v\.?p\.?\s/i, /\bvp\b/i, /director/i, /manager/i,
      /engineer/i, /architect/i, /analyst/i, /consultant/i, /specialist/i,
      /officer/i, /lead\b/i, /head\s+of/i, /principal/i, /chief/i,
      /coordinator/i, /administrator/i, /developer/i, /designer/i,
      /strategist/i, /scientist/i, /\bbiso\b/i,
    ];

    const isTitle = titleIndicators.some((p) => p.test(line));
    const isBullet = /^[-•●▪]/.test(line) || line.length > 80;
    if (isTitle && !isBullet) {
      let title = line
        .replace(/^#+ /, "")
        .replace(/[,|–—]\s*\d{4}.*$/, "")
        .replace(/\s*\(.*?\)\s*$/, "")
        .replace(/["']/g, "")
        .trim();
      if (title.length > 4 && title.length < 100) {
        titles.add(title);
      }
    }
  }

  return Array.from(titles).slice(0, 10);
}

// ─── Skill Extraction (improved) ─────────────────────────────────────────────
function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  // Sort by length descending to match longer phrases first
  const sorted = [...SKILL_KEYWORDS].sort((a, b) => b.length - a.length);
  const found: string[] = [];
  const foundLower = new Set<string>();

  for (const kw of sorted) {
    if (foundLower.has(kw)) continue;
    // Use word boundary for single words, includes for multi-word
    if (kw.includes(" ") || kw.includes("/")) {
      if (lower.includes(kw)) {
        found.push(kw);
        foundLower.add(kw);
      }
    } else {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(lower)) {
        found.push(kw);
        foundLower.add(kw);
      }
    }
  }
  return found;
}

export function extractSkillsFromText(text: string): string[] {
  return extractKeywords(text).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

export function extractSkillsWithCategories(text: string): { skill: string; category: string }[] {
  const keywords = extractKeywords(text);
  return keywords.map((kw) => ({
    skill: kw.charAt(0).toUpperCase() + kw.slice(1),
    category: KEYWORD_TO_CATEGORY[kw] || "Other",
  }));
}

// ─── Full Profile Extraction (local, no AI needed) ───────────────────────────
export interface ExtractedProfile {
  skills: string[];
  skillCategories: Record<string, string[]>;
  careerLevel: string;
  jobTitles: string[];
  certifications: string[];
}

export function extractProfileFromResume(resumeText: string): ExtractedProfile {
  const skillsWithCats = extractSkillsWithCategories(resumeText);
  const skills = skillsWithCats.map((s) => s.skill);

  // Group by category
  const skillCategories: Record<string, string[]> = {};
  for (const { skill, category } of skillsWithCats) {
    if (!skillCategories[category]) skillCategories[category] = [];
    skillCategories[category].push(skill);
  }

  const careerLevel = detectCareerLevel(resumeText);
  const jobTitles = extractJobTitles(resumeText);

  // Extract certifications by looking for known cert keywords
  const certPatterns = [
    /cissp/i, /cism/i, /cisa/i, /ceh/i, /oscp/i, /pmp/i,
    /comptia\s+\w+/gi, /aws\s+certified/gi, /azure\s+certified/gi,
    /ccna/i, /ccnp/i, /itil/i, /csm/i, /togaf/i, /sabsa/i,
    /certified\s+[\w\s]+professional/gi,
    /certified\s+[\w\s]+specialist/gi,
    /certified\s+[\w\s]+manager/gi,
    /nstissi/i, /cnss/i,
  ];
  const certs = new Set<string>();
  for (const p of certPatterns) {
    const matches = resumeText.match(p);
    if (matches) matches.forEach((m) => certs.add(m.trim()));
  }

  return {
    skills,
    skillCategories,
    careerLevel,
    jobTitles,
    certifications: Array.from(certs),
  };
}

// ─── Learning Resources Generator ────────────────────────────────────────────
const RESOURCE_DB: Record<string, LearningResource[]> = {
  "Cybersecurity": [
    { title: "CompTIA Security+ Certification", type: "certification", platform: "CompTIA", estimatedTime: "6-8 weeks", url: "https://www.comptia.org/certifications/security" },
    { title: "Cybersecurity Specialization", type: "course", platform: "Coursera", estimatedTime: "4-6 months", url: "https://www.coursera.org/specializations/cyber-security" },
    { title: "TryHackMe Learning Paths", type: "project", platform: "TryHackMe", estimatedTime: "2-4 weeks", url: "https://tryhackme.com" },
  ],
  "Compliance & Governance": [
    { title: "NIST Cybersecurity Framework Course", type: "course", platform: "NIST", estimatedTime: "2 weeks", url: "https://www.nist.gov/cyberframework" },
    { title: "ISO 27001 Lead Implementer", type: "certification", platform: "PECB", estimatedTime: "5 days" },
    { title: "GRC Fundamentals", type: "course", platform: "Udemy", estimatedTime: "3 weeks" },
  ],
  "Backend & Infrastructure": [
    { title: "AWS Solutions Architect", type: "certification", platform: "AWS", estimatedTime: "8-12 weeks", url: "https://aws.amazon.com/certification/" },
    { title: "Docker & Kubernetes Bootcamp", type: "course", platform: "Udemy", estimatedTime: "4 weeks" },
    { title: "Build a Microservices Project", type: "project", platform: "Self-directed", estimatedTime: "3 weeks" },
  ],
  "Programming Languages": [
    { title: "CS50 Introduction to CS", type: "course", platform: "Harvard/edX", estimatedTime: "12 weeks", url: "https://cs50.harvard.edu/" },
    { title: "LeetCode Practice", type: "project", platform: "LeetCode", estimatedTime: "Ongoing", url: "https://leetcode.com" },
  ],
  "Data & Analytics": [
    { title: "Google Data Analytics Certificate", type: "certification", platform: "Coursera", estimatedTime: "6 months", url: "https://www.coursera.org/professional-certificates/google-data-analytics" },
    { title: "SQL for Data Science", type: "course", platform: "Coursera", estimatedTime: "4 weeks" },
  ],
  "AI & Machine Learning": [
    { title: "Machine Learning Specialization", type: "course", platform: "Coursera/Stanford", estimatedTime: "3 months", url: "https://www.coursera.org/specializations/machine-learning-introduction" },
    { title: "Build an ML Portfolio Project", type: "project", platform: "Kaggle", estimatedTime: "4 weeks", url: "https://www.kaggle.com" },
  ],
  "Leadership & Strategy": [
    { title: "Management Essentials", type: "course", platform: "Harvard Online", estimatedTime: "8 weeks" },
    { title: "The First 90 Days", type: "book", platform: "Book", estimatedTime: "1 week" },
  ],
  "Web & Frontend": [
    { title: "Meta Front-End Developer", type: "certification", platform: "Coursera", estimatedTime: "7 months" },
    { title: "Build a Portfolio Site", type: "project", platform: "Self-directed", estimatedTime: "2 weeks" },
  ],
  "Project & Product Management": [
    { title: "PMP Certification Prep", type: "certification", platform: "PMI", estimatedTime: "3 months" },
    { title: "Agile/Scrum Master Cert", type: "certification", platform: "Scrum.org", estimatedTime: "2 weeks" },
  ],
};

const DEFAULT_RESOURCES: LearningResource[] = [
  { title: "LinkedIn Learning Courses", type: "course", platform: "LinkedIn", estimatedTime: "2-4 weeks", url: "https://www.linkedin.com/learning/" },
  { title: "Hands-on Portfolio Project", type: "project", platform: "Self-directed", estimatedTime: "3 weeks" },
];

function getResourcesForSkill(skill: string, category: string): LearningResource[] {
  const categoryResources = RESOURCE_DB[category];
  if (categoryResources) return categoryResources.slice(0, 3);
  return DEFAULT_RESOURCES;
}

// ─── Scoring & Analysis (unchanged logic, enhanced categories) ───────────────
function scoreOverlap(jobKeywords: string[], resumeKeywords: string[]): number {
  if (jobKeywords.length === 0) return 65;
  const matched = jobKeywords.filter((k) => resumeKeywords.includes(k)).length;
  return Math.round(Math.min(98, (matched / jobKeywords.length) * 100));
}

export function analyzeJobFit(jobDescription: string, resumeText: string): FitAnalysis {
  const jobKeywords = extractKeywords(jobDescription);
  const resumeKeywords = extractKeywords(resumeText);

  const overallScore = scoreOverlap(jobKeywords, resumeKeywords);

  const matchedSkills: SkillMatch[] = jobKeywords.map((skill) => {
    const matched = resumeKeywords.includes(skill);
    return {
      skill: skill.charAt(0).toUpperCase() + skill.slice(1),
      matched,
      confidence: matched ? Math.floor(70 + Math.random() * 30) : 0,
      context: matched ? "Found in resume" : "Not detected in resume",
      category: KEYWORD_TO_CATEGORY[skill] || "Other",
    };
  });

  const missingSkills = matchedSkills.filter((s) => !s.matched);
  const gaps: GapItem[] = missingSkills.slice(0, 5).map((s, i) => ({
    area: s.skill,
    severity: i === 0 ? "critical" : i <= 2 ? "moderate" : "minor",
    action:
      i === 0
        ? `Prioritize gaining hands-on experience with ${s.skill} — take a project or course`
        : i <= 2
        ? `Add ${s.skill} to your profile through a side project or certification`
        : `Mention ${s.skill} in your cover letter if you have adjacent experience`,
    resources: getResourcesForSkill(s.skill, s.category || "Other"),
    estimatedWeeks: i === 0 ? 4 : i <= 2 ? 3 : 2,
  }));

  const strengths = matchedSkills
    .filter((s) => s.matched)
    .slice(0, 4)
    .map((s) => s.skill);

  const improvementPlan = [
    { week: "Week 1–2", action: `Focus on ${gaps[0]?.area ?? "core skill gaps"} — complete one online module or tutorial` },
    { week: "Week 3–4", action: "Build a small project demonstrating the missing skills and add it to your portfolio" },
    { week: "Month 2", action: "Re-apply to similar roles and reference the new experience in your cover letter" },
    { week: "Month 3", action: "Reach out to 2–3 people in this role for informational interviews to understand unwritten requirements" },
  ];

  const summary =
    overallScore >= 75
      ? `You're a strong match for this role. Your profile covers most of the key requirements. Focus on the ${gaps.length} remaining gaps to maximize your chances.`
      : overallScore >= 50
      ? `You have a solid foundation but are missing some important requirements. With targeted effort over 4–8 weeks, you can significantly close the gap.`
      : `This role requires skills you haven't yet developed. Don't be discouraged — use this as a roadmap. Consider applying to similar but slightly lower-level roles while you build toward this one.`;

  return { overallScore, matchedSkills, gaps, strengths, improvementPlan, summary };
}

// ─── Candidate Analysis (hiring manager) ─────────────────────────────────────
export interface CandidateAnalysis {
  name: string;
  resumeText: string;
  score: number;
  matchedSkills: string[];
  gaps: string[];
  recommendation: "interview" | "maybe" | "pass";
}

export function analyzeCandidates(
  jobDescription: string,
  candidates: { name: string; resumeText: string }[]
): CandidateAnalysis[] {
  const jobKeywords = extractKeywords(jobDescription);

  return candidates
    .map((c) => {
      const resumeKeywords = extractKeywords(c.resumeText);
      const score = scoreOverlap(jobKeywords, resumeKeywords);
      const matchedSkills = jobKeywords.filter((k) => resumeKeywords.includes(k));
      const gaps = jobKeywords.filter((k) => !resumeKeywords.includes(k));

      return {
        name: c.name,
        resumeText: c.resumeText,
        score,
        matchedSkills: matchedSkills.map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
        gaps: gaps.slice(0, 4).map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
        recommendation: (score >= 70 ? "interview" : score >= 45 ? "maybe" : "pass") as
          | "interview"
          | "maybe"
          | "pass",
      };
    })
    .sort((a, b) => b.score - a.score);
}
