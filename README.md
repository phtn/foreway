# foreway

A React library for building interactive golf course maps for fairway websites.

## Installation

Install the package with your project package manager:

```sh
bun add foreway
```

Or with npm:

```sh
npm install foreway
```

`foreway` expects React and React DOM to be installed by the consuming app:

```sh
bun add react react-dom
```

React components can be imported from the package root or explicitly from
`foreway/react`:

```tsx
import { CourseMap, CourseShapeBuilder } from "foreway";
// or
import { CourseMap, CourseShapeBuilder } from "foreway/react";
```

Frameworks with React Server Components can import server-safe drawing helpers
from `foreway/core`:

```ts
import { drawCourseShape, getFitViewport } from "foreway/core";
```

For local development before the package is published, install from this folder:

```sh
bun add /path/to/foreway
```

## Shape builder

`CourseShapeBuilder` is a TSX conversion of the plain HTML canvas shape builder.
It can be used as a controlled or uncontrolled component.

```tsx
import { useState } from "react";
import { CourseShapeBuilder, type CoursePoint } from "foreway";

export function CourseEditor() {
  const [points, setPoints] = useState<CoursePoint[]>([]);

  return (
    <CourseShapeBuilder
      value={points}
      onChange={setPoints}
      height={520}
      defaultTension={0.5}
      defaultFillColor="#5a9e4f"
      defaultFillOpacity={0.9}
      defaultBackdropOpacity={0.55}
    />
  );
}
```

For simple usage, omit `value` and `onChange`:

```tsx
<CourseShapeBuilder defaultValue={[{ x: 120, y: 80 }, { x: 260, y: 120 }]} />
```

By default, the board uses automatic editing: click empty board space to add a
node, or drag any existing node to move it. Select `Erase` only when you want
clicks on nodes to remove them.

Use the mouse wheel to zoom around the pointer. Drag empty board space to pan;
middle-click drag, Shift-drag, or Option/Alt-drag also pans without placing a
node.

Use the layer controls to switch between the main course shape and course
details. `Sand` and `Pond` layers use the same add/drag behavior, `Arrow` places
white dashed directional arrows that smooth through nodes in sequence, and
`Hole` places numbered circle markers. `New detail` starts another bunker, pond,
or arrow shape. When a detail layer is active, `Detail color` changes the
selected detail and stores the value in `detail.style.color` in the exported
JSON.

The package also exports `buildCourseOutline`, `buildClosedSpline`,
`findInsertionIndexAt`, `findPointAt`, `getCourseBounds`, `getFitViewport`, and
`drawCourseShape` for lower-level map rendering.

```tsx
import { useState } from "react";
import { CourseShapeBuilder, type CourseDetail } from "foreway";

const [details, setDetails] = useState<CourseDetail[]>([]);

<CourseShapeBuilder details={details} onDetailsChange={setDetails} />;
```

Use `Download JSON` in the toolbar to save the current drawing as
`foreway-course.json`. The JSON includes the course points, details, style
settings, editor backdrop settings, and viewport. Public course rendering uses
that JSON data directly; it does not render the course drawing from images.

You can also create the same export manually:

```ts
import { createCourseDrawingExport, createCourseDrawingJson } from "foreway";
```

## Rendering a course from JSON

Use `CourseMap` on public fairway pages. It renders the saved JSON as a React
canvas component.

```tsx
import { CourseMap, type CourseDrawingExport } from "foreway";
import forewayCourse from "./foreway-course.json";

const drawing = forewayCourse as CourseDrawingExport;

export function HoleMap() {
  return <CourseMap drawing={drawing} height={520} />;
}
```

`CourseMap` accepts optional render props:

```tsx
<CourseMap
  drawing={drawing}
  height={420}
  fitToBounds
  backgroundColor="transparent"
  showBoardGrid={false}
/>
```

If your TypeScript app does not allow JSON imports, enable
`resolveJsonModule` in your app `tsconfig.json` or load the file with `fetch`:

```tsx
const drawing = (await fetch("/foreway-course.json").then((response) =>
  response.json()
)) as CourseDrawingExport;
```

## Using downloaded course files

After clicking `Download JSON`, move the generated `foreway-course.json` file
into your app source tree or public assets.

Use it to reopen the drawing in the editor:

```tsx
import { useState } from "react";
import { CourseShapeBuilder, type CourseDetail, type CoursePoint } from "foreway";
import forewayCourse from "./foreway-course.json";

export function CourseEditor() {
  const [points, setPoints] = useState<CoursePoint[]>(forewayCourse.points);
  const [details, setDetails] = useState<CourseDetail[]>(forewayCourse.details);

  return (
    <CourseShapeBuilder
      value={points}
      onChange={setPoints}
      details={details}
      onDetailsChange={setDetails}
      defaultTension={forewayCourse.style.tension}
      defaultFillColor={forewayCourse.style.fillColor}
      defaultFillOpacity={forewayCourse.style.fillOpacity}
      defaultShowNodes={forewayCourse.style.showNodes}
      backgroundColor={forewayCourse.style.backgroundColor}
      showBoardGrid={forewayCourse.style.showBoardGrid}
      boardGridColor={forewayCourse.style.boardGridColor}
      boardGridSize={forewayCourse.style.boardGridSize}
      defaultBackdropImageUrl={forewayCourse.backdrop.imageUrl}
      defaultBackdropOpacity={forewayCourse.backdrop.opacity}
      backdropFit={forewayCourse.backdrop.fit}
    />
  );
}
```

Guide images are for editing and tracing only. If a local guide image was
uploaded, its temporary `blob:` URL is not exported. `CourseMap` ignores backdrop
image settings and renders the course from the JSON points, details, and styles.

## Shape and board styling

The builder includes `Shape color` and `Shape opacity` controls. The drawing
board uses a dot-grid background by default, while the canvas itself stays
transparent so guide images and drawn shapes sit over the grid. `Shape surface`
switches between a flat `solid` fill and a `terrain` fill that recreates a
layered golf-course effect with a stronger green gradient and soft course
shading.

```tsx
<CourseShapeBuilder
  defaultShapeFillStyle="terrain"
  fillColor="#4f9a4a"
  fillOpacity={0.9}
  backgroundColor="transparent"
  showBoardGrid
  boardGridColor="rgba(55, 77, 49, 0.22)"
  boardGridSize={18}
/>
```

Styling props:

- `fillColor`: controlled shape fill color
- `defaultFillColor`: initial uncontrolled shape fill color
- `onFillColorChange`: called when the shape color picker changes
- `fillOpacity`: controlled shape fill opacity from `0` to `1`
- `defaultFillOpacity`: initial uncontrolled shape fill opacity
- `onFillOpacityChange`: called when the shape opacity slider changes
- `shapeFillStyle`: controlled shape surface style, either `"terrain"` or `"solid"`
- `defaultShapeFillStyle`: initial uncontrolled shape surface style
- `onShapeFillStyleChange`: called when the shape surface selector changes
- `backgroundColor`: board background color, defaulting to transparent
- `showBoardGrid`: toggles the board dot grid
- `boardGridColor`: dot color for the board grid
- `boardGridSize`: spacing between grid dots in pixels

## Backdrop guide images

The builder includes an `Upload guide` control for tracing a course image. The
image is drawn behind the editable shape, and `Guide opacity` controls how
strongly it appears.

You can also provide a backdrop programmatically:

```tsx
<CourseShapeBuilder
  backdropImageUrl="/course-aerial.jpg"
  backdropOpacity={0.45}
  backdropFit="contain"
/>
```

Backdrop props:

- `backdropImageUrl`: image URL to draw behind the shape
- `defaultBackdropImageUrl`: initial uncontrolled backdrop image URL
- `onBackdropImageChange`: called when a user uploads or clears a guide image
- `backdropOpacity`: controlled opacity from `0` to `1`
- `defaultBackdropOpacity`: initial uncontrolled opacity
- `onBackdropOpacityChange`: called when the opacity slider changes
- `backdropFit`: `"contain"`, `"cover"`, or `"stretch"`

## Development

```sh
bun install
bun run dev
bun run typecheck
bun run build
```

The dev server opens the playground at `http://localhost:3000`. Set `PORT` to
use a different port:

```sh
PORT=3001 bun run dev
```

## Publishing

Before publishing, verify the package and inspect the tarball contents:

```sh
bun run typecheck
bun run build
bun run pack:dry-run
```

Publish to npm:

```sh
npm publish
```

`foreway` is configured to publish only `dist`, `README.md`, and
`package.json`. The package is ESM-only and expects React to be provided by the
consuming app.
