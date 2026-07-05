import { useMemo, useState } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import {
  CourseMap,
  CourseShapeBuilder,
  createCourseDrawingExport,
  type CourseBuilderMode,
  type CourseDetail,
  type CourseDrawingExport,
  type CoursePoint
} from '../../index'
import pinatuboCourse from '../../src/pinatubo-complete.json'
import './styles.css'

const STARTER_COURSE = pinatuboCourse as CourseDrawingExport

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

function formatPoints(points: CoursePoint[]): string {
  return JSON.stringify(
    points.map((point) => ({
      x: Math.round(point.x),
      y: Math.round(point.y)
    })),
    null,
    2
  )
}

function DevPlayground() {
  const [points, setPoints] = useState<CoursePoint[]>(() => clonePoints(STARTER_COURSE.points))
  const [details, setDetails] = useState<CourseDetail[]>(() => cloneDetails(STARTER_COURSE.details))
  const [mode, setMode] = useState<CourseBuilderMode>('move')
  const [tension, setTension] = useState(STARTER_COURSE.style.tension)
  const drawing = useMemo(
    () =>
      createCourseDrawingExport({
        points,
        details,
        tension,
        fillColor: STARTER_COURSE.style.fillColor,
        fillOpacity: STARTER_COURSE.style.fillOpacity,
        shapeFillStyle: STARTER_COURSE.style.shapeFillStyle ?? 'terrain',
        strokeColor: STARTER_COURSE.style.strokeColor,
        showNodes: STARTER_COURSE.style.showNodes,
        backgroundColor: STARTER_COURSE.style.backgroundColor,
        showBoardGrid: STARTER_COURSE.style.showBoardGrid,
        boardGridColor: STARTER_COURSE.style.boardGridColor,
        boardGridSize: STARTER_COURSE.style.boardGridSize,
        backdropImageUrl: STARTER_COURSE.backdrop.imageUrl,
        backdropOpacity: STARTER_COURSE.backdrop.opacity,
        backdropFit: STARTER_COURSE.backdrop.fit,
        viewport: STARTER_COURSE.viewport
      }),
    [details, points, tension]
  )
  const resetSample = () => {
    setPoints(clonePoints(STARTER_COURSE.points))
    setDetails(cloneDetails(STARTER_COURSE.details))
    setTension(STARTER_COURSE.style.tension)
  }

  return (
    <main className='dev-shell'>
      <header className='dev-header'>
        <div>
          <p className='eyebrow'>Foreway</p>
        </div>
        <div className='header-actions' style={{ border: '1px solid #ccc' }}>
          <button type='button' onClick={resetSample} style={{ borderRadius: 0, border: 0 }}>
            Sample Course
          </button>
          <button
            type='button'
            onClick={() => setDetails(cloneDetails(STARTER_COURSE.details))}
            style={{ borderRadius: 0, border: 0 }}>
            Sample Details
          </button>
          <button type='button' onClick={() => setPoints([])} style={{ borderRadius: 0, border: 0 }}>
            Clear Canvas
          </button>
        </div>
      </header>

      <div className='dev-layout'>
        <section className='builder-pane' aria-label='Interactive builder'>
          <CourseShapeBuilder
            value={points}
            onChange={setPoints}
            details={details}
            onDetailsChange={setDetails}
            mode={mode}
            onModeChange={setMode}
            tension={tension}
            onTensionChange={setTension}
            defaultFillColor={STARTER_COURSE.style.fillColor}
            defaultFillOpacity={STARTER_COURSE.style.fillOpacity}
            defaultShapeFillStyle={STARTER_COURSE.style.shapeFillStyle ?? 'terrain'}
            strokeColor={STARTER_COURSE.style.strokeColor}
            defaultShowNodes={STARTER_COURSE.style.showNodes}
            backgroundColor={STARTER_COURSE.style.backgroundColor}
            showBoardGrid={STARTER_COURSE.style.showBoardGrid}
            boardGridColor={STARTER_COURSE.style.boardGridColor}
            boardGridSize={STARTER_COURSE.style.boardGridSize}
            height='100%'
          />
        </section>

        <aside className='inspect-pane' aria-label='Builder data'>
          <div className='metric-grid'>
            <div>
              <strong>{points.length}</strong>
              <span>Points</span>
            </div>
            <div>
              <strong>{details.length}</strong>
              <span>Details</span>
            </div>
            <div>
              <strong>{mode}</strong>
              <span>Mode</span>
            </div>
            <div>
              <strong>{tension.toFixed(2)}</strong>
              <span>Smoothness</span>
            </div>
          </div>

          <section className='preview-panel' aria-label='Read-only CourseMap preview'>
            <span className='code-label'>CourseMap preview</span>
            <CourseMap drawing={drawing} height={220} />
          </section>

          <label className='code-label' htmlFor='course-json'>
            Course JSON
          </label>
          <textarea
            id='course-json'
            readOnly
            value={JSON.stringify({ ...drawing, points: JSON.parse(formatPoints(points)) }, null, 2)}
            spellCheck={false}
          />
        </aside>
      </div>
    </main>
  )
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Missing root element')
}

const devGlobal = globalThis as typeof globalThis & {
  __forewayDevRoot?: Root
}

devGlobal.__forewayDevRoot ??= createRoot(rootElement)
devGlobal.__forewayDevRoot.render(<DevPlayground />)
