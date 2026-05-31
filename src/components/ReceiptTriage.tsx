"use client";

import React, { useState, useRef } from "react";
import { PantryItem, commitToPantry } from "@/lib/firebase";
import { Upload, CheckSquare, Square, Trash2, Plus, Edit2, Play, AlertCircle } from "lucide-react";

interface ReceiptTriageProps {
  onRefreshData: () => void;
}

interface TriageItem {
  id: string;
  name: string;
  quantity: number;
  unit: "g" | "unit" | "ml";
  category: "Proteins" | "Produce" | "Fats/Nuts" | "Flavor Bridges";
  checked: boolean;
}

export default function ReceiptTriage({ onRefreshData }: ReceiptTriageProps) {
  const [items, setItems] = useState<TriageItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [commitSuccess, setCommitSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert uploaded image to Base64 data URL
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setImagePreview(base64String);
      setCommitSuccess(false);
      triggerReceiptParsing(base64String);
    };
    reader.readAsDataURL(file);
  };

  // Trigger Gemini Parser API
  const triggerReceiptParsing = async (base64Image: string) => {
    setIsScanning(true);
    setItems([]);
    try {
      const res = await fetch("/api/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image }),
      });
      const data = await res.json();
      if (data.items) {
        // Map parsed items into triage state
        const mapped: TriageItem[] = data.items.map((item: any, idx: number) => ({
          id: `${Date.now()}-${idx}`,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit || "g",
          category: item.category || "Produce",
          checked: !item.name.toLowerCase().includes("non-user") && !item.name.toLowerCase().includes("shared"), // auto uncheck shared!
        }));
        setItems(mapped);
      }
    } catch (e) {
      console.error("Failed to parse receipt", e);
    } finally {
      setIsScanning(false);
    }
  };

  // Toggle item check status
  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  // Update item field manually
  const updateItemField = (id: string, field: keyof TriageItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Delete item row
  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Add empty manual row
  const addManualRow = () => {
    const newItem: TriageItem = {
      id: `manual-${Date.now()}`,
      name: "New Custom Item",
      quantity: 100,
      unit: "g",
      category: "Produce",
      checked: true,
    };
    setItems((prev) => [...prev, newItem]);
  };

  // Commit checked items to the pantry database
  const handleCommitToPantry = async () => {
    const checkedItems = items.filter((x) => x.checked);
    if (checkedItems.length === 0) return;

    // Convert triage items to pantry items format
    const pantryItems: PantryItem[] = checkedItems.map((x) => ({
      name: x.name,
      quantity: x.quantity,
      unit: x.unit,
      category: x.category,
    }));

    await commitToPantry(pantryItems);
    setCommitSuccess(true);
    setItems([]);
    setImagePreview(null);
    onRefreshData();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Upload Zone Panel */}
      <div className="lg:col-span-1 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Receipt Capture</h2>
              <p className="text-xs text-zinc-400">Scan and ingest kitchen stocks</p>
            </div>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-950/40 transition-all duration-300 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer text-center group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            
            {imagePreview ? (
              <div className="space-y-4">
                <img
                  src={imagePreview}
                  alt="Receipt Preview"
                  className="max-h-48 rounded-xl object-contain mx-auto border border-zinc-800 shadow"
                />
                <span className="text-xxs text-indigo-400 font-bold block group-hover:text-indigo-300">
                  Click to replace image
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-zinc-950/80 rounded-full w-14 h-14 flex items-center justify-center mx-auto border border-zinc-850 group-hover:scale-105 transition duration-300">
                  <Upload className="w-6 h-6 text-zinc-500 group-hover:text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-200">Select Receipt Image</h4>
                  <p className="text-xxs text-zinc-500 mt-1">Supports PNG, JPG, or PDF scans</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* OCR animated scan bar */}
        {isScanning && (
          <div className="mt-6 p-4 bg-indigo-950/20 border border-indigo-900/40 rounded-2xl space-y-3">
            <div className="flex justify-between items-center text-xxs font-bold text-indigo-400 uppercase tracking-widest">
              <span>Vision OCR Processing...</span>
              <span className="animate-pulse">Active</span>
            </div>
            <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
              <div className="bg-indigo-500 h-full animate-[loading_1.5s_ease-in-out_infinite]" style={{ width: "60%" }} />
            </div>
          </div>
        )}

        {commitSuccess && (
          <div className="mt-6 p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-2xl flex items-start gap-2.5">
            <CheckSquare className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-emerald-300">Pantry Hydrated Successfully!</h4>
              <p className="text-xxs text-emerald-400/80 mt-0.5 leading-relaxed">
                Your selected items have been committed. Pantry quantities and deficits recalculated.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Staging Triage Area Panel */}
      <div className="lg:col-span-2 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between min-h-[400px]">
        <div>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
                <CheckSquare className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-100">Triage Staging Area</h2>
                <p className="text-xs text-zinc-400">Review, exclude, and normalize items</p>
              </div>
            </div>

            {items.length > 0 && (
              <button
                onClick={addManualRow}
                className="flex items-center gap-1 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-300 text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            )}
          </div>

          {items.length > 0 ? (
            <div className="border border-zinc-850 rounded-2xl overflow-hidden bg-zinc-950/40 max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-950/80 border-b border-zinc-850 text-zinc-400 font-bold uppercase tracking-wider text-xxs">
                    <th className="py-3.5 px-4 w-10">Use</th>
                    <th className="py-3.5 px-4">Item Name</th>
                    <th className="py-3.5 px-4 w-28">Quantity</th>
                    <th className="py-3.5 px-4 w-24">Unit</th>
                    <th className="py-3.5 px-4 w-32">Category</th>
                    <th className="py-3.5 px-4 w-10 text-center">Excl</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850/60">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-zinc-900/30 transition-all ${
                        !item.checked ? "opacity-40 bg-zinc-950/20" : ""
                      }`}
                    >
                      {/* Checkbox selector */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleItem(item.id)}
                          className="text-zinc-500 hover:text-indigo-400 focus:outline-none cursor-pointer"
                        >
                          {item.checked ? (
                            <CheckSquare className="w-4.5 h-4.5 text-indigo-500" />
                          ) : (
                            <Square className="w-4.5 h-4.5" />
                          )}
                        </button>
                      </td>

                      {/* Item name input */}
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItemField(item.id, "name", e.target.value)}
                          className="bg-transparent border-none text-zinc-200 focus:ring-0 focus:outline-none font-bold w-full"
                        />
                      </td>

                      {/* Quantity input */}
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItemField(item.id, "quantity", parseFloat(e.target.value) || 0)
                          }
                          className="bg-transparent border border-zinc-850 px-2 py-1 rounded-lg text-zinc-200 focus:ring-0 focus:outline-none w-20 font-bold"
                        />
                      </td>

                      {/* Unit dropdown */}
                      <td className="py-3 px-4">
                        <select
                          value={item.unit}
                          onChange={(e) => updateItemField(item.id, "unit", e.target.value)}
                          className="bg-zinc-900 border-zinc-850 py-1 px-2 rounded-lg text-zinc-300 w-20 text-xxs font-semibold"
                        >
                          <option value="g">g</option>
                          <option value="ml">ml</option>
                          <option value="unit">unit</option>
                        </select>
                      </td>

                      {/* Category selector */}
                      <td className="py-3 px-4">
                        <select
                          value={item.category}
                          onChange={(e) => updateItemField(item.id, "category", e.target.value)}
                          className="bg-zinc-900 border-zinc-850 py-1 px-2 rounded-lg text-zinc-300 w-28 text-xxs font-semibold"
                        >
                          <option value="Proteins">Proteins</option>
                          <option value="Produce">Produce</option>
                          <option value="Fats/Nuts">Fats/Nuts</option>
                          <option value="Flavor Bridges">Flavor Bridges</option>
                        </select>
                      </td>

                      {/* Delete item row */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-zinc-600 hover:text-red-400 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center py-16 border border-dashed border-zinc-850 rounded-2xl bg-zinc-950/20 text-center">
              <AlertCircle className="w-8 h-8 text-zinc-600 mb-3" />
              <h4 className="text-sm font-bold text-zinc-300">Staging Area Idle</h4>
              <p className="text-xxs text-zinc-500 max-w-xs mt-1 leading-relaxed">
                Upload a receipt image. The Gemini Vision SDK will extract messy lines into structured items here for filtration.
              </p>
            </div>
          )}
        </div>

        {/* Commit Actions */}
        {items.length > 0 && (
          <div className="mt-6 pt-4 border-t border-zinc-850/60 flex justify-between items-center">
            <span className="text-xxs text-zinc-500 font-semibold uppercase">
              Ready: {items.filter((x) => x.checked).length} items checked for commit
            </span>
            <button
              onClick={handleCommitToPantry}
              className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 font-black text-xs px-5 py-2.5 rounded-xl transition cursor-pointer"
            >
              Commit to Pantry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
