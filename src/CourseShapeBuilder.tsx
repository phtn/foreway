import type { CSSProperties } from 'react'
import {
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { drawCourseShape, findInsertionIndexAt, findPointAt, getFitViewport } from './drawing'
import { createCourseDrawingExport, createCourseDrawingJson } from './export'
import type {
  CourseBuilderLayer,
  CourseBuilderMode,
  CourseDetail,
  CourseDetailType,
  CoursePoint,
  CourseShapeBuilderProps,
  CourseShapeFillStyle
} from './types'

const MODES: CourseBuilderMode[] = ['place', 'move', 'erase']
const LAYERS: CourseBuilderLayer[] = ['course', 'sand', 'pond', 'arrow', 'hole']
const MODE_LABELS: Record<CourseBuilderMode, string> = {
  place: 'Place',
  move: 'Move',
  erase: 'Erase'
}
const LAYER_LABELS: Record<CourseBuilderLayer, string> = {
  course: 'Course',
  sand: 'Sand',
  pond: 'Pond',
  arrow: 'Arrow',
  hole: 'Hole'
}
const HINTS: Record<CourseBuilderMode, string> = {
  place: 'Click to add, drag a dot to move',
  move: 'Click to add, drag a dot to move',
  erase: 'Click a dot to remove it'
}
const TIPS: Record<CourseBuilderMode, string> = {
  place: 'Add or drag',
  move: 'Add or drag',
  erase: 'Click to delete'
}
const DEFAULT_HEIGHT = 720
const DEFAULT_TENSION = 0.5
const DEFAULT_POINT_RADIUS = 7
const DEFAULT_BACKDROP_OPACITY = 0.55
const DEFAULT_FILL_COLOR = '#5a9e4f'
const DEFAULT_FILL_OPACITY = 0.9
const DEFAULT_SHAPE_FILL_STYLE: CourseShapeFillStyle = 'terrain'
const DEFAULT_BOARD_GRID_COLOR = 'rgba(55, 77, 49, 0.22)'
const DEFAULT_BOARD_GRID_SIZE = 18
const MIN_VIEWPORT_SCALE = 0.2
const MAX_VIEWPORT_SCALE = 8
const WHEEL_ZOOM_INTENSITY = 0.0015
const PAN_START_THRESHOLD = 4

interface DragState {
  layer: CourseBuilderLayer
  detailId?: string
  index: number
  offsetX: number
  offsetY: number
}

interface PanState {
  pointerId: number
  startX: number
  startY: number
  startOffsetX: number
  startOffsetY: number
}

interface PendingPlacementState {
  pointerId: number
  layer: CourseBuilderLayer
  detailId?: string
  point: CoursePoint
  startX: number
  startY: number
  startOffsetX: number
  startOffsetY: number
}

function clonePoints(points: CoursePoint[]): CoursePoint[] {
  return points.map((point) => ({ x: point.x, y: point.y }))
}

function cloneDetails(details: CourseDetail[]): CourseDetail[] {
  return details.map((detail) => ({
    ...detail,
    style: detail.style ? { ...detail.style } : undefined,
    points: clonePoints(detail.points)
  }))
}

function getPointerPosition(
  event: ReactPointerEvent<HTMLCanvasElement> | ReactWheelEvent<HTMLCanvasElement>
): CoursePoint {
  const rect = event.currentTarget.getBoundingClientRect()

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
}

function screenToWorld(point: CoursePoint, scale: number, offsetX: number, offsetY: number): CoursePoint {
  return {
    x: (point.x - offsetX) / scale,
    y: (point.y - offsetY) / scale
  }
}

function createDetailId(type: CourseDetailType): string {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function getNextHoleLabel(details: CourseDetail[]): number {
  return details.filter((detail) => detail.type === 'hole').length + 1
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(' ')
}

function getColorInputValue(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_FILL_COLOR
}

function getDetailDefaultColor(type: CourseDetailType): string {
  if (type === 'pond') {
    return '#4fa7c8'
  }

  if (type === 'arrow') {
    return '#ffffff'
  }

  if (type === 'hole') {
    return '#ffffff'
  }

  return '#d9bf73'
}

function getDetailColorInputValue(color: string, type: CourseDetailType): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : getDetailDefaultColor(type)
}

const styles = {
  wrap: {
    fontFamily:
      "var(--font-sans, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)",
    display: 'flex',
    flexDirection: 'column',
    borderWidth: 0.5,
    borderStyle: 'solid',
    borderColor: 'var(--foreway-border, #c6d0bf)',
    borderRadius: 8,
    overflow: 'hidden',
    background: 'var(--foreway-surface, #f8faf7)',
    height: '100%'
  },
  workArea: {
    display: 'flex',
    flex: '1 1 auto',
    minHeight: 0,
    minWidth: 0
  },
  toolbar: {
    display: 'flex',
    flex: '0 0 264px',
    flexDirection: 'column',
    gap: 14,
    minHeight: 0,
    overflowY: 'auto',
    padding: 14,
    background: 'var(--foreway-toolbar, #f0f0f0c0)',
    borderRightWidth: 0.5,
    borderRightStyle: 'solid',
    borderRightColor: 'var(--foreway-border, #c6d0bf)'
  },
  toolbarHeader: {
    display: 'grid',
    gap: 4
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--foreway-text, #1f2a1d)',
    marginRight: 4
  },
  section: {
    display: 'grid',
    gap: 8
  },
  sectionTitle: {
    color: 'var(--foreway-text-muted, #6f7d69)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0,
    textTransform: 'uppercase'
  },
  buttonGrid: {
    display: 'grid',
    gap: 6,
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
  },
  sidebarButton: {
    justifyContent: 'center',
    width: '100%'
  },
  button: {
    alignItems: 'center',
    display: 'inline-flex',
    fontFamily: 'inherit',
    fontSize: 12,
    justifyContent: 'center',
    padding: '5px 12px',
    minHeight: 30,
    borderRadius: 6,
    borderWidth: 0.5,
    borderStyle: 'solid',
    borderColor: 'var(--foreway-border-strong, #9aa991)',
    background: '#fafafa',
    color: 'var(--foreway-text-secondary, #4f5f49)',
    cursor: 'pointer'
  },
  activeButton: {
    background: '#e8f4e8',
    borderColor: '#5a9e4f',
    color: '#27500a',
    fontWeight: 600
  },
  dangerButton: {
    borderColor: '#e79d9d',
    color: '#9f2929'
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    fontSize: 12,
    color: 'var(--foreway-text-secondary, #4f5f49)'
  },
  range: {
    width: 112
  },
  select: {
    minHeight: 30,
    width: 112,
    borderWidth: 0.5,
    borderStyle: 'solid',
    borderColor: 'var(--foreway-border-strong, #9aa991)',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--foreway-text-secondary, #4f5f49)',
    font: 'inherit',
    fontSize: 12,
    padding: '4px 8px'
  },
  colorInput: {
    width: 34,
    height: 30,
    padding: 2,
    borderWidth: 0.5,
    borderStyle: 'solid',
    borderColor: 'var(--foreway-border-strong, #9aa991)',
    borderRadius: 6,
    background: 'transparent',
    cursor: 'pointer'
  },
  fileInput: {
    display: 'none'
  },
  hint: {
    fontSize: 11,
    color: 'var(--foreway-text-muted, #6f7d69)',
    lineHeight: 1.35
  },
  canvasContainer: {
    position: 'relative',
    width: '100%',
    flex: '1 1 auto',
    minHeight: 0,
    background: '#c9e0c0'
  },
  canvas: {
    display: 'block',
    width: '100%',
    height: '100%',
    touchAction: 'none'
  },
  statusbar: {
    display: 'flex',
    borderTopWidth: 0.5,
    borderTopStyle: 'solid',
    borderTopColor: 'var(--foreway-border, #c6d0bf)',
    background: 'var(--foreway-toolbar, #f8faf7)'
  },
  status: {
    flex: 1,
    padding: '6px 12px',
    fontSize: 11,
    color: 'var(--foreway-text-muted, #6f7d69)',
    borderRightWidth: 0.5,
    borderRightStyle: 'solid',
    borderRightColor: 'var(--foreway-border, #c6d0bf)'
  },
  statusLast: {
    borderRightWidth: 0
  },
  statusValue: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--foreway-text, #1f2a1d)',
    display: 'block'
  },
  srOnly: {
    borderWidth: 0,
    clip: 'rect(0 0 0 0)',
    height: 1,
    margin: -1,
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    width: 1,
    whiteSpace: 'nowrap'
  }
} satisfies Record<string, CSSProperties>

export function CourseShapeBuilder({
  value,
  defaultValue = [],
  onChange,
  details: detailsValue,
  defaultDetails = [],
  onDetailsChange,
  mode,
  defaultMode = 'place',
  onModeChange,
  tension,
  defaultTension = DEFAULT_TENSION,
  onTensionChange,
  height = DEFAULT_HEIGHT,
  className,
  style,
  canvasLabel = 'Golf course outline builder',
  backgroundColor = 'transparent',
  fillColor,
  defaultFillColor = DEFAULT_FILL_COLOR,
  onFillColorChange,
  fillOpacity,
  defaultFillOpacity = DEFAULT_FILL_OPACITY,
  onFillOpacityChange,
  shapeFillStyle,
  defaultShapeFillStyle = DEFAULT_SHAPE_FILL_STYLE,
  onShapeFillStyleChange,
  strokeColor = '#18181b',
  pointRadius = DEFAULT_POINT_RADIUS,
  showNodes,
  defaultShowNodes = true,
  onShowNodesChange,
  showBoardGrid = true,
  boardGridColor = DEFAULT_BOARD_GRID_COLOR,
  boardGridSize = DEFAULT_BOARD_GRID_SIZE,
  backdropImageUrl,
  defaultBackdropImageUrl = null,
  onBackdropImageChange,
  backdropOpacity,
  defaultBackdropOpacity = DEFAULT_BACKDROP_OPACITY,
  onBackdropOpacityChange,
  backdropFit = 'contain',
  downloadFileName = 'foreway-course.json',
  disabled = false
}: CourseShapeBuilderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const panRef = useRef<PanState | null>(null)
  const pendingPlacementRef = useRef<PendingPlacementState | null>(null)
  const localBackdropUrlRef = useRef<string | null>(null)
  const [internalPoints, setInternalPoints] = useState<CoursePoint[]>(() => clonePoints(defaultValue))
  const [internalDetails, setInternalDetails] = useState<CourseDetail[]>(() => cloneDetails(defaultDetails))
  const [internalMode, setInternalMode] = useState<CourseBuilderMode>(defaultMode)
  const [activeLayer, setActiveLayer] = useState<CourseBuilderLayer>('course')
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null)
  const [internalTension, setInternalTension] = useState(defaultTension)
  const [internalFillColor, setInternalFillColor] = useState(defaultFillColor)
  const [internalFillOpacity, setInternalFillOpacity] = useState(defaultFillOpacity)
  const [internalShapeFillStyle, setInternalShapeFillStyle] = useState<CourseShapeFillStyle>(defaultShapeFillStyle)
  const [internalBackdropImageUrl, setInternalBackdropImageUrl] = useState<string | null>(defaultBackdropImageUrl)
  const [internalBackdropOpacity, setInternalBackdropOpacity] = useState(defaultBackdropOpacity)
  const [internalShowNodes, setInternalShowNodes] = useState(defaultShowNodes)
  const [backdropImage, setBackdropImage] = useState<HTMLImageElement | null>(null)
  const [viewport, setViewport] = useState({ scale: 1, offsetX: 0, offsetY: 0 })
  const [cursor, setCursor] = useState('crosshair')
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  const points = value ?? internalPoints
  const details = detailsValue ?? internalDetails
  const activeMode = mode ?? internalMode
  const activeTension = Math.max(0, Math.min(1, tension ?? internalTension))
  const activeFillColor = fillColor ?? internalFillColor
  const activeFillColorInputValue = getColorInputValue(activeFillColor)
  const activeFillOpacity = Math.max(0, Math.min(1, fillOpacity ?? internalFillOpacity))
  const activeShapeFillStyle = shapeFillStyle ?? internalShapeFillStyle
  const activeBackdropImageUrl = backdropImageUrl ?? internalBackdropImageUrl
  const activeBackdropOpacity = Math.max(0, Math.min(1, backdropOpacity ?? internalBackdropOpacity))
  const activeShowNodes = showNodes ?? internalShowNodes
  const hasBackdropImage = Boolean(activeBackdropImageUrl)
  const selectedDetail = useMemo(
    () =>
      activeLayer === 'course'
        ? null
        : (details.find((detail) => detail.id === activeDetailId && detail.type === activeLayer) ??
          details.find((detail) => detail.type === activeLayer) ??
          null),
    [activeDetailId, activeLayer, details]
  )
  const selectedDetailColorInputValue =
    activeLayer === 'course'
      ? DEFAULT_FILL_COLOR
      : getDetailColorInputValue(selectedDetail?.style?.color ?? getDetailDefaultColor(activeLayer), activeLayer)
  const containerStyle = useMemo<CSSProperties>(
    () => ({
      ...styles.canvasContainer,
      height,
      backgroundColor,
      backgroundImage: showBoardGrid ? `radial-gradient(circle, ${boardGridColor} 1px, transparent 1px)` : undefined,
      backgroundSize: showBoardGrid ? `${boardGridSize}px ${boardGridSize}px` : undefined
    }),
    [backgroundColor, boardGridColor, boardGridSize, height, showBoardGrid]
  )

  const setPoints = useCallback(
    (nextPoints: CoursePoint[]) => {
      const clonedPoints = clonePoints(nextPoints)

      if (value === undefined) {
        setInternalPoints(clonedPoints)
      }

      onChange?.(clonedPoints)
    },
    [onChange, value]
  )

  const setDetails = useCallback(
    (nextDetails: CourseDetail[]) => {
      const clonedDetails = cloneDetails(nextDetails)

      if (detailsValue === undefined) {
        setInternalDetails(clonedDetails)
      }

      onDetailsChange?.(clonedDetails)
    },
    [detailsValue, onDetailsChange]
  )

  const setMode = useCallback(
    (nextMode: CourseBuilderMode) => {
      dragRef.current = null

      if (mode === undefined) {
        setInternalMode(nextMode)
      }

      setCursor(nextMode === 'erase' ? 'default' : 'crosshair')
      onModeChange?.(nextMode)
    },
    [mode, onModeChange]
  )

  const setTensionValue = useCallback(
    (nextTension: number) => {
      const clampedTension = Math.max(0, Math.min(1, nextTension))

      if (tension === undefined) {
        setInternalTension(clampedTension)
      }

      onTensionChange?.(clampedTension)
    },
    [onTensionChange, tension]
  )

  const setShowNodesValue = useCallback(
    (nextShowNodes: boolean) => {
      if (showNodes === undefined) {
        setInternalShowNodes(nextShowNodes)
      }

      onShowNodesChange?.(nextShowNodes)
    },
    [onShowNodesChange, showNodes]
  )

  const setFillColorValue = useCallback(
    (nextColor: string) => {
      if (fillColor === undefined) {
        setInternalFillColor(nextColor)
      }

      onFillColorChange?.(nextColor)
    },
    [fillColor, onFillColorChange]
  )

  const setFillOpacityValue = useCallback(
    (nextOpacity: number) => {
      const clampedOpacity = Math.max(0, Math.min(1, nextOpacity))

      if (fillOpacity === undefined) {
        setInternalFillOpacity(clampedOpacity)
      }

      onFillOpacityChange?.(clampedOpacity)
    },
    [fillOpacity, onFillOpacityChange]
  )

  const setSelectedDetailColorValue = useCallback(
    (nextColor: string) => {
      if (activeLayer === 'course' || !selectedDetail) {
        return
      }

      setActiveDetailId(selectedDetail.id)
      setDetails(
        details.map((detail) =>
          detail.id === selectedDetail.id
            ? {
                ...detail,
                style: {
                  ...detail.style,
                  color: nextColor
                }
              }
            : detail
        )
      )
    },
    [activeLayer, details, selectedDetail, setDetails]
  )

  const setShapeFillStyleValue = useCallback(
    (nextShapeFillStyle: CourseShapeFillStyle) => {
      if (shapeFillStyle === undefined) {
        setInternalShapeFillStyle(nextShapeFillStyle)
      }

      onShapeFillStyleChange?.(nextShapeFillStyle)
    },
    [onShapeFillStyleChange, shapeFillStyle]
  )

  const setBackdropOpacityValue = useCallback(
    (nextOpacity: number) => {
      const clampedOpacity = Math.max(0, Math.min(1, nextOpacity))

      if (backdropOpacity === undefined) {
        setInternalBackdropOpacity(clampedOpacity)
      }

      onBackdropOpacityChange?.(clampedOpacity)
    },
    [backdropOpacity, onBackdropOpacityChange]
  )

  const setBackdropImageUrl = useCallback(
    (nextImageUrl: string | null, file: File | null) => {
      if (backdropImageUrl === undefined) {
        setInternalBackdropImageUrl(nextImageUrl)
      }

      onBackdropImageChange?.(nextImageUrl, file)
    },
    [backdropImageUrl, onBackdropImageChange]
  )

  const revokeLocalBackdropUrl = useCallback(() => {
    if (localBackdropUrlRef.current) {
      URL.revokeObjectURL(localBackdropUrlRef.current)
      localBackdropUrlRef.current = null
    }
  }, [])

  const uploadBackdropImage = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null

      if (!file) {
        return
      }

      revokeLocalBackdropUrl()
      const imageUrl = URL.createObjectURL(file)
      localBackdropUrlRef.current = imageUrl
      setBackdropImageUrl(imageUrl, file)
      event.currentTarget.value = ''
    },
    [revokeLocalBackdropUrl, setBackdropImageUrl]
  )

  const clearBackdropImage = useCallback(() => {
    revokeLocalBackdropUrl()
    setBackdropImage(null)
    setBackdropImageUrl(null, null)
  }, [revokeLocalBackdropUrl, setBackdropImageUrl])

  const undo = useCallback(() => {
    if (points.length === 0) {
      return
    }

    setPoints(points.slice(0, -1))
  }, [points, setPoints])

  const clearAll = useCallback(() => {
    if (points.length === 0) {
      return
    }

    setPoints([])
  }, [points, setPoints])

  const clearDetails = useCallback(() => {
    if (details.length === 0) {
      return
    }

    setDetails([])
    setActiveDetailId(null)
  }, [details.length, setDetails])

  const startNewDetail = useCallback(() => {
    if (activeLayer === 'course' || activeLayer === 'hole') {
      return
    }

    const nextDetail: CourseDetail = {
      id: createDetailId(activeLayer),
      type: activeLayer,
      points: []
    }

    setDetails([...details, nextDetail])
    setActiveDetailId(nextDetail.id)
  }, [activeLayer, details, setDetails])

  const fitShape = useCallback(() => {
    setViewport(getFitViewport(points, details, canvasSize.width, canvasSize.height))
  }, [canvasSize.height, canvasSize.width, details, points])

  const resetZoom = useCallback(() => {
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 })
  }, [])

  const downloadDrawingJson = useCallback(() => {
    const exportData = createCourseDrawingExport({
      points,
      details,
      tension: activeTension,
      fillColor: activeFillColor,
      fillOpacity: activeFillOpacity,
      shapeFillStyle: activeShapeFillStyle,
      strokeColor,
      showNodes: activeShowNodes,
      backgroundColor,
      showBoardGrid,
      boardGridColor,
      boardGridSize,
      backdropImageUrl: activeBackdropImageUrl,
      backdropOpacity: activeBackdropOpacity,
      backdropFit,
      viewport
    })
    const json = createCourseDrawingJson(exportData)
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = downloadFileName
    link.click()
    URL.revokeObjectURL(url)
  }, [
    activeBackdropImageUrl,
    activeBackdropOpacity,
    activeFillColor,
    activeFillOpacity,
    activeShapeFillStyle,
    activeShowNodes,
    activeTension,
    backdropFit,
    backgroundColor,
    boardGridColor,
    boardGridSize,
    details,
    downloadFileName,
    points,
    showBoardGrid,
    strokeColor,
    viewport
  ])

  const commitPendingPlacement = useCallback(
    (placement: PendingPlacementState) => {
      if (placement.layer === 'course') {
        const insertionIndex = findInsertionIndexAt(points, placement.point)
        setPoints([...points.slice(0, insertionIndex), placement.point, ...points.slice(insertionIndex)])
        return
      }

      const activeDetail =
        details.find((detail) => detail.id === placement.detailId && detail.type === placement.layer) ??
        details.find((detail) => detail.type === placement.layer) ??
        null

      if (!activeDetail) {
        const nextDetail: CourseDetail = {
          id: createDetailId(placement.layer),
          type: placement.layer,
          points: [placement.point],
          ...(placement.layer === 'hole' ? { label: getNextHoleLabel(details) } : null)
        }
        setDetails([...details, nextDetail])
        setActiveDetailId(nextDetail.id)
        return
      }

      if (placement.layer === 'hole') {
        const nextDetail: CourseDetail = {
          id: createDetailId('hole'),
          type: 'hole',
          label: getNextHoleLabel(details),
          points: [placement.point]
        }
        setDetails([...details, nextDetail])
        setActiveDetailId(nextDetail.id)
        return
      }

      if (placement.layer === 'arrow') {
        setDetails(
          details.map((detail) =>
            detail.id === activeDetail.id
              ? {
                  ...detail,
                  points: [...detail.points, placement.point]
                }
              : detail
          )
        )
        return
      }

      const insertionIndex = findInsertionIndexAt(activeDetail.points, placement.point)
      setDetails(
        details.map((detail) =>
          detail.id === activeDetail.id
            ? {
                ...detail,
                points: [
                  ...detail.points.slice(0, insertionIndex),
                  placement.point,
                  ...detail.points.slice(insertionIndex)
                ]
              }
            : detail
        )
      )
    },
    [details, points, setDetails, setPoints]
  )

  const zoomAt = useCallback((screenPosition: CoursePoint, deltaY: number) => {
    setViewport((currentViewport) => {
      const nextScale = Math.max(
        MIN_VIEWPORT_SCALE,
        Math.min(MAX_VIEWPORT_SCALE, currentViewport.scale * Math.exp(-deltaY * WHEEL_ZOOM_INTENSITY))
      )

      if (nextScale === currentViewport.scale) {
        return currentViewport
      }

      const worldPosition = screenToWorld(
        screenPosition,
        currentViewport.scale,
        currentViewport.offsetX,
        currentViewport.offsetY
      )

      return {
        scale: nextScale,
        offsetX: screenPosition.x - worldPosition.x * nextScale,
        offsetY: screenPosition.y - worldPosition.y * nextScale
      }
    })
  }, [])

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

  useEffect(() => revokeLocalBackdropUrl, [revokeLocalBackdropUrl])

  useEffect(() => {
    if (!dragRef.current) {
      setCursor(activeMode === 'erase' ? 'default' : 'crosshair')
    }
  }, [activeMode])

  useEffect(() => {
    if (!activeBackdropImageUrl) {
      setBackdropImage(null)
      return
    }

    let isCurrent = true
    const image = new Image()

    setBackdropImage(null)
    image.onload = () => {
      if (isCurrent) {
        setBackdropImage(image)
      }
    }
    image.onerror = () => {
      if (isCurrent) {
        setBackdropImage(null)
      }
    }
    image.src = activeBackdropImageUrl

    return () => {
      isCurrent = false
    }
  }, [activeBackdropImageUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')

    if (!canvas || !context || canvasSize.width === 0 || canvasSize.height === 0) {
      return
    }

    drawCourseShape(context, {
      points,
      tension: activeTension,
      width: canvasSize.width,
      height: canvasSize.height,
      backgroundColor: 'transparent',
      fillColor: activeFillColor,
      fillOpacity: activeFillOpacity,
      shapeFillStyle: activeShapeFillStyle,
      strokeColor,
      pointRadius,
      showNodes: activeShowNodes,
      isCourseSelected: activeLayer === 'course',
      backdropImage,
      backdropOpacity: activeBackdropOpacity,
      backdropFit,
      details,
      activeDetailId,
      viewport,
      showEmptyHint: activeMode === 'place'
    })
  }, [
    activeDetailId,
    activeMode,
    activeBackdropOpacity,
    activeFillColor,
    activeFillOpacity,
    activeShapeFillStyle,
    activeLayer,
    activeShowNodes,
    activeTension,
    backdropFit,
    backdropImage,
    canvasSize.height,
    canvasSize.width,
    details,
    pointRadius,
    points,
    strokeColor,
    viewport
  ])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (disabled) {
        return
      }

      const screenPosition = getPointerPosition(event)

      if (event.button === 1 || event.altKey || event.shiftKey) {
        panRef.current = {
          pointerId: event.pointerId,
          startX: screenPosition.x,
          startY: screenPosition.y,
          startOffsetX: viewport.offsetX,
          startOffsetY: viewport.offsetY
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        setCursor('grabbing')
        return
      }

      const position = screenToWorld(screenPosition, viewport.scale, viewport.offsetX, viewport.offsetY)
      const hitRadius = pointRadius / viewport.scale

      if (activeLayer === 'course') {
        const index = findPointAt(points, position, hitRadius)

        if (activeMode === 'erase') {
          if (index >= 0) {
            setPoints(points.filter((_, pointIndex) => pointIndex !== index))
          }
          return
        }

        if (index >= 0) {
          const point = points[index]!
          dragRef.current = {
            layer: 'course',
            index,
            offsetX: position.x - point.x,
            offsetY: position.y - point.y
          }
          event.currentTarget.setPointerCapture(event.pointerId)
          setCursor('grabbing')
          return
        }

        pendingPlacementRef.current = {
          pointerId: event.pointerId,
          layer: 'course',
          point: position,
          startX: screenPosition.x,
          startY: screenPosition.y,
          startOffsetX: viewport.offsetX,
          startOffsetY: viewport.offsetY
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        return
      }

      const hitDetail =
        [...details]
          .reverse()
          .find((detail) => detail.type === activeLayer && findPointAt(detail.points, position, hitRadius) >= 0) ?? null
      const activeDetail =
        hitDetail ??
        details.find((detail) => detail.id === activeDetailId && detail.type === activeLayer) ??
        details.find((detail) => detail.type === activeLayer) ??
        null

      if (!activeDetail) {
        pendingPlacementRef.current = {
          pointerId: event.pointerId,
          layer: activeLayer,
          point: position,
          startX: screenPosition.x,
          startY: screenPosition.y,
          startOffsetX: viewport.offsetX,
          startOffsetY: viewport.offsetY
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        return
      }

      setActiveDetailId(activeDetail.id)
      const detailPointIndex = findPointAt(activeDetail.points, position, hitRadius)

      if (activeMode === 'erase') {
        if (detailPointIndex >= 0) {
          setDetails(
            activeDetail.type === 'hole'
              ? details.filter((detail) => detail.id !== activeDetail.id)
              : details.map((detail) =>
                  detail.id === activeDetail.id
                    ? {
                        ...detail,
                        points: detail.points.filter((_, pointIndex) => pointIndex !== detailPointIndex)
                      }
                    : detail
                )
          )
        }
        return
      }

      if (detailPointIndex >= 0) {
        const point = activeDetail.points[detailPointIndex]!
        dragRef.current = {
          layer: activeLayer,
          detailId: activeDetail.id,
          index: detailPointIndex,
          offsetX: position.x - point.x,
          offsetY: position.y - point.y
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        setCursor('grabbing')
        return
      }

      pendingPlacementRef.current = {
        pointerId: event.pointerId,
        layer: activeLayer,
        detailId: activeDetail.id,
        point: position,
        startX: screenPosition.x,
        startY: screenPosition.y,
        startOffsetX: viewport.offsetX,
        startOffsetY: viewport.offsetY
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [
      activeDetailId,
      activeLayer,
      activeMode,
      details,
      disabled,
      pointRadius,
      points,
      setDetails,
      setPoints,
      viewport.offsetX,
      viewport.offsetY,
      viewport.scale
    ]
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (disabled) {
        return
      }

      const screenPosition = getPointerPosition(event)

      if (panRef.current) {
        const pan = panRef.current
        setViewport({
          scale: viewport.scale,
          offsetX: pan.startOffsetX + screenPosition.x - pan.startX,
          offsetY: pan.startOffsetY + screenPosition.y - pan.startY
        })
        return
      }

      if (pendingPlacementRef.current) {
        const pendingPlacement = pendingPlacementRef.current
        const distanceX = screenPosition.x - pendingPlacement.startX
        const distanceY = screenPosition.y - pendingPlacement.startY

        if (distanceX * distanceX + distanceY * distanceY >= PAN_START_THRESHOLD * PAN_START_THRESHOLD) {
          pendingPlacementRef.current = null
          panRef.current = {
            pointerId: pendingPlacement.pointerId,
            startX: pendingPlacement.startX,
            startY: pendingPlacement.startY,
            startOffsetX: pendingPlacement.startOffsetX,
            startOffsetY: pendingPlacement.startOffsetY
          }
          setViewport({
            scale: viewport.scale,
            offsetX: pendingPlacement.startOffsetX + distanceX,
            offsetY: pendingPlacement.startOffsetY + distanceY
          })
          setCursor('grabbing')
        }
        return
      }

      if (activeMode === 'erase') {
        return
      }

      const position = screenToWorld(screenPosition, viewport.scale, viewport.offsetX, viewport.offsetY)
      const drag = dragRef.current

      if (drag) {
        const nextPoint = {
          x: position.x - drag.offsetX,
          y: position.y - drag.offsetY
        }

        if (drag.layer === 'course') {
          setPoints(points.map((point, index) => (index === drag.index ? nextPoint : point)))
        } else {
          setDetails(
            details.map((detail) =>
              detail.id === drag.detailId
                ? {
                    ...detail,
                    points: detail.points.map((point, index) => (index === drag.index ? nextPoint : point))
                  }
                : detail
            )
          )
        }
        return
      }

      const hitRadius = pointRadius / viewport.scale
      const hoverIndex =
        activeLayer === 'course'
          ? findPointAt(points, position, hitRadius)
          : [...details]
                .reverse()
                .some((detail) => detail.type === activeLayer && findPointAt(detail.points, position, hitRadius) >= 0)
            ? 0
            : -1
      setCursor(hoverIndex >= 0 ? 'grab' : 'crosshair')
    },
    [
      activeDetailId,
      activeLayer,
      activeMode,
      details,
      disabled,
      pointRadius,
      points,
      setDetails,
      setPoints,
      viewport.offsetX,
      viewport.offsetY,
      viewport.scale
    ]
  )

  const stopDragging = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (pendingPlacementRef.current) {
        const pendingPlacement = pendingPlacementRef.current
        pendingPlacementRef.current = null
        commitPendingPlacement(pendingPlacement)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }

      if (panRef.current) {
        panRef.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }

      if (dragRef.current) {
        dragRef.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }

      if (activeMode !== 'erase') {
        setCursor('crosshair')
      }
    },
    [activeMode, commitPendingPlacement]
  )

  const onWheel = useCallback(
    (event: ReactWheelEvent<HTMLCanvasElement>) => {
      if (disabled) {
        return
      }

      event.preventDefault()
      zoomAt(getPointerPosition(event), event.deltaY)
    },
    [disabled, zoomAt]
  )

  return (
    <section className={joinClassNames('foreway-builder', className)} style={{ ...styles.wrap, ...style }}>
      <h2 style={styles.srOnly}>{canvasLabel}</h2>
      <div style={styles.workArea}>
        <aside style={styles.toolbar} aria-label='Builder controls'>
          <div style={styles.toolbarHeader}>
            <span style={styles.sectionTitle}>GUIDE</span>
            <span aria-live='polite' style={styles.hint}>
              {HINTS[activeMode]}
            </span>
          </div>

          <section style={styles.section} aria-label='Layer controls'>
            <span style={styles.sectionTitle}>Layer</span>
            <div style={styles.buttonGrid}>
              {LAYERS.map((layer) => (
                <button
                  key={layer}
                  type='button'
                  aria-pressed={activeLayer === layer}
                  disabled={disabled}
                  onClick={() => {
                    setActiveLayer(layer)
                    if (layer === 'course') {
                      setActiveDetailId(null)
                    }
                  }}
                  style={{
                    ...styles.button,
                    ...styles.sidebarButton,
                    ...(activeLayer === layer ? styles.activeButton : null)
                  }}>
                  {LAYER_LABELS[layer]}
                </button>
              ))}
            </div>
            <button
              type='button'
              disabled={disabled || activeLayer === 'course' || activeLayer === 'hole'}
              onClick={startNewDetail}
              style={{ ...styles.button, ...styles.sidebarButton }}>
              New detail
            </button>
            {activeLayer !== 'course' ? (
              <label style={styles.label}>
                Detail color
                <input
                  type='color'
                  value={selectedDetailColorInputValue}
                  disabled={disabled || !selectedDetail}
                  onChange={(event) => setSelectedDetailColorValue(event.currentTarget.value)}
                  style={styles.colorInput}
                />
              </label>
            ) : null}
          </section>

          <section style={styles.section} aria-label='Mode controls'>
            <span style={styles.sectionTitle}>Mode</span>
            <div style={styles.buttonGrid}>
              {MODES.map((builderMode) => (
                <button
                  key={builderMode}
                  type='button'
                  aria-pressed={activeMode === builderMode}
                  disabled={disabled}
                  onClick={() => setMode(builderMode)}
                  style={{
                    ...styles.button,
                    ...styles.sidebarButton,
                    ...(activeMode === builderMode ? styles.activeButton : null)
                  }}>
                  {MODE_LABELS[builderMode]}
                </button>
              ))}
            </div>
          </section>

          <section style={styles.section} aria-label='Edit controls'>
            <span style={styles.sectionTitle}>Edit</span>
            <div style={styles.buttonGrid}>
              <button
                type='button'
                disabled={disabled || points.length === 0}
                onClick={undo}
                style={{ ...styles.button, ...styles.sidebarButton }}>
                Undo
              </button>
              <button
                type='button'
                disabled={disabled || points.length === 0}
                onClick={clearAll}
                style={{ ...styles.button, ...styles.sidebarButton, ...styles.dangerButton }}>
                Clear
              </button>
            </div>
            <button
              type='button'
              disabled={disabled || details.length === 0}
              onClick={clearDetails}
              style={{ ...styles.button, ...styles.sidebarButton, ...styles.dangerButton }}>
              Clear details
            </button>
            <button type='button' onClick={downloadDrawingJson} style={{ ...styles.button, ...styles.sidebarButton }}>
              Download JSON
            </button>
          </section>

          <section style={styles.section} aria-label='View controls'>
            <span style={styles.sectionTitle}>View</span>
            <div style={styles.buttonGrid}>
              <button
                type='button'
                disabled={disabled}
                onClick={() => setShowNodesValue(!activeShowNodes)}
                style={{ ...styles.button, ...styles.sidebarButton }}>
                {activeShowNodes ? 'Hide nodes' : 'Show nodes'}
              </button>
              <button type='button' onClick={fitShape} style={{ ...styles.button, ...styles.sidebarButton }}>
                Fit shape
              </button>
            </div>
            <button type='button' onClick={resetZoom} style={{ ...styles.button, ...styles.sidebarButton }}>
              Reset zoom
            </button>
          </section>

          <section style={styles.section} aria-label='Shape style controls'>
            <span style={styles.sectionTitle}>Shape</span>
            <label style={styles.label}>
              Surface
              <select
                value={activeShapeFillStyle}
                disabled={disabled}
                onChange={(event) => setShapeFillStyleValue(event.currentTarget.value as CourseShapeFillStyle)}
                style={styles.select}>
                <option value='terrain'>Terrain</option>
                <option value='solid'>Solid</option>
              </select>
            </label>
            <label style={styles.label}>
              Color
              <input
                type='color'
                value={activeFillColorInputValue}
                disabled={disabled}
                onChange={(event) => setFillColorValue(event.currentTarget.value)}
                style={styles.colorInput}
              />
            </label>
            <label style={styles.label}>
              Opacity
              <input
                type='range'
                min={0}
                max={1}
                step={0.05}
                value={activeFillOpacity}
                disabled={disabled}
                onChange={(event) => setFillOpacityValue(event.currentTarget.valueAsNumber)}
                style={styles.range}
              />
            </label>
            <label style={styles.label}>
              Smoothness
              <input
                type='range'
                min={0}
                max={1}
                step={0.05}
                value={activeTension}
                disabled={disabled}
                onChange={(event) => setTensionValue(event.currentTarget.valueAsNumber)}
                style={styles.range}
              />
            </label>
          </section>

          <section style={styles.section} aria-label='Guide controls'>
            <span style={styles.sectionTitle}>Guide</span>
            <input
              ref={fileInputRef}
              type='file'
              accept='image/*'
              onChange={uploadBackdropImage}
              style={styles.fileInput}
            />
            <div style={styles.buttonGrid}>
              <button
                type='button'
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
                style={{ ...styles.button, ...styles.sidebarButton }}>
                Upload
              </button>
              <button
                type='button'
                disabled={disabled || !hasBackdropImage}
                onClick={clearBackdropImage}
                style={{ ...styles.button, ...styles.sidebarButton, ...styles.dangerButton }}>
                Clear
              </button>
            </div>
            <label style={styles.label}>
              Opacity
              <input
                type='range'
                min={0}
                max={1}
                step={0.05}
                value={activeBackdropOpacity}
                disabled={disabled || !hasBackdropImage}
                onChange={(event) => setBackdropOpacityValue(event.currentTarget.valueAsNumber)}
                style={styles.range}
              />
            </label>
          </section>
        </aside>

        <div ref={containerRef} style={containerStyle}>
          <canvas
            ref={canvasRef}
            aria-label={canvasLabel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            onPointerLeave={stopDragging}
            onWheel={onWheel}
            role='img'
            style={{
              ...styles.canvas,
              cursor: disabled ? 'not-allowed' : cursor
            }}
          />
        </div>
      </div>

      <div style={styles.statusbar}>
        <div style={styles.status}>
          <strong style={styles.statusValue}>{points.length}</strong>
          Course points
        </div>
        <div style={styles.status}>
          <strong style={styles.statusValue}>{details.length}</strong>
          Details
        </div>
        <div style={{ ...styles.status, ...styles.statusLast }}>
          <strong style={styles.statusValue}>
            {activeLayer === 'course' ? MODE_LABELS[activeMode] : `${activeLayer} ${TIPS[activeMode]}`}
          </strong>
          Tip
        </div>
      </div>
    </section>
  )
}
