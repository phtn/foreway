import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { drawCourseShape, getFitViewport } from './drawing'
import type { CourseDrawingExport, CourseViewport } from './types'

export interface CourseMapProps {
  drawing: CourseDrawingExport
  height?: number | string
  className?: string
  style?: CSSProperties
  fitToBounds?: boolean
  showNodes?: boolean
  backgroundColor?: string
  showBoardGrid?: boolean
  boardGridColor?: string
  boardGridSize?: number
  viewport?: CourseViewport
}

const DEFAULT_HEIGHT = 500

const styles = {
  container: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden'
  },
  canvas: {
    display: 'block',
    width: '100%',
    height: '100%'
  }
} satisfies Record<string, CSSProperties>

export function CourseMap({
  drawing,
  height = DEFAULT_HEIGHT,
  className,
  style,
  fitToBounds = true,
  showNodes = false,
  backgroundColor = drawing.style.backgroundColor,
  showBoardGrid = drawing.style.showBoardGrid,
  boardGridColor = drawing.style.boardGridColor,
  boardGridSize = drawing.style.boardGridSize,
  viewport
}: CourseMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const resolvedViewport = useMemo(() => {
    if (viewport) {
      return viewport
    }

    if (fitToBounds) {
      return getFitViewport(drawing.points, drawing.details, canvasSize.width, canvasSize.height)
    }

    return drawing.viewport
  }, [canvasSize.height, canvasSize.width, drawing.details, drawing.points, drawing.viewport, fitToBounds, viewport])
  const containerStyle = useMemo<CSSProperties>(
    () => ({
      ...styles.container,
      height,
      backgroundColor,
      backgroundImage: showBoardGrid ? `radial-gradient(circle, ${boardGridColor} 1px, transparent 1px)` : undefined,
      backgroundSize: showBoardGrid ? `${boardGridSize}px ${boardGridSize}px` : undefined,
      ...style
    }),
    [backgroundColor, boardGridColor, boardGridSize, height, showBoardGrid, style]
  )

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current

    if (!container || !canvas) {
      return
    }

    const syncSize = () => {
      const width = container.clientWidth
      const nextHeight = container.clientHeight
      canvas.width = width
      canvas.height = nextHeight
      setCanvasSize({ width, height: nextHeight })
    }

    syncSize()

    const observer = new ResizeObserver(syncSize)
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')

    if (!canvas || !context || canvasSize.width === 0 || canvasSize.height === 0) {
      return
    }

    drawCourseShape(context, {
      points: drawing.points,
      details: drawing.details,
      tension: drawing.style.tension,
      width: canvasSize.width,
      height: canvasSize.height,
      viewport: resolvedViewport,
      backgroundColor: 'transparent',
      fillColor: drawing.style.fillColor,
      fillOpacity: drawing.style.fillOpacity,
      shapeFillStyle: drawing.style.shapeFillStyle ?? 'terrain',
      strokeColor: drawing.style.strokeColor,
      showNodes,
      isCourseSelected: false,
      activeDetailId: null,
      showEmptyHint: false
    })
  }, [canvasSize.height, canvasSize.width, drawing, resolvedViewport, showNodes])

  return (
    <div ref={containerRef} className={className} style={containerStyle}>
      <canvas ref={canvasRef} aria-label='Golf course map' role='img' style={styles.canvas} />
    </div>
  )
}
