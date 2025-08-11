import { NextResponse } from 'next/server';
import { workflowController } from '@/lib/ai-agent';
import { TreeNode, DecomposeMode } from '@/types';

// 定义预期的请求体结构
interface DecomposeRequest {
  text: string;
  mode?: DecomposeMode; // 新增：分解模式参数
  nodeId?: string; // 用于重新分解特定节点
  parentContext?: string; // 父级上下文
}

/**
 * 处理分解任务的 API 端点 - 使用新的工作流架构
 * @param request 包含待分解文本的请求
 */
export async function POST(request: Request) {
  try {
    const body: DecomposeRequest = await request.json();
    const { text, mode = 'concept', nodeId } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    console.log(`开始执行工作流: "${text}", 模式: ${mode}`, nodeId ? `节点ID: ${nodeId}` : '');

    // 执行完整的工作流，收集所有事件直到完成
    let finalResult: TreeNode | null = null;
    
    for await (const event of workflowController.executeWorkflow(text, mode)) {
      console.log(`工作流事件: ${event.type}`, event.type === 'error' ? event.error : event.message);
      
      if (event.type === 'complete') {
        finalResult = event.finalTree;
        break;
      } else if (event.type === 'error') {
        throw new Error(event.error);
      }
    }

    if (!finalResult) {
      throw new Error('工作流执行失败，未获得最终结果');
    }

    // 返回结构化数据
    return NextResponse.json({ root: finalResult, mode });

  } catch (error) {
    console.error('API Error:', error);
    
    // 提供更详细的错误信息
    if (error instanceof Error) {
      if (error.message.includes('MOONSHOT_API_KEY')) {
        return NextResponse.json({ 
          error: '缺少 Moonshot API 密钥配置' 
        }, { status: 500 });
      }
      
      if (error.message.includes('工作流执行')) {
        return NextResponse.json({ 
          error: 'AI 服务暂时不可用，请稍后重试' 
        }, { status: 503 });
      }
    }

    return NextResponse.json({ 
      error: '处理请求时发生错误，请稍后重试' 
    }, { status: 500 });
  }
} 