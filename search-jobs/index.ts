// Code context for search-jobs/index.ts

const defaultLimit = 50;
const maxLimit = 100;

// Your existing logic here...

const limit = Math.min(Number(requestBody.limit || defaultLimit), maxLimit);