/**
 * Proposals Agents Index
 */

export { generateProposalContent, generateBrandDescription, generateActivityDescription } from './content-writer.js';
export type { ProposalContent, GenerateProposalOptions } from './content-writer.js';

export { ClassicQuoteAgent } from './classic-quote.agent.js';
export { ExistingClientQuoteAgent } from './existing-client-quote.agent.js';
export { AnnualQuoteAgent } from './annual-quote.agent.js';
export { AutoBriefFormAgent } from './auto-brief.agent.js';
