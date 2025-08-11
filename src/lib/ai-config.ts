// AI 配置中心 - 支持多个 AI 服务提供商和多 Agent 的统一管理

// 定义模型配置的接口
export interface ModelConfig {
  id: string; // 模型 ID
  // 未来可扩展其他参数，如 max_tokens, temperature 等
}

// 定义服务提供商的接口
export interface ProviderConfig {
  name: string;
  apiKey: string;
  baseURL: string;
}

// AI 提供商注册表 - 定义所有可用提供商的静态配置
const aiProvidersRegistry: { [key: string]: Omit<ProviderConfig, 'apiKey'> & { apiKeyEnvVar: string } } = {
  moonshot: {
    name: "moonshot",
    apiKeyEnvVar: "MOONSHOT_API_KEY",
    baseURL: "https://api.moonshot.cn/v1",
  },
  openrouter: {
    name: "openrouter",
    apiKeyEnvVar: "OPENROUTER_API_KEY",
    baseURL: "https://openrouter.ai/api/v1",
  },
  siliconflow: {
    name: "siliconflow",
    apiKeyEnvVar: "SILICONFLOW_API_KEY",
    baseURL: "https://api.siliconflow.cn/v1",
  },
};

// 存储已激活（即配置了 API Key）的提供商
const activeProviders: { [key: string]: ProviderConfig } = {};

// 初始化 activeProviders
// 遍历注册表，如果环境变量中设置了对应的 API Key，则将其添加到 activeProviders
for (const providerName in aiProvidersRegistry) {
  const providerSetup = aiProvidersRegistry[providerName];
  const apiKey = process.env[providerSetup.apiKeyEnvVar];
  if (apiKey) {
    activeProviders[providerName] = {
      name: providerSetup.name,
      baseURL: providerSetup.baseURL,
      apiKey,
    };
  }
}

// --- Agent 配置 ---
// 为不同的 Agent（任务角色）通过环境变量进行配置

type AgentName = 'decomposition' | 'judgment';

/**
 * 从环境变量中获取指定 Agent 的设置
 * @param agentName Agent 的名称
 * @returns 包含提供商和模型ID的对象
 * @throws 如果未设置必要的环境变量，则抛出错误
 */
const getAgentConfig = (agentName: AgentName): { provider: string; modelId: string } => {
  const upperAgentName = agentName.toUpperCase();
  
  const provider = process.env[`${upperAgentName}_PROVIDER`];
  const modelId = process.env[`${upperAgentName}_MODEL_ID`];

  if (!provider) {
    throw new Error(`请设置环境变量 ${upperAgentName}_PROVIDER 以指定 Agent "${agentName}" 的提供商`);
  }
  
  if (!modelId) {
    throw new Error(`请设置环境变量 ${upperAgentName}_MODEL_ID 以指定 Agent "${agentName}" 的模型ID`);
  }

  return { provider, modelId };
};

/**
 * 为指定的 Agent 获取提供商配置和模型信息
 * 
 * @param agentName Agent 的名称 ('decomposition' | 'judgment')
 * @returns 包含提供商配置和具体模型配置的对象
 * @throws 如果找不到提供商或未设置必要环境变量，则抛出错误
 */
export const getProviderAndModelForAgent = (agentName: AgentName): { providerConfig: ProviderConfig; modelConfig: ModelConfig } => {
  const { provider: providerName, modelId } = getAgentConfig(agentName);

  const providerConfig = activeProviders[providerName];
  if (!providerConfig) {
    const registryEntry = aiProvidersRegistry[providerName];
    if (registryEntry) {
      throw new Error(`Agent "${agentName}" 配置的提供商 "${providerName}" 未激活。请设置环境变量 ${registryEntry.apiKeyEnvVar}`);
    } else {
      throw new Error(`Agent "${agentName}" 配置的提供商 "${providerName}" 在 ai-config.ts 中未定义。`);
    }
  }

  const modelConfig: ModelConfig = { id: modelId };

  return { providerConfig, modelConfig };
};

/**
 * (可选) 获取所有已激活的提供商信息，可用于前端展示等场景
 * @returns 已激活提供商的信息数组
 */
export const getActiveProvidersInfo = () => {
  return Object.values(activeProviders).map(p => ({
    name: p.name,
    baseURL: p.baseURL,
  }));
}; 