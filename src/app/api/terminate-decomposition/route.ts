import { NextResponse } from 'next/server';
import { workflowController } from '@/lib/ai-agent';

export async function POST() {
  try {
    console.log('收到终止分解请求');
    
    // 调用工作流控制器的终止方法
    workflowController.terminateDecomposition();
    
    return NextResponse.json({ 
      success: true, 
      message: '分解过程终止请求已发送' 
    });
    
  } catch (error) {
    console.error('终止分解过程失败:', error);
    return NextResponse.json({ 
      error: '终止分解过程失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}