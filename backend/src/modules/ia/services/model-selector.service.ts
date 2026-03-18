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
   * Loads the active LlmModelConfig for the given functionalityType and constructs a LanguageModel.
   * Throws if no active config exists.
   */
  async getModel(functionalityType: string): Promise<ModelWithConfig> {
    const config = await this.configRepo.findOne({
      where: { functionalityType, isActive: true },
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
   * Gets the model config without building the model instance.
   * Useful when you need config metadata (temperature, maxTokens) separately.
   */
  async getConfig(functionalityType: string): Promise<LlmModelConfig> {
    const config = await this.configRepo.findOne({
      where: { functionalityType, isActive: true },
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

      // Load fallback config
      const fallbackConfig = await this.configRepo.findOne({
        where: { id: primaryConfig.fallbackConfigId, isActive: true },
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
   * Builds a LanguageModel instance from a config row.
   */
  buildLanguageModel(config: LlmModelConfig): LanguageModel {
    const apiKey = config.apiKeyEnvVar
      ? this.configService.get<string>(config.apiKeyEnvVar)
      : undefined;

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
   * Returns the embedding model (always OpenAI text-embedding-3-small for now).
   * Uses the 'embeddings' functionalityType config for API key resolution.
   */
  async getEmbeddingModel(): Promise<EmbeddingModel<string>> {
    const config = await this.getConfig('embeddings');
    const apiKey = config.apiKeyEnvVar
      ? this.configService.get<string>(config.apiKeyEnvVar)
      : undefined;

    const openai = createOpenAI({ apiKey });
    return openai.textEmbeddingModel(config.modelId);
  }
}
