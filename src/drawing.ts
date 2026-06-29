import type { CourseBackdropFit, CourseDetail, CourseDetailType, CoursePoint, CourseShapeFillStyle, CourseViewport, DrawCourseShapeOptions } from './types'

const SPLINE_STEPS = 20
const HIT_PADDING = 6
const DEFAULT_STROKE_WIDTH = 0.5
const SELECTED_STROKE_WIDTH = 1
const SELECTED_STROKE_COLOR = '#38bdf8'
const ARROW_STROKE_COLOR = '#ffffff'
const DETAIL_TENSION = 1
const DETAIL_NODE_SCALE = 0.62

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function clonePoint(point: CoursePoint): CoursePoint {
  return { x: point.x, y: point.y }
}

function catmullRomSegment(
  p0: CoursePoint,
  p1: CoursePoint,
  p2: CoursePoint,
  p3: CoursePoint,
  steps: number
): CoursePoint[] {
  const result: CoursePoint[] = []

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const t2 = t * t
    const t3 = t2 * t

    result.push({
      x:
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y:
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    })
  }

  return result
}

function getLinearClosedPoint(points: CoursePoint[], t: number): CoursePoint {
  const segment = t * points.length
  const index = Math.floor(segment) % points.length
  const nextIndex = (index + 1) % points.length
  const localT = segment - Math.floor(segment)
  const point = points[index]!
  const nextPoint = points[nextIndex]!

  return {
    x: point.x + (nextPoint.x - point.x) * localT,
    y: point.y + (nextPoint.y - point.y) * localT
  }
}

function getPointBounds(points: CoursePoint[]): Bounds | null {
  const first = points[0]

  if (!first) {
    return null
  }

  return points.reduce<Bounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y)
    }),
    { minX: first.x, minY: first.y, maxX: first.x, maxY: first.y }
  )
}

export function buildClosedSpline(points: CoursePoint[]): CoursePoint[] {
  const count = points.length

  if (count < 3) {
    return points.map(clonePoint)
  }

  const result: CoursePoint[] = []

  for (let i = 0; i < count; i += 1) {
    const p0 = points[(i - 1 + count) % count]!
    const p1 = points[i]!
    const p2 = points[(i + 1) % count]!
    const p3 = points[(i + 2) % count]!
    const segment = catmullRomSegment(p0, p1, p2, p3, SPLINE_STEPS)

    result.push(...segment.slice(0, -1))
  }

  return result
}

export function buildCourseOutline(points: CoursePoint[], tension: number): CoursePoint[] {
  const clampedTension = Math.max(0, Math.min(1, tension))

  if (points.length < 3 || clampedTension === 0) {
    return points.map(clonePoint)
  }

  const smooth = buildClosedSpline(points)

  if (clampedTension === 1) {
    return smooth
  }

  return smooth.map((point, index) => {
    const linear = getLinearClosedPoint(points, index / smooth.length)

    return {
      x: point.x * clampedTension + linear.x * (1 - clampedTension),
      y: point.y * clampedTension + linear.y * (1 - clampedTension)
    }
  })
}

function buildOpenSpline(points: CoursePoint[], tension: number): CoursePoint[] {
  const clampedTension = Math.max(0, Math.min(1, tension))

  if (points.length < 3 || clampedTension === 0) {
    return points.map(clonePoint)
  }

  const result: CoursePoint[] = []

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)]!
    const p1 = points[index]!
    const p2 = points[index + 1]!
    const p3 = points[Math.min(points.length - 1, index + 2)]!
    const smoothSegment = catmullRomSegment(p0, p1, p2, p3, SPLINE_STEPS)

    smoothSegment.slice(0, -1).forEach((point, segmentIndex) => {
      if (clampedTension === 1) {
        result.push(point)
        return
      }

      const t = segmentIndex / SPLINE_STEPS
      const linear = {
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t
      }

      result.push({
        x: point.x * clampedTension + linear.x * (1 - clampedTension),
        y: point.y * clampedTension + linear.y * (1 - clampedTension)
      })
    })
  }

  result.push(clonePoint(points[points.length - 1]!))

  return result
}

export function findPointAt(points: CoursePoint[], position: CoursePoint, radius: number): number {
  const hitRadius = radius + HIT_PADDING
  const hitRadiusSquared = hitRadius * hitRadius

  for (let i = points.length - 1; i >= 0; i -= 1) {
    const point = points[i]!
    const dx = point.x - position.x
    const dy = point.y - position.y

    if (dx * dx + dy * dy <= hitRadiusSquared) {
      return i
    }
  }

  return -1
}

function getDistanceSquaredToSegment(position: CoursePoint, start: CoursePoint, end: CoursePoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) {
    const pointDx = position.x - start.x
    const pointDy = position.y - start.y
    return pointDx * pointDx + pointDy * pointDy
  }

  const projection = ((position.x - start.x) * dx + (position.y - start.y) * dy) / lengthSquared
  const t = Math.max(0, Math.min(1, projection))
  const closestX = start.x + t * dx
  const closestY = start.y + t * dy
  const closestDx = position.x - closestX
  const closestDy = position.y - closestY

  return closestDx * closestDx + closestDy * closestDy
}

export function findInsertionIndexAt(points: CoursePoint[], position: CoursePoint): number {
  if (points.length < 2) {
    return points.length
  }

  let closestIndex = 0
  let closestDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index < points.length; index += 1) {
    const nextIndex = (index + 1) % points.length
    const distance = getDistanceSquaredToSegment(position, points[index]!, points[nextIndex]!)

    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = index
    }
  }

  return closestIndex + 1
}

export function getCourseBounds(points: CoursePoint[], details: CourseDetail[] = []): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let hasPoint = false

  const includePoint = (point: CoursePoint) => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
    hasPoint = true
  }

  points.forEach(includePoint)
  details.forEach((detail) => detail.points.forEach(includePoint))

  return hasPoint ? { minX, minY, maxX, maxY } : null
}

export function getFitViewport(
  points: CoursePoint[],
  details: CourseDetail[],
  width: number,
  height: number,
  padding = 48
): CourseViewport {
  const bounds = getCourseBounds(points, details)

  if (!bounds || width <= 0 || height <= 0) {
    return { scale: 1, offsetX: 0, offsetY: 0 }
  }

  const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1)
  const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1)
  const scale = Math.max(0.2, Math.min(5, Math.min((width - padding * 2) / boundsWidth, (height - padding * 2) / boundsHeight)))
  const contentCenterX = bounds.minX + boundsWidth / 2
  const contentCenterY = bounds.minY + boundsHeight / 2

  return {
    scale,
    offsetX: width / 2 - contentCenterX * scale,
    offsetY: height / 2 - contentCenterY * scale
  }
}

function drawBackdropImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  opacity: number,
  fit: CourseBackdropFit
): void {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return
  }

  let drawWidth = width
  let drawHeight = height
  let drawX = 0
  let drawY = 0

  if (fit !== 'stretch') {
    const scale = fit === 'cover' ? Math.max(width / sourceWidth, height / sourceHeight) : Math.min(width / sourceWidth, height / sourceHeight)
    drawWidth = sourceWidth * scale
    drawHeight = sourceHeight * scale
    drawX = (width - drawWidth) / 2
    drawY = (height - drawHeight) / 2
  }

  context.save()
  context.globalAlpha = Math.max(0, Math.min(1, opacity))
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight)
  context.restore()
}

function getDetailDefaultColor(type: CourseDetailType): string {
  if (type === 'pond') {
    return '#4fa7c8'
  }

  if (type === 'arrow') {
    return ARROW_STROKE_COLOR
  }

  if (type === 'hole') {
    return '#ffffff'
  }

  return '#d9bf73'
}

function getDetailColor(detail: CourseDetail): string {
  return detail.style?.color ?? getDetailDefaultColor(detail.type)
}

function getReadableTextColor(backgroundColor: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(backgroundColor)

  if (!match) {
    return '#111827'
  }

  const hex = match[1]!
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255

  return luminance > 0.58 ? '#111827' : '#ffffff'
}

function drawClosedShape(
  context: CanvasRenderingContext2D,
  points: CoursePoint[],
  tension: number,
  fillColor: string,
  fillOpacity: number,
  strokeColor: string,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  shapeFillStyle: CourseShapeFillStyle = 'solid'
): void {
  if (points.length >= 3) {
    const curve = buildCourseOutline(points, tension)
    const first = curve[0]

    if (!first) {
      return
    }

    context.beginPath()
    context.moveTo(first.x, first.y)
    for (let i = 1; i < curve.length; i += 1) {
      const point = curve[i]!
      context.lineTo(point.x, point.y)
    }
    context.closePath()
    fillClosedShape(context, curve, fillColor, fillOpacity, shapeFillStyle)
    if (strokeWidth > 0 && strokeColor !== 'transparent') {
      context.strokeStyle = strokeColor
      context.lineWidth = strokeWidth
      context.stroke()
    }
    return
  }

  if (points.length === 2) {
    const first = points[0]!
    const second = points[1]!
    context.beginPath()
    context.moveTo(first.x, first.y)
    context.lineTo(second.x, second.y)
    if (strokeWidth > 0 && strokeColor !== 'transparent') {
      context.strokeStyle = strokeColor
      context.lineWidth = strokeWidth
      context.setLineDash([6, 4])
      context.stroke()
      context.setLineDash([])
    }
  }
}

function drawRoundedDetailShape(
  context: CanvasRenderingContext2D,
  points: CoursePoint[],
  fillColor: string,
  fillOpacity: number,
  strokeColor: string,
  strokeWidth = 0
): void {
  if (points.length >= 3) {
    const firstPoint = points[0]!
    const secondPoint = points[1]!
    const start = getMidpoint(firstPoint, secondPoint)

    context.beginPath()
    context.moveTo(start.x, start.y)

    for (let index = 1; index <= points.length; index += 1) {
      const controlPoint = points[index % points.length]!
      const nextPoint = points[(index + 1) % points.length]!
      const end = getMidpoint(controlPoint, nextPoint)
      context.quadraticCurveTo(controlPoint.x, controlPoint.y, end.x, end.y)
    }

    context.closePath()
    context.save()
    context.globalAlpha = Math.max(0, Math.min(1, fillOpacity))
    context.fillStyle = fillColor
    context.fill()
    context.restore()

    if (strokeWidth > 0 && strokeColor !== 'transparent') {
      context.strokeStyle = strokeColor
      context.lineWidth = strokeWidth
      context.stroke()
    }
    return
  }

  drawClosedShape(context, points, DETAIL_TENSION, fillColor, fillOpacity, strokeColor, strokeWidth)
}

function getMidpoint(first: CoursePoint, second: CoursePoint): CoursePoint {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  }
}

function fillClosedShape(
  context: CanvasRenderingContext2D,
  curve: CoursePoint[],
  fillColor: string,
  fillOpacity: number,
  shapeFillStyle: CourseShapeFillStyle
): void {
  if (shapeFillStyle === 'terrain') {
    fillTerrainShape(context, curve, fillOpacity)
    return
  }

  context.save()
  context.globalAlpha = Math.max(0, Math.min(1, fillOpacity))
  context.fillStyle = fillColor
  context.fill()
  context.restore()
}

function fillTerrainShape(context: CanvasRenderingContext2D, curve: CoursePoint[], fillOpacity: number): void {
  const bounds = getPointBounds(curve)

  if (!bounds) {
    return
  }

  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  const opacity = Math.max(0, Math.min(1, fillOpacity))

  context.save()
  context.globalAlpha = opacity
  context.shadowColor = 'rgba(24, 78, 38, 0.34)'
  context.shadowBlur = 34
  context.shadowOffsetY = Math.max(10, height * 0.04)

  const base = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
  base.addColorStop(0, '#7fc455')
  base.addColorStop(0.32, '#5aa344')
  base.addColorStop(0.68, '#347d3d')
  base.addColorStop(1, '#1f5f35')
  context.fillStyle = base
  context.fill()
  context.restore()

  context.save()
  context.clip()
  context.globalAlpha = opacity

  context.shadowColor = 'rgba(12, 58, 31, 0.38)'
  context.shadowBlur = 28
  context.shadowOffsetX = 0
  context.shadowOffsetY = 0
  context.strokeStyle = 'rgba(12, 58, 31, 0.28)'
  context.lineWidth = Math.max(14, Math.min(width, height) * 0.055)
  context.stroke()
  context.restore()
}

function drawNodes(
  context: CanvasRenderingContext2D,
  points: CoursePoint[],
  pointRadius: number,
  strokeColor: string,
  firstPointColor: string
): void {
  points.forEach((point, index) => {
    const isFirst = index === 0

    context.beginPath()
    context.arc(point.x, point.y, pointRadius, 0, Math.PI * 2)
    context.fillStyle = isFirst ? '#fff' : 'rgba(255, 255, 255, 0.92)'
    context.fill()
    context.strokeStyle = isFirst ? firstPointColor : strokeColor
    context.lineWidth = 1
    context.stroke()
  })
}

function drawArrowDetail(context: CanvasRenderingContext2D, points: CoursePoint[], tension: number, strokeColor: string, strokeWidth: number): void {
  if (points.length < 2) {
    return
  }

  const curve = buildOpenSpline(points, tension)
  const first = curve[0]

  if (!first) {
    return
  }

  context.save()
  context.beginPath()
  context.moveTo(first.x, first.y)
  for (let index = 1; index < curve.length; index += 1) {
    const point = curve[index]!
    context.lineTo(point.x, point.y)
  }
  context.strokeStyle = strokeColor
  context.lineWidth = strokeWidth
  context.setLineDash([8, 6])
  context.stroke()
  context.setLineDash([])

  const end = curve[curve.length - 1]!
  const beforeEnd = curve[curve.length - 2] ?? points[points.length - 2]!
  const angle = Math.atan2(end.y - beforeEnd.y, end.x - beforeEnd.x)
  const arrowLength = 13
  const arrowAngle = Math.PI / 7

  context.beginPath()
  context.moveTo(end.x, end.y)
  context.lineTo(end.x - Math.cos(angle - arrowAngle) * arrowLength, end.y - Math.sin(angle - arrowAngle) * arrowLength)
  context.moveTo(end.x, end.y)
  context.lineTo(end.x - Math.cos(angle + arrowAngle) * arrowLength, end.y - Math.sin(angle + arrowAngle) * arrowLength)
  context.strokeStyle = strokeColor
  context.lineWidth = strokeWidth
  context.stroke()
  context.restore()
}

function drawHoleDetail(
  context: CanvasRenderingContext2D,
  detail: CourseDetail,
  fillColor: string,
  strokeColor: string,
  strokeWidth: number
): void {
  const point = detail.points[0]

  if (!point) {
    return
  }

  const radius = 13
  context.beginPath()
  context.arc(point.x, point.y, radius, 0, Math.PI * 2)
  context.fillStyle = fillColor
  context.fill()
  if (strokeWidth > 0 && strokeColor !== 'transparent') {
    context.strokeStyle = strokeColor
    context.lineWidth = strokeWidth
    context.stroke()
  }
  context.fillStyle = getReadableTextColor(fillColor)
  context.font = 'bold 11px sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(String(detail.label ?? ''), point.x, point.y)
}

export function drawCourseShape(context: CanvasRenderingContext2D, options: DrawCourseShapeOptions): void {
  const {
    points,
    details = [],
    tension,
    width,
    height,
    viewport = { scale: 1, offsetX: 0, offsetY: 0 },
    backgroundColor = 'transparent',
    fillColor = '#5a9e4f',
    fillOpacity = 1,
    shapeFillStyle = 'solid',
    strokeColor = '#3b6d11',
    showNodes = true,
    isCourseSelected = true,
    activeDetailId = null,
    firstPointColor = '#e03c2a',
    pointRadius = 7,
    showEmptyHint = true,
    backdropImage = null,
    backdropOpacity = 0.55,
    backdropFit = 'contain'
  } = options

  context.clearRect(0, 0, width, height)
  if (backgroundColor !== 'transparent') {
    context.fillStyle = backgroundColor
    context.fillRect(0, 0, width, height)
  }

  context.save()
  context.setTransform(viewport.scale, 0, 0, viewport.scale, viewport.offsetX, viewport.offsetY)

  if (backdropImage) {
    drawBackdropImage(context, backdropImage, width, height, backdropOpacity, backdropFit)
  }

  drawClosedShape(
    context,
    points,
    tension,
    fillColor,
    fillOpacity,
    isCourseSelected ? SELECTED_STROKE_COLOR : strokeColor,
    isCourseSelected ? SELECTED_STROKE_WIDTH : DEFAULT_STROKE_WIDTH,
    shapeFillStyle
  )

  const detailTension = Math.max(tension, DETAIL_TENSION)

  details.filter((detail) => detail.type === 'sand' || detail.type === 'pond').forEach((detail) => {
    const color = getDetailColor(detail)
    const detailOpacity = detail.type === 'pond' ? 0.72 : 0.82
    const isSelected = activeDetailId === detail.id
    drawRoundedDetailShape(
      context,
      detail.points,
      color,
      detailOpacity,
      isSelected ? SELECTED_STROKE_COLOR : 'transparent',
      isSelected ? SELECTED_STROKE_WIDTH : 0
    )
  })

  details.filter((detail) => detail.type === 'arrow' || detail.type === 'hole').forEach((detail) => {
    const color = getDetailColor(detail)
    const isSelected = activeDetailId === detail.id

    if (detail.type === 'arrow') {
      drawArrowDetail(context, detail.points, detailTension, color, DEFAULT_STROKE_WIDTH)
      return
    }

    drawHoleDetail(context, detail, color, isSelected ? SELECTED_STROKE_COLOR : 'transparent', isSelected ? SELECTED_STROKE_WIDTH : 0)
  })

  if (points.length === 0 && showEmptyHint) {
    context.fillStyle = 'rgba(0, 0, 0, 0.2)'
    context.font = '14px sans-serif'
    context.textAlign = 'center'
    context.fillText('Click anywhere to start placing perimeter points', width / 2, height / 2)
    context.font = '12px sans-serif'
    context.fillStyle = 'rgba(0, 0, 0, 0.13) '
    context.fillText('Shape fills in after 3 points', width / 2, height / 2 + 22)
    context.textAlign = 'left'
  }

  if (showNodes) {
    const detailPointRadius = Math.max(3, pointRadius * DETAIL_NODE_SCALE)
    details.forEach((detail) => {
      if (detail.type !== 'hole') {
        const color = getDetailColor(detail)
        drawNodes(context, detail.points, detailPointRadius, color, activeDetailId === detail.id ? SELECTED_STROKE_COLOR : color)
      }
    })
    drawNodes(context, points, pointRadius, strokeColor, isCourseSelected ? SELECTED_STROKE_COLOR : firstPointColor)
  }

  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  context.restore()
}
