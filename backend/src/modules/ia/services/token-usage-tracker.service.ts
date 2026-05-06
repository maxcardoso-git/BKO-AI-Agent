import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LlmCall } from '../../execucao/entities/llm-call.entity';
import { TokenUsage } from '../../execucao/entities/token-usage.entity';

// Static cost table (per 1M tokens, USD) — updated 2026-03
const COST_PER_1M_TOKENS: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'text-embedding-3-small': { input: 0.02, output: 0 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 0.8, output: 4 },
};

@Injectable()
export class TokenUsageTrackerService {
  private readonly logger = new Logger(TokenUsageTrackerService.name);

  constructor(
    @InjectRepository(LlmCall)
    private readonly llmCallRepo: Repository<LlmCall>,
    @InjectRepository(TokenUsage)
    private readonly tokenUsageRepo: Repository<TokenUsage>,
  ) {}

  /**
   * Tracks token usage for an LLM call. Creates both LlmCall and TokenUsage records.
   * FK direction: llm_call.tokenUsageId points to token_usage.id.
   * Flow: create TokenUsage first, then create LlmCall with tokenUsageId set.
   */
  async track(params: {
    stepExecutionId: string;
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    error?: string | null;
  }): Promise<LlmCall> {
    const totalTokens = params.inputTokens + params.outputTokens;
    const costUsd = this.estimateCost(params.model, params.inputTokens, params.outputTokens);

    // 1. Create TokenUsage FIRST (llm_call.tokenUsageId references token_usage.id)
    const tokenUsage = await this.tokenUsageRepo.save(
      this.tokenUsageRepo.create({
        promptTokens: params.inputTokens,
        completionTokens: params.outputTokens,
        totalTokens,
        costUsd,
        model: params.model,
      }),
    );

    // 2. Create LlmCall with tokenUsageId set
    const llmCall = await this.llmCallRepo.save(
      this.llmCallRepo.create({
        model: params.model,
        provider: params.provider,
        promptTokens: params.inputTokens,
        completionTokens: params.outputTokens,
        totalTokens,
        costUsd,
        latencyMs: params.latencyMs,
        stepExecutionId: params.stepExecutionId,
        responseStatus: params.error ? 'error' : 'success',
        errorMessage: params.error ?? null,
        tokenUsageId: tokenUsage.id,
      }),
    );

    this.logger.debug(
      `Tracked: ${params.model} — ${totalTokens} tokens, $${costUsd?.toFixed(6) ?? '?'}, ${params.latencyMs}ms`,
    );

    return llmCall;
  }

  /**
   * Estimates cost in USD based on model and token counts.
   * Returns 0 if model is not in the cost table.
   */
  private estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const rates = COST_PER_1M_TOKENS[model];
    if (!rates) {
      this.logger.warn(`No cost data for model: ${model}`);
      return 0;
    }

    const inputCost = (inputTokens / 1_000_000) * rates.input;
    const outputCost = (outputTokens / 1_000_000) * rates.output;

    return Number((inputCost + outputCost).toFixed(6));
  }
}
