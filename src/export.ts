import type { CourseBackdropFit, CourseDetail, CourseDrawingExport, CoursePoint, CourseShapeFillStyle, CourseViewport } from './types'

interface CreateCourseDrawingExportOptions {
  points: CoursePoint[]
  details: CourseDetail[]
  tension: number
  fillColor: string
  fillOpacity: number
  shapeFillStyle?: CourseShapeFillStyle
  strokeColor: string
  showNodes: boolean
  backgroundColor: string
  showBoardGrid: boolean
  boardGridColor: string
  boardGridSize: number
  backdropImageUrl: string | null
  backdropOpacity: number
  backdropFit: CourseBackdropFit
  viewport: CourseViewport
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

export function createCourseDrawingExport(options: CreateCourseDrawingExportOptions): CourseDrawingExport {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    points: clonePoints(options.points),
    details: cloneDetails(options.details),
    style: {
      tension: options.tension,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
      shapeFillStyle: options.shapeFillStyle ?? 'terrain',
      strokeColor: options.strokeColor,
      showNodes: options.showNodes,
      backgroundColor: options.backgroundColor,
      showBoardGrid: options.showBoardGrid,
      boardGridColor: options.boardGridColor,
      boardGridSize: options.boardGridSize
    },
    backdrop: {
      imageUrl: options.backdropImageUrl?.startsWith('blob:') ? null : options.backdropImageUrl,
      opacity: options.backdropOpacity,
      fit: options.backdropFit
    },
    viewport: { ...options.viewport }
  }
}

export function createCourseDrawingCode(exportData: CourseDrawingExport): string {
  return `import type { CourseDrawingExport } from "foreway";

export const forewayCourse = ${JSON.stringify(exportData, null, 2)} satisfies CourseDrawingExport;
`
}

export function createCourseDrawingJson(exportData: CourseDrawingExport): string {
  return `${JSON.stringify(exportData, null, 2)}\n`
}
