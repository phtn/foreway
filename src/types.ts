import type { CSSProperties } from "react";

export type CourseBuilderMode = "place" | "move" | "erase";
export type CourseBackdropFit = "contain" | "cover" | "stretch";
export type CourseDetailType = "sand" | "pond" | "arrow" | "hole";
export type CourseBuilderLayer = "course" | CourseDetailType;
export type CourseShapeFillStyle = "solid" | "terrain";

export interface CoursePoint {
  x: number;
  y: number;
}

export interface CourseDetail {
  id: string;
  type: CourseDetailType;
  points: CoursePoint[];
  label?: string | number;
  style?: {
    color?: string;
  };
}

export interface CourseViewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface CourseDrawingExport {
  version: 1;
  generatedAt: string;
  points: CoursePoint[];
  details: CourseDetail[];
  style: {
    tension: number;
    fillColor: string;
    fillOpacity: number;
    shapeFillStyle?: CourseShapeFillStyle;
    strokeColor: string;
    showNodes: boolean;
    backgroundColor: string;
    showBoardGrid: boolean;
    boardGridColor: string;
    boardGridSize: number;
  };
  backdrop: {
    imageUrl: string | null;
    opacity: number;
    fit: CourseBackdropFit;
  };
  viewport: CourseViewport;
}

export interface DrawCourseShapeOptions {
  points: CoursePoint[];
  details?: CourseDetail[];
  tension: number;
  width: number;
  height: number;
  viewport?: CourseViewport;
  backgroundColor?: string;
  fillColor?: string;
  fillOpacity?: number;
  shapeFillStyle?: CourseShapeFillStyle;
  strokeColor?: string;
  showNodes?: boolean;
  isCourseSelected?: boolean;
  activeDetailId?: string | null;
  firstPointColor?: string;
  pointRadius?: number;
  showEmptyHint?: boolean;
  backdropImage?: HTMLImageElement | null;
  backdropOpacity?: number;
  backdropFit?: CourseBackdropFit;
}

export interface CourseShapeBuilderProps {
  value?: CoursePoint[];
  defaultValue?: CoursePoint[];
  onChange?: (points: CoursePoint[]) => void;
  details?: CourseDetail[];
  defaultDetails?: CourseDetail[];
  onDetailsChange?: (details: CourseDetail[]) => void;
  mode?: CourseBuilderMode;
  defaultMode?: CourseBuilderMode;
  onModeChange?: (mode: CourseBuilderMode) => void;
  tension?: number;
  defaultTension?: number;
  onTensionChange?: (tension: number) => void;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  canvasLabel?: string;
  backgroundColor?: string;
  fillColor?: string;
  defaultFillColor?: string;
  onFillColorChange?: (color: string) => void;
  fillOpacity?: number;
  defaultFillOpacity?: number;
  onFillOpacityChange?: (opacity: number) => void;
  shapeFillStyle?: CourseShapeFillStyle;
  defaultShapeFillStyle?: CourseShapeFillStyle;
  onShapeFillStyleChange?: (shapeFillStyle: CourseShapeFillStyle) => void;
  strokeColor?: string;
  pointRadius?: number;
  showNodes?: boolean;
  defaultShowNodes?: boolean;
  onShowNodesChange?: (showNodes: boolean) => void;
  showBoardGrid?: boolean;
  boardGridColor?: string;
  boardGridSize?: number;
  backdropImageUrl?: string | null;
  defaultBackdropImageUrl?: string | null;
  onBackdropImageChange?: (imageUrl: string | null, file: File | null) => void;
  backdropOpacity?: number;
  defaultBackdropOpacity?: number;
  onBackdropOpacityChange?: (opacity: number) => void;
  backdropFit?: CourseBackdropFit;
  downloadFileName?: string;
  disabled?: boolean;
}
