import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { TreeNode, FlowNode, FlowEdge, LayoutConfig } from '@/types'
import * as htmlToImage from 'html-to-image'

// 在导出时，为 React Flow 的边路径注入必要的样式，避免外链 CSS 丢失导致边不可见
const REACT_FLOW_EXPORT_EMBED_CSS = `
  .react-flow__edge-path, .react-flow__connection-path {
    fill: none !important;
    stroke: #94a3b8 !important; /* slate-400 */
    stroke-width: 1.5 !important;
    stroke-linecap: round !important;
    stroke-linejoin: round !important;
  }
  .react-flow__edge-text {
    font: 12px sans-serif;
    fill: #334155; /* slate-700 */
    paint-order: stroke;
    stroke: #ffffff;
    stroke-width: 3px;
    stroke-linecap: butt;
    stroke-linejoin: miter;
  }
`;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 计算 React Flow 内容（节点）在“世界坐标系”下的包围盒
// 仅依赖节点的 translate(x, y) 与尺寸，避免受 viewport 的 pan/zoom 影响
function computeFlowContentBounds(rootElement: HTMLElement, padding: number = 32): {
  minX: number; minY: number; width: number; height: number;
  paddedMinX: number; paddedMinY: number; paddedWidth: number; paddedHeight: number;
} {
  const viewport = (rootElement.querySelector('.react-flow__viewport') as HTMLElement) || rootElement
  const nodeList = Array.from(viewport.querySelectorAll<HTMLElement>('.react-flow__node'))

  if (nodeList.length === 0) {
    const rect = rootElement.getBoundingClientRect()
    const width = Math.max(rootElement.scrollWidth, rect.width)
    const height = Math.max(rootElement.scrollHeight, rect.height)
    return {
      minX: 0,
      minY: 0,
      width,
      height,
      paddedMinX: -padding,
      paddedMinY: -padding,
      paddedWidth: width + padding * 2,
      paddedHeight: height + padding * 2,
    }
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  const parseTranslate = (transformValue: string): { x: number; y: number } => {
    if (!transformValue || transformValue === 'none') return { x: 0, y: 0 }
    // 解析 translate(xpx, ypx) 或包含其它 transform 的情形
    const match = transformValue.match(/translate\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*\)/)
    if (match) {
      return { x: parseFloat(match[1]), y: parseFloat(match[2]) }
    }
    // 兜底处理 matrix(a, b, c, d, e, f) → e, f 为平移
    const matrix = transformValue.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*([-\d.]+)\s*,\s*([-\d.]+)\)/)
    if (matrix) {
      return { x: parseFloat(matrix[1]), y: parseFloat(matrix[2]) }
    }
    return { x: 0, y: 0 }
  }

  for (const nodeEl of nodeList) {
    const styleTransform = nodeEl.style.transform || window.getComputedStyle(nodeEl).transform
    const { x, y } = parseTranslate(styleTransform)
    const w = nodeEl.offsetWidth
    const h = nodeEl.offsetHeight
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w)
    maxY = Math.max(maxY, y + h)
  }

  const width = Math.max(0, maxX - minX)
  const height = Math.max(0, maxY - minY)

  return {
    minX,
    minY,
    width,
    height,
    paddedMinX: minX - padding,
    paddedMinY: minY - padding,
    paddedWidth: width + padding * 2,
    paddedHeight: height + padding * 2,
  }
}

// 确保导出的 SVG 拥有不透明背景色（避免查看器呈现透明棋盘）
function ensureSvgBackground(svgDataUrl: string, fillColor: string, widthHint?: number, heightHint?: number): string {
  try {
    const isBase64 = svgDataUrl.includes(';base64,')
    const prefix = isBase64 ? 'data:image/svg+xml;base64,' : 'data:image/svg+xml;charset=utf-8,'
    const payload = svgDataUrl.substring(svgDataUrl.indexOf(',') + 1)
    const svgText = isBase64 ? atob(payload) : decodeURIComponent(payload)

    // 在 <svg ...> 与其第一个子节点之间插入背景 rect
    const insertIndex = svgText.indexOf('>') + 1
    const hasBg = svgText.includes('data-rf-bg="true"') || svgText.includes('id="rf-bg"')
    const bgRect = `<rect id="rf-bg" data-rf-bg="true" width="100%" height="100%" fill="${fillColor}"/>`

    // 确保 svg 元素具备 width/height（如缺失则使用 hint）
    let finalSvg = svgText
    if (widthHint && !/\bwidth=/.test(finalSvg)) {
      finalSvg = finalSvg.replace('<svg', `<svg width="${widthHint}"`)
    }
    if (heightHint && !/\bheight=/.test(finalSvg)) {
      finalSvg = finalSvg.replace('<svg', `<svg height="${heightHint}"`)
    }

    if (!hasBg && insertIndex > 0) {
      finalSvg = finalSvg.slice(0, insertIndex) + bgRect + finalSvg.slice(insertIndex)
    }

    const encoded = isBase64 ? btoa(finalSvg) : encodeURIComponent(finalSvg)
    return prefix + encoded
  } catch {
    // 回退：保持原始数据
    return svgDataUrl
  }
}

// 默认布局配置
export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  columnWidth: 280,    // 列宽（含节点宽与左右留白）
  columnGap: 120,      // 列间距
  rowHeight: 120,      // 行高（由节点高度+垂直间距决定）
  rowGap: 24,          // 行间距
  maxColumnHeight: 2400, // 单列最大高度阈值
  sectionGap: 160,     // 段间距
  nodeGridCols: 3,      // 栅格列数（同级节点在列内的分列数）
  defaultExpandedLevels: 2 // 默认展开层级数（0-2层展开）
}

// —— 按层级的样式与间距 Token（最简） ——
export type LevelTextStyle = {
  fontSize: number
  fontWeight: 400 | 500 | 600
}

// 字号/字重：L0 最醒目，随层级递减
export function getLevelTextStyle(level: number): LevelTextStyle {
  const styles: LevelTextStyle[] = [
    { fontSize: 16, fontWeight: 600 },
    { fontSize: 14, fontWeight: 600 },
    { fontSize: 13, fontWeight: 500 },
    { fontSize: 12, fontWeight: 500 },
  ]
  const idx = Math.max(0, Math.min(level, styles.length - 1))
  return styles[idx]
}

// 垂直间距：仅按层级控制，不改水平缩进
// 该值用于树布局中叶子/折叠节点所占用的最小垂直空间
export function getLevelVerticalSpace(level: number): number {
  const spaces = [120, 96, 80, 64] // L0 → L3+
  const idx = Math.max(0, Math.min(level, spaces.length - 1))
  return spaces[idx]
}

// 估算节点渲染宽度（与 `CustomNode` 的 min/max 保持一致范围）
const MIN_NODE_WIDTH = 240
const MAX_NODE_WIDTH = 300
const HORIZONTAL_GAP = 60 // 子节点左边界到父节点右边界的固定距离

function estimateNodeWidth(content: string): number {
  // 极简启发式：按内容长度在最小与最大宽度之间线性插值
  // 这样不同父节点宽度会产生不同的右边界，从而打破同列对齐
  const k = 5 // 每个字符贡献的像素估计
  const est = MIN_NODE_WIDTH + Math.min((content?.length || 0) * k, MAX_NODE_WIDTH - MIN_NODE_WIDTH)
  return Math.max(MIN_NODE_WIDTH, Math.min(MAX_NODE_WIDTH, Math.round(est)))
}

// 为节点分配层级
export function assignLevels(rootId: string, nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const idToLevel = new Map<string, number>()
  const queue = [{ id: rootId, level: 0 }]
  idToLevel.set(rootId, 0)
  
  // 使用BFS遍历分配层级
  while (queue.length > 0) {
    const { id, level } = queue.shift()!
    const children = edges.filter(e => e.source === id).map(e => e.target)
    
    for (const childId of children) {
      if (!idToLevel.has(childId)) {
        idToLevel.set(childId, level + 1)
        queue.push({ id: childId, level: level + 1 })
      }
    }
  }
  
  // 更新节点数据中的层级信息
  return nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      level: idToLevel.get(node.id) ?? 0
    }
  }))
}

// 层级列式布局算法
export function computeLayeredGridLayout(
  nodes: FlowNode[], 
  edges: FlowEdge[], 
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
  collapsedNodeIds: Set<string> = new Set(),
  maxVisibleLevel: number = Infinity
): FlowNode[] {
  // 首先为节点分配层级
  const rootNode = nodes.find(node => !edges.some(edge => edge.target === node.id))
  if (!rootNode) return nodes
  
  const nodesWithLevels = assignLevels(rootNode.id, nodes, edges)
  
  // 按层级分组节点
  const nodesByLevel = new Map<number, FlowNode[]>()
  nodesWithLevels.forEach(node => {
    const level = node.data.level ?? 0
    if (level <= maxVisibleLevel) {
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, [])
      }
      nodesByLevel.get(level)!.push(node)
    }
  })
  
  // 过滤掉折叠节点的子节点
  const visibleNodes = nodesWithLevels.filter(node => {
    const level = node.data.level ?? 0
    if (level > maxVisibleLevel) return false
    
    // 检查父级链中是否有折叠的节点
    const findParent = (nodeId: string): string | null => {
      const parentEdge = edges.find(edge => edge.target === nodeId)
      return parentEdge ? parentEdge.source : null
    }
    
    let currentNodeId = node.id
    let parentId = findParent(currentNodeId)
    
    while (parentId) {
      if (collapsedNodeIds.has(parentId)) {
        return false // 父级被折叠，此节点不可见
      }
      currentNodeId = parentId
      parentId = findParent(currentNodeId)
    }
    
    return true
  })
  
  // 重新按层级分组可见节点
  nodesByLevel.clear()
  visibleNodes.forEach(node => {
    const level = node.data.level ?? 0
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, [])
    }
    nodesByLevel.get(level)!.push(node)
  })
  
  const layoutedNodes: FlowNode[] = []
  const levelKeys = Array.from(nodesByLevel.keys()).sort((a, b) => a - b)
  
  // 为每个层级计算布局
  levelKeys.forEach(level => {
    const levelNodes = nodesByLevel.get(level)!
    const baseX = level * (config.columnWidth + config.columnGap)
    
    // 在列内使用栅格布局分布节点
    let currentY = 0
    let currentSection = 0
    
    levelNodes.forEach((node, index) => {
      // 计算栅格位置
      const gridRow = Math.floor(index / config.nodeGridCols)
      const gridCol = index % config.nodeGridCols
      
      // 计算实际位置
      const nodeY = gridRow * (config.rowHeight + config.rowGap)
      
      // 检查是否需要换段（超过最大列高度）
      if (nodeY > config.maxColumnHeight) {
        currentSection = Math.floor(nodeY / config.maxColumnHeight)
        currentY = nodeY % config.maxColumnHeight
      } else {
        currentY = nodeY
      }
      
      // 计算最终位置
      const finalX = baseX + (currentSection * config.sectionGap) + (gridCol * (config.columnWidth / config.nodeGridCols))
      const finalY = currentY
      
      layoutedNodes.push({
        ...node,
        position: { x: finalX, y: finalY }
      })
    })
  })
  
  return layoutedNodes
}

// 将树数据转换为 React Flow 的节点和边数据
export function treeToFlowData(
  treeData: TreeNode,
  startX: number = 0,
  startY: number = 0,
  nodeWidths: Record<string, number> = {}
): { nodes: FlowNode[], edges: FlowEdge[] } {
  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []

  // 第一遍：计算每个节点需要的子树高度
  const calculateSubtreeHeight = (node: TreeNode, level: number): number => {
    if (!node.children || node.children.length === 0 || node.expanded === false) {
      return getLevelVerticalSpace(level) // 叶子/折叠：按层级的最小垂直空间
    }

    // 递归计算所有子节点需要的总高度（子层级 +1）
    const childrenHeights = node.children.map(child => calculateSubtreeHeight(child, level + 1))
    const totalChildrenHeight = childrenHeights.reduce((sum, height) => sum + height, 0)

    // 内部节点至少占用与本层等价的最小空间
    return Math.max(getLevelVerticalSpace(level), totalChildrenHeight)
  }

  // 第二遍：递归分配位置
  function traverseTree(
    node: TreeNode,
    x: number,
    y: number,
    level: number = 0
  ) {
    // 创建 Flow 节点
    const flowNode: FlowNode = {
      id: node.id,
      type: 'custom',
      position: { x, y },
      data: {
        label: node.content,
        content: node.content,
        expanded: node.expanded !== false, // 默认展开
        treeNode: node
      }
    }

    nodes.push(flowNode)

    // 如果节点展开且有子节点，处理子节点
    if (flowNode.data.expanded && node.children && node.children.length > 0) {
      // 优先使用真实测量宽度，否则使用估算宽度
      const parentEstimatedWidth = nodeWidths[node.id] ?? estimateNodeWidth(node.content)
      // 计算每个子节点需要的高度
      const childrenHeights = node.children.map(child => calculateSubtreeHeight(child, level + 1))
      const totalChildrenHeight = childrenHeights.reduce((sum, height) => sum + height, 0)

      // 从当前节点位置开始，垂直居中分布子节点
      let currentChildY = y - totalChildrenHeight / 2

      node.children.forEach((child, index) => {
        // 子节点左边界 = 父节点右边界 + 固定间距
        // 父节点右边界 ≈ x + 估算宽度
        const childX = x + parentEstimatedWidth + HORIZONTAL_GAP
        const childHeight = childrenHeights[index]

        // 子节点在其分配空间内垂直居中
        const childY = currentChildY + childHeight / 2

        // 创建边
        const edge: FlowEdge = {
          id: `${node.id}-${child.id}`,
          source: node.id,
          target: child.id,
          type: 'step'
        }
        edges.push(edge)

        // 递归处理子节点
        traverseTree(child, childX, childY, level + 1)

        // 移动到下一个子节点的位置
        currentChildY += childHeight
      })
    }
  }

  // 计算根节点需要的总高度
  calculateSubtreeHeight(treeData, 0)

  // 开始遍历，根节点居中
  traverseTree(treeData, startX, startY)

  return { nodes, edges }
}

// 导出流程图为 SVG
export async function exportFlowToSVG(
  elementSelector: string = '.react-flow',
  filename: string = 'flow-diagram.svg'
): Promise<void> {
  try {
    const element = document.querySelector(elementSelector) as HTMLElement

    if (!element) {
      throw new Error('找不到流程图元素')
    }

    // 按内容包围盒导出
    const { paddedMinX, paddedMinY, paddedWidth, paddedHeight } = computeFlowContentBounds(element, 32)

    // 临时保存原始滚动位置
    const originalScrollTop = element.scrollTop
    const originalScrollLeft = element.scrollLeft
    
    // 重置滚动位置到顶部
    element.scrollTop = 0
    element.scrollLeft = 0

    // 以 viewport 作为导出目标，便于去除 pan/zoom 并平移到左上
    const exportTarget = (element.querySelector('.react-flow__viewport') as HTMLElement) || element

    // 在导出目标内临时注入样式，确保边可见
    const styleEl: HTMLStyleElement = document.createElement('style')
    styleEl.textContent = REACT_FLOW_EXPORT_EMBED_CSS
    exportTarget.appendChild(styleEl)
    let svgDataUrl = await htmlToImage.toSvg(exportTarget, {
      backgroundColor: '#f9fafb',
      width: paddedWidth,
      height: paddedHeight,
      style: {
        transform: `translate(${-paddedMinX}px, ${-paddedMinY}px) scale(1)`,
        transformOrigin: 'top left',
        overflow: 'visible'
      },
      filter: (node: HTMLElement) => {
        // 忽略 react-flow 的控件
        if (
          node.classList?.contains('react-flow__controls') ||
          node.classList?.contains('react-flow__minimap') ||
          node.classList?.contains('react-flow__attribution')
        ) {
          return false
        }
        return true
      },
    })
    // 补充：确保 SVG 拥有不透明背景
    svgDataUrl = ensureSvgBackground(svgDataUrl, '#f9fafb', paddedWidth, paddedHeight)

    // 清理样式注入
    styleEl.remove()

    // 恢复原始滚动位置
    element.scrollTop = originalScrollTop
    element.scrollLeft = originalScrollLeft

    // 创建下载链接
    const link = document.createElement('a')
    link.download = filename
    link.href = svgDataUrl
    link.click()
  } catch (error: unknown) {
    console.error('SVG导出失败：', error)
    throw new Error('SVG导出失败，请重试')
  }
}

// SVG 转 PNG 的辅助函数（支持分辨率倍率）
async function svgToPng(
  svgDataUrl: string,
  width: number,
  height: number,
  scale: number = Math.max(4, (typeof window !== 'undefined' ? window.devicePixelRatio * 2 : 4) || 4),
  quality: number = 1
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('无法创建Canvas上下文'))
        return
      }

      // 设置高分辨率 Canvas 尺寸
      const finalScale = Number.isFinite(scale) && scale > 0 ? Math.min(scale, 8) : 4
      canvas.width = Math.round(width * finalScale)
      canvas.height = Math.round(height * finalScale)
      // 提升文本与线条清晰度
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      // 将坐标系按倍率缩放，便于以原始尺寸绘制
      ctx.scale(finalScale, finalScale)
      
      // 设置白色背景
      ctx.fillStyle = '#f9fafb'
      ctx.fillRect(0, 0, width, height)
      
      // 绘制SVG图像
      ctx.drawImage(img, 0, 0, width, height)
      
      // 转换为PNG格式
      const pngDataUrl = canvas.toDataURL('image/png', quality)
      resolve(pngDataUrl)
    }
    
    img.onerror = () => {
      reject(new Error('SVG图像加载失败'))
    }
    
    img.src = svgDataUrl
  })
}

// 通过 SVG 导出流程图为 PNG 图片（解决大尺寸限制问题）
export async function exportFlowToPNGViaSVG(
  elementSelector: string = '.react-flow',
  filename: string = 'flow-diagram.png',
  scale: number = Math.max(4, (typeof window !== 'undefined' ? window.devicePixelRatio * 2 : 4) || 4)
): Promise<void> {
  try {
    const element = document.querySelector(elementSelector) as HTMLElement

    if (!element) {
      throw new Error('找不到流程图元素')
    }

    // 计算内容包围盒
    const { paddedMinX, paddedMinY, paddedWidth, paddedHeight } = computeFlowContentBounds(element, 32)

    // 临时保存原始滚动位置
    const originalScrollTop = element.scrollTop
    const originalScrollLeft = element.scrollLeft
    
    // 重置滚动位置到顶部
    element.scrollTop = 0
    element.scrollLeft = 0

    // 以 viewport 作为导出目标
    const exportTarget = (element.querySelector('.react-flow__viewport') as HTMLElement) || element

    // 先导出为 SVG（临时注入样式，确保边可见）
    const styleEl2: HTMLStyleElement = document.createElement('style')
    styleEl2.textContent = REACT_FLOW_EXPORT_EMBED_CSS
    exportTarget.appendChild(styleEl2)
    let svgDataUrl = await htmlToImage.toSvg(exportTarget, {
      backgroundColor: '#f9fafb',
      width: paddedWidth,
      height: paddedHeight,
      style: {
        transform: `translate(${-paddedMinX}px, ${-paddedMinY}px) scale(1)`,
        transformOrigin: 'top left',
        overflow: 'visible'
      },
      filter: (node: HTMLElement) => {
        // 忽略 react-flow 的控件
        if (
          node.classList?.contains('react-flow__controls') ||
          node.classList?.contains('react-flow__minimap') ||
          node.classList?.contains('react-flow__attribution')
        ) {
          return false
        }
        return true
      },
    })
    // 确保 SVG 背景
    svgDataUrl = ensureSvgBackground(svgDataUrl, '#f9fafb', paddedWidth, paddedHeight)

    styleEl2.remove()

    // 将 SVG 转换为高分辨率 PNG
    const pngDataUrl = await svgToPng(svgDataUrl, paddedWidth, paddedHeight, scale)

    // 恢复原始滚动位置
    element.scrollTop = originalScrollTop
    element.scrollLeft = originalScrollLeft

    // 创建下载链接
    const link = document.createElement('a')
    link.download = filename
    link.href = pngDataUrl
    link.click()
  } catch (error: unknown) {
    console.error('通过SVG导出PNG失败：', error)
    throw new Error('导出失败，请重试')
  }
}

// PNG 导出（通过 SVG 转换）
export async function exportFlowToPNG(
  elementSelector: string = '.react-flow',
  filename: string = 'flow-diagram.png',
  scale: number = Math.max(4, (typeof window !== 'undefined' ? window.devicePixelRatio * 2 : 4) || 4)
): Promise<void> {
  // 使用 SVG 转换为 PNG 的方案
  await exportFlowToPNGViaSVG(elementSelector, filename, scale)
}

 