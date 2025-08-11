import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { IndentDecrease, IndentIncrease } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFlowStore } from '@/store/useFlowStore'
import { TreeNode } from '@/types'

interface CustomNodeData {
  label: string
  content: string
  expanded?: boolean
  treeNode: {
    id: string
    content: string
    children: TreeNode[] | null
    expanded?: boolean
    parentId?: string
  }
}

function CustomNode({ data, selected }: NodeProps<CustomNodeData>) {
  const { toggleNodeExpanded, setSelectedNode, nodes, edges } = useFlowStore()
  const hasChildren = data.treeNode.children && data.treeNode.children.length > 0
  const isRootNode = !edges.some(edge => edge.target === data.treeNode.id)

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasChildren && !isRootNode) {
      toggleNodeExpanded(data.treeNode.id)
    }
  }

  const handleNodeClick = () => {
    const currentNode = nodes.find(node => node.id === data.treeNode.id)
    setSelectedNode(currentNode || null)
  }

  return (
    <div
      className={cn(
        "relative bg-white border-2 rounded-lg min-w-[240px] max-w-[300px] cursor-pointer transition-all duration-200",
        selected 
          ? "border-blue-500 ring-2 ring-blue-200" 
          : "border-gray-200 hover:border-gray-300"
      )}
      onClick={handleNodeClick}
    >
      {/* 输入连接点：原初节点不显示左连接点 */}
      {!isRootNode && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-gray-400 border-2 border-white"
          style={{ left: -6 }}
        />
      )}

      {/* 节点内容 */}
      <div className="p-4">
        <div className="flex items-start gap-2">
          {/* 节点文本内容 */}
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm font-medium text-gray-900 leading-5"
            )}>
              {data.content}
            </p>
            
            {/* 子节点计数器 */}
            {hasChildren && (
              <span className="inline-block mt-2 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                {data.treeNode.children?.length} child nodes
              </span>
            )}
          </div>

          {/* 展开/折叠按钮（移至右侧，原初节点不可折叠）*/}
          {hasChildren && !isRootNode && (
            <button
              onClick={handleToggleExpand}
              className={cn(
                "flex-shrink-0 mt-0 p-1 rounded hover:bg-gray-100 transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-blue-500"
              )}
              aria-label={data.expanded ? "Collapse node" : "Expand node"}
            >
              {data.expanded ? (
                <IndentDecrease className="w-4 h-4 text-gray-600" />
              ) : (
                <IndentIncrease className="w-4 h-4 text-gray-600" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 输出连接点：原初节点不受折叠影响，始终可连接到子节点 */}
      {hasChildren && (data.expanded || isRootNode) && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-blue-400 border-2 border-white"
          style={{ right: -6 }}
        />
      )}

    </div>
  )
}

export default memo(CustomNode) 