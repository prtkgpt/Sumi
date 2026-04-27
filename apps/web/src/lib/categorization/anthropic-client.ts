import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/env';

const globalForAnthropic = globalThis as unknown as {
  __sumiAnthropic?: Anthropic;
};

export function getAnthropic(): Anthropic {
  if (globalForAnthropic.__sumiAnthropic) return globalForAnthropic.__sumiAnthropic;
  globalForAnthropic.__sumiAnthropic = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
  });
  return globalForAnthropic.__sumiAnthropic;
}
