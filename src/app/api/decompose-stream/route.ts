import { NextResponse } from 'next/server';
import { workflowController } from '@/lib/ai-agent';
import { DecomposeMode } from '@/types';

interface DecomposeRequest {
  text: string;
  mode?: DecomposeMode; // 新增：分解模式参数
}

export async function POST(request: Request) {
  try {
    const body: DecomposeRequest = await request.json();
    const { text, mode = 'concept' } = body; // 默认为概念模式

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // 创建可读流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let isStreamClosed = false;
        let isClosing = false;
        
        const safeClose = () => {
          if (!isStreamClosed && !isClosing) {
            isClosing = true;
            try {
              controller.close();
              isStreamClosed = true;
            } catch (error) {
              // 忽略控制器已关闭的错误
              isStreamClosed = true;
              if (error instanceof Error && !error.message.includes('Controller is already closed')) {
                console.error('关闭流控制器时出错:', error);
              }
            }
          }
        };

        const safeEnqueue = (data: Uint8Array) => {
          if (!isStreamClosed && !isClosing) {
            try {
              controller.enqueue(data);
            } catch (error) {
              // 如果控制器已经关闭，标记状态并忽略错误
              if (error instanceof Error && error.message.includes('Controller is already closed')) {
                isStreamClosed = true;
                isClosing = true;
              } else {
                throw error;
              }
            }
          }
        };

        try {
          console.log(`开始流式工作流: "${text}", 模式: ${mode}`);

          // 执行工作流并流式返回事件，传递分解模式
          for await (const event of workflowController.executeWorkflow(text, mode)) {
            // 如果流已关闭或正在关闭，停止处理
            if (isStreamClosed || isClosing) {
              break;
            }

            // 根据不同的事件类型发送不同的数据格式
            let streamData;
            
            switch (event.type) {
              case 'start':
                streamData = {
                  type: 'start',
                  message: event.message,
                  progress: 0,
                  mode: mode // 返回当前分解模式
                };
                break;
                
              case 'decompose_node':
                streamData = {
                  type: 'progress',
                  message: event.message,
                  progress: Math.round((event.state.processedNodes / event.state.totalNodes) * 100)
                };
                break;
                
              case 'judge_node':
                streamData = {
                  type: 'progress',
                  message: event.message,
                  nodeId: event.nodeId,
                  judgementResult: event.result,
                  progress: Math.round((event.state.processedNodes / event.state.totalNodes) * 100)
                };
                break;
                
              case 'update_tree':
                streamData = {
                  type: 'update',
                  treeData: event.tree,
                  message: event.message,
                  progress: Math.round((event.state.processedNodes / event.state.totalNodes) * 100)
                };
                break;
                
              case 'progress':
                streamData = {
                  type: 'progress',
                  message: event.message,
                  progress: event.progress
                };
                break;
                
              case 'complete':
                streamData = {
                  type: 'complete',
                  treeData: event.finalTree,
                  message: event.message,
                  progress: 100,
                  state: event.state
                };
                break;

              case 'terminated':
                streamData = {
                  type: 'terminated',
                  treeData: event.finalTree,
                  message: event.message,
                  progress: Math.round((event.state.processedNodes / event.state.totalNodes) * 100),
                  state: event.state
                };
                break;
                
              case 'error':
                streamData = {
                  type: 'error',
                  error: event.error
                };
                break;
                
              default:
                continue; // 跳过未知事件类型
            }

            // 发送事件数据
            safeEnqueue(encoder.encode(`data: ${JSON.stringify(streamData)}\n\n`));

            // 如果是完成、终止或错误事件，结束流
            if (event.type === 'complete' || event.type === 'terminated' || event.type === 'error') {
              safeClose();
              return;
            }
          }

          // 如果循环正常结束但没有发送完成事件，关闭流
          safeClose();

        } catch (error) {
          console.error('流式工作流出错:', error);
          
          // 发送错误事件
          if (!isStreamClosed && !isClosing) {
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : '工作流执行过程中发生错误'
            })}\n\n`));
          }
          
          safeClose();
        }
      }
    });

    // 返回流式响应
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ 
      error: '处理请求时发生错误，请稍后重试' 
    }, { status: 500 });
  }
} 