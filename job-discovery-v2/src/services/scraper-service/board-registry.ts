import type { BoardDefinition } from '../../shared/types/scraper';

export const BOARD_REGISTRY: Map<string, BoardDefinition> = new Map([
  [
    'indeed',
    {
      id: 'indeed',
      name: 'Indeed',
      baseUrls: ['indeed.com', 'indeed.co.uk', 'indeed.de'],
      selectors: {
        title: '[data-testid="jobTitle"]',
        company: '[data-testid="companyName"]',
        location: '[data-testid="jobLocation"]',
        salary: '[data-testid="salaryLineItem"]',
        jobDescription: '[id="jobDescriptionText"]',
        qualifications: '.js-job-details-section:nth-of-type(2)',
        responsibilities: '.js-job-details-section:nth-of-type(1)',
      },
      payloadType: 'html',
      isRequiresAuth: false,
      fallbackStrategies: ['semantic', 'heuristic'],
    },
  ],
  [
    'linkedin',
    {
      id: 'linkedin',
      name: 'LinkedIn',
      baseUrls: ['linkedin.com'],
      selectors: {
        title: '.top-card-layout__title',
        company: '.topcard__company-name',
        location: '.topcard__location',
        salary: '.description__salary',
        jobDescription: '.show-more-less-html__markup',
        qualifications: 'h2:contains("Requirements")',
        responsibilities: 'h2:contains("Responsibilities")',
      },
      payloadType: 'html',
      isRequiresAuth: true,
      fallbackStrategies: ['semantic', 'openai'],
    },
  ],
  [
    'ziprecruiter',
    {
      id: 'ziprecruiter',
      name: 'ZipRecruiter',
      baseUrls: ['ziprecruiter.com'],
      selectors: {
        title: '[data-id="job_title"]',
        company: '[data-id="job_company"]',
        location: '[data-id="job_location"]',
        salary: '[data-id="job_salary"]',
        jobDescription: '.job_description_short',
        qualifications: '.qualifications',
        responsibilities: '.job_description',
      },
      payloadType: 'html',
      isRequiresAuth: false,
      fallbackStrategies: ['semantic', 'heuristic'],
    },
  ],
  [
    'glassdoor',
    {
      id: 'glassdoor',
      name: 'Glassdoor',
      baseUrls: ['glassdoor.com', 'glassdoor.co.uk'],
      selectors: {
        title: '[data-test="job-title"]',
        company: '[data-test="employer-name"]',
        location: '[data-test="location"]',
        salary: '[data-test="salaryEstimate"]',
        jobDescription: '[data-test="job-description"]',
        qualifications: '[data-test="qualifications"]',
        responsibilities: '[data-test="responsibilities"]',
      },
      payloadType: 'html',
      isRequiresAuth: false,
      fallbackStrategies: ['semantic', 'heuristic'],
    },
  ],
  [
    'upwork',
    {
      id: 'upwork',
      name: 'Upwork',
      baseUrls: ['upwork.com'],
      selectors: {
        title: '[data-test="job-title"]',
        company: '[data-test="client-name"]',
        location: '[data-test="location"]',
        salary: '[data-test="budget"]',
        jobDescription: '[data-test="description"]',
        qualifications: '[data-test="skills-required"]',
        responsibilities: '[data-test="description"]',
      },
      payloadType: 'json',
      isRequiresAuth: false,
      fallbackStrategies: ['semantic'],
    },
  ],
]);

export function detectBoardFromUrl(url: string): string {
  const domain = new URL(url).hostname.toLowerCase();

  for (const [boardId, def] of BOARD_REGISTRY) {
    if (def.baseUrls.some(base => domain.includes(base))) {
      return boardId;
    }
  }

  return 'unknown';
}
