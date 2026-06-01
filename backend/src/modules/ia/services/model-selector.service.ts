import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { LlmModelConfig } from '../../base-de-conhecimento/entities/llm-model-config.entity';
import type { LanguageModel, EmbeddingModel } from 'ai';

export interface ModelWithConfig {
  model: LanguageModel;
  config: LlmModelConfig;
}

@Injectable()
export class ModelSelectorService {
  private readonly logger = new Logger(ModelSelectorService.name);

  constructor(
    @InjectRepository(LlmModelConfig)
    private readonly configRepo: Repository<LlmModelConfig>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Loads the active LlmModelConfig (with resource joined) for the given
   * functionalityType and constructs a LanguageModel. Throws if no active
   * config exists.
   */
  async getModel(functionalityType: string): Promise<ModelWithConfig> {
    const config = await this.configRepo.findOne({
      where: { functionalityType, isActive: true },
      relations: ['resource'],
    });

    if (!config) {
      throw new Error(`No active LLM config for functionality type: ${functionalityType}`);
    }

    return {
      model: this.buildLanguageModel(config),
      config,
    };
  }

  /**
   * Gets the model config (with resource joined) without building the model.
   * Useful when you need config metadata (temperature, maxTokens) separately.
   */
  async getConfig(functionalityType: string): Promise<LlmModelConfig> {
    const config = await this.configRepo.findOne({
      where: { functionalityType, isActive: true },
      relations: ['resource'],
    });

    if (!config) {
      throw new Error(`No active LLM config for functionality type: ${functionalityType}`);
    }

    return config;
  }

  /**
   * Attempts to call the LLM with the primary model config; if it fails, retries with fallback.
   * The callFn receives a ModelWithConfig and should make the actual LLM call.
   */
  async callWithFallback<T>(
    functionalityType: string,
    callFn: (modelWithConfig: ModelWithConfig) => Promise<T>,
  ): Promise<T> {
    const primaryConfig = await this.getConfig(functionalityType);

    try {
      const modelWithConfig: ModelWithConfig = {
        model: this.buildLanguageModel(primaryConfig),
        config: primaryConfig,
      };
      return await callFn(modelWithConfig);
    } catch (primaryError) {
      this.logger.warn(
        `Primary model failed for ${functionalityType} (${primaryConfig.provider}/${primaryConfig.modelId}): ${primaryError}`,
      );

      if (!primaryConfig.fallbackConfigId) {
        throw primaryError;
      }

      // Load fallback config (with resource joined)
      const fallbackConfig = await this.configRepo.findOne({
        where: { id: primaryConfig.fallbackConfigId, isActive: true },
        relations: ['resource'],
      });

      if (!fallbackConfig) {
        this.logger.error(`Fallback config ${primaryConfig.fallbackConfigId} not found or inactive`);
        throw primaryError;
      }

      this.logger.log(
        `Falling back to ${fallbackConfig.provider}/${fallbackConfig.modelId} for ${functionalityType}`,
      );

      const fallbackModelWithConfig: ModelWithConfig = {
        model: this.buildLanguageModel(fallbackConfig),
        config: fallbackConfig,
      };
      return await callFn(fallbackModelWithConfig);
    }
  }

  /**
   * Resolves the API key for a given config in this priority order:
   *   1. resource.apiKeyValue (DB-stored, preferred)
   *   2. resource.bearerToken (DB-stored, alt for BEARER_TOKEN auth)
   *   3. apiKeyEnvVar resolved through ConfigService (legacy .env fallback)
   *
   * Returns undefined when nothing is configured — lets the SDK try its own
   * default env var (e.g., OPENAI_API_KEY). Logs the source so it's clear
   * during ops which key the system is actually using.
   */
  resolveApiKey(config: LlmModelConfig): string | undefined {
    if (config.resource?.apiKeyValue && config.resource.apiKeyValue.trim().length > 0) {
      return config.resource.apiKeyValue.trim();
    }
    if (config.resource?.bearerToken && config.resource.bearerToken.trim().length > 0) {
      return config.resource.bearerToken.trim();
    }
    if (config.apiKeyEnvVar) {
      const v = this.configService.get<string>(config.apiKeyEnvVar);
      if (v && v.trim().length > 0) return v.trim();
    }
    return undefined;
  }

  /**
   * Builds a LanguageModel instance from a config row, resolving the API key
   * via resolveApiKey() (DB-first, env fallback).
   */
  buildLanguageModel(config: LlmModelConfig): LanguageModel {
    const apiKey = this.resolveApiKey(config);

    if (config.provider === 'openai') {
      const openai = createOpenAI({ apiKey });
      return openai(config.modelId);
    }

    if (config.provider === 'anthropic') {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(config.modelId);
    }

    throw new Error(`Unknown LLM provider: ${config.provider}`);
  }

  /**
   * Returns the embedding model and the API key resolved for it. Uses the
   * 'embeddings' functionalityType config. Centralized here so VectorSearch
   * and DocumentIngestion don't have to read process.env directly.
   */
  async getEmbeddingModel(): Promise<EmbeddingModel> {
    const config = await this.getConfig('embeddings');
    const apiKey = this.resolveApiKey(config);
    const openai = createOpenAI({ apiKey });
    return openai.textEmbeddingModel(config.modelId);
  }

  /**
   * Public helper for callers that need the raw API key + provider config
   * (e.g., VectorSearch generating embeddings directly via the AI SDK).
   */
  async getEmbeddingProvider(): Promise<{ apiKey: string | undefined; modelId: string; provider: string }> {
    const config = await this.getConfig('embeddings');
    return {
      apiKey: this.resolveApiKey(config),
      modelId: config.modelId,
      provider: config.provider,
    };
  }
}
