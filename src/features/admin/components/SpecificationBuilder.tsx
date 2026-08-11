'use client';

import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, ListCollapse } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

export interface SpecRow {
  id?: string;
  label: string;
  value: string;
  sortOrder: number;
}

export interface SpecSection {
  id?: string;
  heading: string;
  sortOrder: number;
  rows: SpecRow[];
}

interface SpecificationBuilderProps {
  value: SpecSection[];
  onChange: (value: SpecSection[]) => void;
}

export function SpecificationBuilder({ value, onChange }: SpecificationBuilderProps) {
  // Add a new section
  const handleAddSection = () => {
    const newSection: SpecSection = {
      heading: 'New Specification Section',
      sortOrder: value.length,
      rows: [
        { label: '', value: '', sortOrder: 0 }
      ]
    };
    onChange([...value, newSection]);
  };

  // Delete a section
  const handleDeleteSection = (secIdx: number) => {
    const updated = value.filter((_, idx) => idx !== secIdx).map((sec, idx) => ({
      ...sec,
      sortOrder: idx
    }));
    onChange(updated);
  };

  // Update section heading
  const handleUpdateHeading = (secIdx: number, heading: string) => {
    const updated = value.map((sec, idx) => {
      if (idx === secIdx) {
        return { ...sec, heading };
      }
      return sec;
    });
    onChange(updated);
  };

  // Add a row to a section
  const handleAddRow = (secIdx: number) => {
    const updated = value.map((sec, idx) => {
      if (idx === secIdx) {
        return {
          ...sec,
          rows: [...sec.rows, { label: '', value: '', sortOrder: sec.rows.length }]
        };
      }
      return sec;
    });
    onChange(updated);
  };

  // Delete a row from a section
  const handleDeleteRow = (secIdx: number, rowIdx: number) => {
    const updated = value.map((sec, idx) => {
      if (idx === secIdx) {
        return {
          ...sec,
          rows: sec.rows.filter((_, rIdx) => rIdx !== rowIdx).map((row, rIdx) => ({
            ...row,
            sortOrder: rIdx
          }))
        };
      }
      return sec;
    });
    onChange(updated);
  };

  // Update row label/value
  const handleUpdateRow = (secIdx: number, rowIdx: number, field: 'label' | 'value', val: string) => {
    const updated = value.map((sec, idx) => {
      if (idx === secIdx) {
        return {
          ...sec,
          rows: sec.rows.map((row, rIdx) => {
            if (rIdx === rowIdx) {
              return { ...row, [field]: val };
            }
            return row;
          })
        };
      }
      return sec;
    });
    onChange(updated);
  };

  // Move row up
  const handleMoveRowUp = (secIdx: number, rowIdx: number) => {
    if (rowIdx === 0) return;
    const updated = value.map((sec, idx) => {
      if (idx === secIdx) {
        const rows = [...sec.rows];
        // Swap elements
        const temp = rows[rowIdx];
        rows[rowIdx] = rows[rowIdx - 1];
        rows[rowIdx - 1] = temp;
        // Fix sortOrders
        const sorted = rows.map((r, rIdx) => ({ ...r, sortOrder: rIdx }));
        return { ...sec, rows: sorted };
      }
      return sec;
    });
    onChange(updated);
  };

  // Move row down
  const handleMoveRowDown = (secIdx: number, rowIdx: number) => {
    const updated = value.map((sec, idx) => {
      if (idx === secIdx) {
        if (rowIdx === sec.rows.length - 1) return sec;
        const rows = [...sec.rows];
        // Swap elements
        const temp = rows[rowIdx];
        rows[rowIdx] = rows[rowIdx + 1];
        rows[rowIdx + 1] = temp;
        // Fix sortOrders
        const sorted = rows.map((r, rIdx) => ({ ...r, sortOrder: rIdx }));
        return { ...sec, rows: sorted };
      }
      return sec;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <div className="flex items-center gap-2">
          <ListCollapse className="h-4 w-4 text-ink-muted" />
          <h3 className="text-sm font-bold text-ink">
            Technical Specification Tables
          </h3>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddSection}
          className="h-8 text-xs font-semibold cursor-pointer"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Section
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="text-center py-10 rounded-card border border-dashed border-line bg-surface-sunken/20">
          <p className="text-xs text-ink-subtle">No specifications added yet. Add a section to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {value.map((section, secIdx) => (
            <div
              key={secIdx}
              className="rounded-card border border-line bg-surface-raised p-4 space-y-4 shadow-sm"
            >
              {/* Section Header */}
              <div className="flex items-center gap-3 justify-between">
                <div className="flex-1 max-w-sm">
                  <Input
                    type="text"
                    value={section.heading}
                    onChange={(e) => handleUpdateHeading(secIdx, e.target.value)}
                    placeholder="Specification Section Heading (e.g. Dimensions)"
                    className="font-bold text-sm h-9 bg-surface-sunken/50 focus:bg-surface-raised"
                  />
                </div>
                
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteSection(secIdx)}
                  className="text-ink-subtle hover:text-danger hover:bg-rose-50/50 dark:hover:bg-rose-950/20 cursor-pointer h-9 px-3"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete Section
                </Button>
              </div>

              {/* Rows List */}
              <div className="space-y-2 border-t border-line pt-4">
                {section.rows.map((row, rowIdx) => (
                  <div key={rowIdx} className="flex gap-2 items-center">
                    <Input
                      type="text"
                      value={row.label}
                      onChange={(e) => handleUpdateRow(secIdx, rowIdx, 'label', e.target.value)}
                      placeholder="Label (e.g. Item Weight)"
                      className="flex-1 h-9 text-xs"
                    />
                    <Input
                      type="text"
                      value={row.value}
                      onChange={(e) => handleUpdateRow(secIdx, rowIdx, 'value', e.target.value)}
                      placeholder="Value (e.g. 9.25 kg)"
                      className="flex-2 h-9 text-xs"
                    />

                    {/* Row Reordering & Deletion Actions */}
                    <div className="flex items-center gap-0.5 border border-line rounded p-0.5 bg-surface-sunken/30">
                      <button
                        type="button"
                        onClick={() => handleMoveRowUp(secIdx, rowIdx)}
                        disabled={rowIdx === 0}
                        className="p-1.5 text-ink-subtle hover:text-ink-muted disabled:opacity-30 dark:hover:text-ink-subtle"
                        title="Move Row Up"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveRowDown(secIdx, rowIdx)}
                        disabled={rowIdx === section.rows.length - 1}
                        className="p-1.5 text-ink-subtle hover:text-ink-muted disabled:opacity-30 dark:hover:text-ink-subtle"
                        title="Move Row Down"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRow(secIdx, rowIdx)}
                      className="text-ink-subtle hover:text-danger cursor-pointer h-9 px-2"
                      title="Delete Row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Add Row Action */}
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddRow(secIdx)}
                  className="h-8 text-2xs font-bold border-dashed text-ink-muted hover:text-ink-muted cursor-pointer"
                >
                  <Plus className="mr-1 h-3 w-3" /> Add Row
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
