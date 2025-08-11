import OpenAI from "openai";
import { z } from "zod";
import { AITreeNode, DecomposeResponse, JudgementResponse, TreeNode, WorkflowState, WorkflowEvent, DecomposeMode } from "@/types";
import { 
  JUDGEMENT_SYSTEM_PROMPT,
  getDecomposerPrompt
} from "./prompts";
import { getProviderAndModelForAgent } from "./ai-config";

// AGENT-004: 定义输出格式 JSON Schema
const TreeNodeSchema: z.ZodType<AITreeNode> = z.object({
  id: z.string(),
  label: z.string().optional(),
  content: z.string(),
  children: z.array(z.lazy(() => TreeNodeSchema)).nullable(),
});

const DecomposeResponseSchema = z.object({
  root: TreeNodeSchema,
  reasoning: z.string().nullable(),
});

const JudgementResponseSchema = z.object({
  canDirectlyAnswer: z.boolean(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
});

// AGENT-001: 判断 Agent - 负责判断叶子节点是否可以直接回答
export class JudgementAgent {
  private client: OpenAI;
  private model: string;

  constructor() {
    // 为 'judgment' Agent 获取特定的提供商和模型配置
    const { providerConfig, modelConfig } = getProviderAndModelForAgent('judgment');
    
    this.client = new OpenAI({
      apiKey: providerConfig.apiKey,
      baseURL: providerConfig.baseURL,
    });
    this.model = modelConfig.id;
    
    console.log(`JudgementAgent initialized with:
      Provider: ${providerConfig.name}
      Base URL: ${providerConfig.baseURL}
      Model: ${this.model}`);
  }

  private getJudgementPrompt(nodeContent: string, originalTask: string = ""): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return [
      {
        role: "system",
        content: JUDGEMENT_SYSTEM_PROMPT
      },
      {
        role: "user",
        content: `原始输入：${originalTask}\n\n当前待判断项：${nodeContent}\n\n请判断“当前待判断项”是否需要进一步分解。`
      }
    ];
  }

  async judgeNode(nodeContent: string, originalTask: string = ""): Promise<JudgementResponse> {
    try {
      console.log(`开始判断节点: "${nodeContent}"`);
      
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: this.getJudgementPrompt(nodeContent, originalTask),
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content;
      console.log("判断 AI 原始返回:", content);
      
      if (!content) {
        throw new Error("AI 没有返回判断结果");
      }

      let parsedJson;
      try {
        parsedJson = JSON.parse(content);
        console.log("判断解析后的 JSON:", JSON.stringify(parsedJson, null, 2));
      } catch (jsonError) {
        console.error("判断 JSON 解析失败:", jsonError);
        throw jsonError;
      }

      const parsed = JudgementResponseSchema.parse(parsedJson);
      console.log(`判断结果: ${parsed.canDirectlyAnswer}, 置信度: ${parsed.confidence}`);
      return parsed;
      
    } catch (error) {
      console.error("判断节点失败:", error);
      throw error;
    }
  }
}

// AGENT-002: 分解 Agent - 专门负责任务分解
export class ProblemDecomposerAgent {
  private client: OpenAI;
  private model: string;

  constructor() {
    // 为 'decomposition' Agent 获取特定的提供商和模型配置
    const { providerConfig, modelConfig } = getProviderAndModelForAgent('decomposition');

    this.client = new OpenAI({
      apiKey: providerConfig.apiKey,
      baseURL: providerConfig.baseURL,
    });
    this.model = modelConfig.id;

    console.log(`ProblemDecomposerAgent initialized with:
      Provider: ${providerConfig.name}
      Base URL: ${providerConfig.baseURL}
      Model: ${this.model}`);
  }

  private getDecomposePrompt(text: string, originalTask: string, mode: DecomposeMode, isRootDecomposition: boolean = true): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const systemPrompt = getDecomposerPrompt(mode, isRootDecomposition);

    return [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: isRootDecomposition 
          ? `请分解以下内容：\n\n${text}`
          : `原始输入：${originalTask}\n\n当前待分解项：${text}\n\n请将"当前待分解项"进行进一步分解，确保分解结果与"原始输入"的整体结构保持一致。`
      }
    ];
  }

  async decomposeTask(text: string, originalTask: string, mode: DecomposeMode = 'concept', isRootDecomposition: boolean = true): Promise<DecomposeResponse> {
    console.log(`开始分解: "${text}", 原始输入: "${originalTask}", 模式: ${mode}, 是否为根分解: ${isRootDecomposition}`);
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: this.getDecomposePrompt(text, originalTask, mode, isRootDecomposition),
        response_format: { type: "json_object" },
        temperature: 0.6
      });

      const content = response.choices[0]?.message?.content;
      console.log("AI 原始返回内容:", content);
      
      if (!content) {
        throw new Error("AI 没有返回分解结果");
      }

      let parsedJson;
      try {
        parsedJson = JSON.parse(content);
        console.log("解析后的 JSON:", JSON.stringify(parsedJson, null, 2));
      } catch (jsonError) {
        console.error("JSON 解析失败:", jsonError);
        throw jsonError;
      }

      const parsed = DecomposeResponseSchema.parse(parsedJson);
      console.log("分解成功");
      return { ...parsed, mode }; // 添加模式到返回结果
      
    } catch (error) {
      console.error("分解失败:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

// AGENT-003: 工作流控制器 - 协调整个分解流程
export class WorkflowController {
  private decomposerAgent: ProblemDecomposerAgent;
  private judgementAgent: JudgementAgent;
  private shouldTerminate: boolean = false;

  constructor() {
    this.decomposerAgent = new ProblemDecomposerAgent();
    this.judgementAgent = new JudgementAgent();
  }

  // 终止当前分解过程
  terminateDecomposition(): void {
    console.log('收到终止分解请求');
    this.shouldTerminate = true;
  }

  // 重置终止标志
  private resetTerminationFlag(): void {
    this.shouldTerminate = false;
  }

  // 将 AI 节点转换为 TreeNode
  private convertToTreeNode(aiNode: AITreeNode, status: TreeNode['status'] = 'pending'): TreeNode {
    return {
      id: aiNode.id,
      content: aiNode.content || aiNode.label || '',
      children: aiNode.children ? aiNode.children.map(child => this.convertToTreeNode(child, status)) : null,
      expanded: false,
      status,
      isLeaf: !aiNode.children || aiNode.children.length === 0,
    };
  }

  // 确保节点ID唯一性的方法
  private ensureUniqueIds(node: TreeNode, existingTree: TreeNode, baseId: string): TreeNode {
    const allExistingIds = this.getAllNodeIds(existingTree);
    console.log(`确保ID唯一性 - 基础ID: ${baseId}, 现有ID:`, Array.from(allExistingIds));
    
    const assignUniqueId = (node: TreeNode, prefix: string): TreeNode => {
      // 生成唯一ID
      let newId = prefix;
      let counter = 1;
      while (allExistingIds.has(newId)) {
        newId = `${prefix}-${counter}`;
        counter++;
      }
      allExistingIds.add(newId); // 添加到已存在ID集合中
      
      console.log(`节点 "${node.content}" 分配ID: ${node.id} → ${newId}`);
      
      return {
        ...node,
        id: newId,
        children: node.children ? node.children.map((child, index) => 
          assignUniqueId(child, `${newId}-${index + 1}`)
        ) : null
      };
    };
    
    return assignUniqueId(node, baseId);
  }

  // 获取树中所有节点的ID
  private getAllNodeIds(node: TreeNode): Set<string> {
    const ids = new Set<string>();
    
    const collectIds = (node: TreeNode) => {
      ids.add(node.id);
      if (node.children) {
        node.children.forEach(collectIds);
      }
    };
    
    collectIds(node);
    return ids;
  }

  // 获取所有叶子节点
  private getLeafNodes(node: TreeNode): TreeNode[] {
    if (!node.children || node.children.length === 0) {
      return [node];
    }
    
    const leafNodes: TreeNode[] = [];
    for (const child of node.children) {
      leafNodes.push(...this.getLeafNodes(child));
    }
    return leafNodes;
  }

  // 更新树中的节点
  private updateNodeInTree(tree: TreeNode, nodeId: string, updates: Partial<TreeNode>): TreeNode {
    if (tree.id === nodeId) {
      return { ...tree, ...updates };
    }
    
    if (tree.children) {
      return {
        ...tree,
        children: tree.children.map(child => this.updateNodeInTree(child, nodeId, updates))
      };
    }
    
    return tree;
  }

  // 替换树中的节点
  private replaceNodeInTree(tree: TreeNode, nodeId: string, newNode: TreeNode): TreeNode {
    if (tree.id === nodeId) {
      return newNode;
    }
    
    if (tree.children) {
      return {
        ...tree,
        children: tree.children.map(child => this.replaceNodeInTree(child, nodeId, newNode))
      };
    }
    
    return tree;
  }

  // 创建工作流状态
  private createWorkflowState(tree: TreeNode): WorkflowState {
    const allNodes = this.getAllNodes(tree);
    const pendingNodes = allNodes.filter(node => node.status === 'pending' || node.status === 'need_decomposition');
    const completedNodes = allNodes.filter(node => node.status === 'completed' || node.status === 'can_answer');
    
    return {
      currentTree: tree,
      pendingNodes,
      completedNodes,
      totalNodes: allNodes.length,
      processedNodes: completedNodes.length,
      isComplete: pendingNodes.length === 0
    };
  }

  // 获取所有节点
  private getAllNodes(node: TreeNode): TreeNode[] {
    const nodes = [node];
    if (node.children) {
      for (const child of node.children) {
        nodes.push(...this.getAllNodes(child));
      }
    }
    return nodes;
  }

  // 主要的工作流执行方法
  async* executeWorkflow(inputText: string, mode: DecomposeMode = 'concept'): AsyncGenerator<WorkflowEvent> {
    try {
      // 重置终止标志
      this.resetTerminationFlag();

      // 1. 开始工作流
      let currentTree: TreeNode = {
        id: 'root',
        content: inputText,
        children: null,
        expanded: false,
        status: 'pending',
        isLeaf: true,
      };

      yield {
        type: 'start',
        message: `开始分析任务（${mode === 'task' ? '任务模式' : '概念模式'}）...`,
        state: this.createWorkflowState(currentTree)
      };

      // 2. 初始分解
      yield {
        type: 'decompose_node',
        nodeId: 'root',
        message: '正在分解根任务...',
        state: this.createWorkflowState(currentTree)
      };

      // 检查是否需要终止
      if (this.shouldTerminate) {
        yield {
          type: 'terminated',
          finalTree: currentTree,
          message: '分解过程已终止',
          state: this.createWorkflowState(currentTree)
        };
        return;
      }

      const rootDecomposition = await this.decomposerAgent.decomposeTask(inputText, inputText, mode, true);
      let newRootTree = this.convertToTreeNode(rootDecomposition.root, 'pending');
      
      // 对于根节点，我们需要保持 'root' 作为主ID，但确保子节点ID唯一
      if (newRootTree.children) {
        newRootTree = {
          ...newRootTree,
          id: 'root', // 保持根节点ID
          children: newRootTree.children.map((child, index) => 
            this.ensureUniqueIds(child, currentTree, `root-${index + 1}`)
          )
        };
      }
      
      currentTree = newRootTree;
      currentTree.expanded = true;

      yield {
        type: 'update_tree',
        tree: currentTree,
        message: '根任务分解完成',
        state: this.createWorkflowState(currentTree)
      };

      // 3. 迭代处理叶子节点
      let iterationCount = 0;
      const maxIterations = 10; // 防止无限循环

      while (iterationCount < maxIterations) {
        // 检查是否需要终止
        if (this.shouldTerminate) {
          yield {
            type: 'terminated',
            finalTree: currentTree,
            message: '分解过程已终止，保留当前结果',
            state: this.createWorkflowState(currentTree)
          };
          return;
        }

        const leafNodes = this.getLeafNodes(currentTree);
        const pendingLeafNodes = leafNodes.filter(node => 
          node.status === 'pending' && node.isLeaf
        );

        if (pendingLeafNodes.length === 0) {
          break; // 所有节点都已处理完成
        }

        for (const leafNode of pendingLeafNodes) {
          // 在每个节点处理前检查终止标志
          if (this.shouldTerminate) {
            yield {
              type: 'terminated',
              finalTree: currentTree,
              message: '分解过程已终止，保留当前结果',
              state: this.createWorkflowState(currentTree)
            };
            return;
          }
          // 4. 判断节点是否可以直接回答
          yield {
            type: 'judge_node',
            nodeId: leafNode.id,
            result: false,
            message: `正在判断节点"${leafNode.content}"...`,
            state: this.createWorkflowState(currentTree)
          };

          const judgement = await this.judgementAgent.judgeNode(leafNode.content, inputText);
          
          if (judgement.canDirectlyAnswer) {
            // 标记为可以直接回答
            currentTree = this.updateNodeInTree(currentTree, leafNode.id, {
              status: 'can_answer',
              canDirectlyAnswer: true
            });

            yield {
              type: 'judge_node',
              nodeId: leafNode.id,
              result: true,
              message: `节点"${leafNode.content}"可以直接回答`,
              state: this.createWorkflowState(currentTree)
            };
          } else {
            // 需要进一步分解
            yield {
              type: 'decompose_node',
              nodeId: leafNode.id,
              message: `正在分解节点"${leafNode.content}"...`,
              state: this.createWorkflowState(currentTree)
            };

            try {
              const nodeDecomposition = await this.decomposerAgent.decomposeTask(leafNode.content, inputText, mode, false);
              let newNode = this.convertToTreeNode(nodeDecomposition.root, 'pending');
              
              // 确保新节点的ID是唯一的
              newNode = this.ensureUniqueIds(newNode, currentTree, leafNode.id);
              newNode.expanded = true;
              
              currentTree = this.replaceNodeInTree(currentTree, leafNode.id, newNode);

              yield {
                type: 'update_tree',
                tree: currentTree,
                message: `节点"${leafNode.content}"分解完成`,
                state: this.createWorkflowState(currentTree)
              };
            } catch {
              // 分解失败，标记为完成
              currentTree = this.updateNodeInTree(currentTree, leafNode.id, {
                status: 'can_answer',
                canDirectlyAnswer: true
              });

              yield {
                type: 'judge_node',
                nodeId: leafNode.id,
                result: true,
                message: `节点"${leafNode.content}"分解失败，标记为可直接回答`,
                state: this.createWorkflowState(currentTree)
              };
            }
          }

          // 更新进度
          const state = this.createWorkflowState(currentTree);
          const progress = Math.round((state.processedNodes / state.totalNodes) * 100);
          
          yield {
            type: 'progress',
            progress,
            message: `处理进度: ${state.processedNodes}/${state.totalNodes}`,
            state
          };
        }

        iterationCount++;
      }

      // 5. 完成工作流
      const finalState = this.createWorkflowState(currentTree);
      yield {
        type: 'complete',
        finalTree: currentTree,
        message: '任务分解完成！',
        state: finalState
      };

    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : '工作流执行过程中发生错误'
      };
    }
  }
}

// 导出单例实例
export const judgementAgent = new JudgementAgent();
export const problemDecomposerAgent = new ProblemDecomposerAgent();
export const workflowController = new WorkflowController(); 