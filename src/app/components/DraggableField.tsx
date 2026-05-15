import React, { useState, useEffect } from 'react';
import { FieldLayout } from './CertificateEditor';

interface Props {
  id: string;
  value: string;
  onChange: (val: string) => void;
  layout: FieldLayout;
  onLayoutChange: (layout: Partial<FieldLayout>) => void;
  calibrationMode: boolean;
  placeholder?: string;
  containerRef: React.RefObject<HTMLDivElement>;
  textColorOverrides?: Record<number, string>;
  onTextColorChange?: (start: number, end: number, color: '#000' | '#fff') => void;
}

export default function DraggableField({
  value,
  onChange,
  layout,
  onLayoutChange,
  calibrationMode,
  placeholder,
  containerRef,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, startX: 0, startY: 0 });

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // A4 is 210x297 mm
      const mmPerPxX = 210 / rect.width;
      const mmPerPxY = 297 / rect.height;

      const dx = (e.clientX - dragStart.x) * mmPerPxX;
      const dy = (e.clientY - dragStart.y) * mmPerPxY;

      onLayoutChange({
        x: Math.round((dragStart.startX + dx) * 10) / 10,
        y: Math.round((dragStart.startY + dy) * 10) / 10,
      });
    };

    const onMouseUp = () => setDragging(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, dragStart, containerRef, onLayoutChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!calibrationMode) return;
    e.preventDefault();
    setDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      startX: layout.x,
      startY: layout.y,
    });
  };

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${layout.x}mm`,
    top: `${layout.y}mm`,
    width: `${layout.width}mm`,
    height: `${layout.height}mm`,
    fontSize: `${layout.fontSize}pt`,
    textAlign: layout.align,
    fontWeight: layout.bold ? 'bold' : 'normal',
    color: layout.color || '#000',
    background: 'transparent',
    border: calibrationMode ? '1px dashed #1d4ed8' : 'none',
    cursor: calibrationMode ? 'move' : 'text',
    fontFamily: "'Times New Roman', serif",
    padding: 0,
    margin: 0,
    outline: 'none',
    resize: 'none',
    overflow: 'hidden',
    lineHeight: 1.2,
    zIndex: calibrationMode ? 50 : 10,
  };

  if (layout.multiline) {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onMouseDown={handleMouseDown}
        style={style}
        placeholder={placeholder}
        disabled={calibrationMode}
        className={calibrationMode ? 'pointer-events-none' : ''}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      onMouseDown={handleMouseDown}
      style={style}
      placeholder={placeholder}
      disabled={calibrationMode}
      className={calibrationMode ? 'pointer-events-none' : ''}
    />
  );
}
